import path from 'node:path';
import fs from 'node:fs';
import mime from 'mime-types';
import { generateETag } from 's3-etag';
import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  ListObjectsV2Command,
  PutObjectCommand,
  PutObjectCommandOutput,
  PutObjectRequest,
  S3Client,
  ServiceOutputTypes,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import glob from '@actions/glob';
import { info } from '@actions/core';
import minimatch from 'minimatch';

import { workspace } from './github.js';
import { AsyncQueue } from './AsyncQueue.js';

export type S3ObjectPrefix = string;

function getTimeString(time: [number, number]) {
  return `${time[0]}s:${(time[1] / 1000000).toFixed(0)}ms`;
}

export async function getObjectMetadata(
  client: S3Client,
  s3BucketName: string,
  key: string
): Promise<HeadObjectCommandOutput | void> {
  try {
    return await client.send(
      new HeadObjectCommand({
        Bucket: s3BucketName,
        Key: key,
      })
    );
  } catch (e) {
    return undefined;
  }
}

export function getObjectKeyFromFilePath(
  rootDir: string,
  absoluteFilePath: string,
  prefix: S3ObjectPrefix | string,
  stripExtensionGlob: string
): string {
  const key = path.join(prefix, path.relative(rootDir, absoluteFilePath));
  const { root, dir, name, ext } = path.parse(key);
  const extensionLessFile = path.join(root + dir, name);
  const matchesStripExtension = stripExtensionGlob
    ? minimatch(absoluteFilePath, stripExtensionGlob)
    : false;
  if (matchesStripExtension) {
    return extensionLessFile;
  }
  return extensionLessFile + ext;
}

function getContentTypeForExtension(extension: string): string {
  const contentType = mime.lookup(extension);
  if (contentType === false) {
    throw new Error(`Unable to detect content-type for ${extension}`);
  }
  return contentType;
}

async function uploadFile(
  client: S3Client,
  s3BucketName: string,
  key: string,
  absoluteFilePath: string,
  cacheControl: string,
  contentType: string,
  acl: PutObjectRequest['ACL']
): Promise<PutObjectCommandOutput> {
  return client.send(
    new PutObjectCommand({
      Bucket: s3BucketName,
      Key: key,
      CacheControl: cacheControl,
      ContentType: contentType,
      ACL: acl,
      Body: fs.createReadStream(absoluteFilePath),
    })
  );
}

async function uploadMultipartFile(
  client: S3Client,
  s3BucketName: string,
  key: string,
  absoluteFilePath: string,
  cacheControl: string,
  contentType: string,
  acl: PutObjectRequest['ACL'],
  partSizeInBytes: number,
  concurrency: number
): Promise<ServiceOutputTypes> {
  const startTime = process.hrtime();

  const body = fs.createReadStream(absoluteFilePath);

  const upload = new Upload({
    client,
    queueSize: concurrency,
    partSize: partSizeInBytes,
    leavePartsOnError: false,
    params: {
      Key: key,
      Bucket: s3BucketName,
      Body: body,
      CacheControl: cacheControl,
      ContentType: contentType,
      ACL: acl,
    },
  });

  info(
    `Started multipart upload for ${key} using ${
      partSizeInBytes / 1024 / 1024
    }MB chunks and ${concurrency} concurrent processes, please wait...`
  );

  upload.on('httpUploadProgress', (progress) => {
    const endTime = process.hrtime(startTime);
    const percentLoaded =
      progress.loaded && progress.total
        ? Math.round((progress.loaded / progress.total) * 100)
        : 0;
    info(
      `${key}: loaded ${percentLoaded}% (${progress.loaded} of ${
        progress.total
      }) (part ${progress.part}) (total time elapsed: ${getTimeString(
        endTime
      )})`
    );
  });

  return upload.done();
}

function getETag(absoluteFilePath: string, partSizeInBytes: number): string {
  const etag = generateETag(absoluteFilePath, partSizeInBytes);
  return JSON.stringify(etag);
}

export async function isMultipartFile(
  absoluteFilePath: string,
  partSizeInBytes: number
) {
  const { size: sizeInBytes } = await fs.promises.stat(absoluteFilePath);
  return sizeInBytes >= partSizeInBytes;
}

export async function shouldUploadFile(
  client: S3Client,
  s3BucketName: string,
  absoluteFilePath: string,
  key: string,
  cacheControl: string,
  contentType: string,
  multipart: boolean,
  partSizeInBytes: number
) {
  const eTag = await getETag(absoluteFilePath, multipart ? partSizeInBytes : 0);
  const metadata = await getObjectMetadata(client, s3BucketName, key);

  const shouldUploadFile =
    !metadata ||
    metadata.CacheControl !== cacheControl ||
    metadata.ContentType !== contentType ||
    metadata.ETag !== eTag;

  return shouldUploadFile;
}

export async function getFilesFromSrcDir(
  srcDir: string,
  filesGlob: string
): Promise<string[]> {
  if (srcDir.trim() === '' || filesGlob.trim() === '') {
    throw new Error('srcDir and filesGlob must not be empty');
  }
  const globber = await glob.create(`${srcDir}/${filesGlob}`, {
    matchDirectories: false,
  });
  return globber.glob();
}

type FileToUpload = {
  absoluteFilePath: string;
  key: string;
  contentType: string;
  multipart: boolean;
};

export async function syncFilesToS3(
  client: S3Client,
  s3BucketName: string,
  srcDir: string,
  filesGlob: string,
  prefix: S3ObjectPrefix | string,
  stripExtensionGlob: string,
  cacheControl: string,
  acl: PutObjectRequest['ACL'],
  multipartFileSizeMb: number,
  multipartChunkBytes: number,
  concurrency: number
): Promise<string[]> {
  const startTime = process.hrtime();

  if (!workspace) {
    throw new Error('GITHUB_WORKSPACE is not defined');
  }
  info(`Syncing files from ${srcDir} with ${concurrency} concurrent processes`);

  const rootDir = path.join(workspace, srcDir);
  const files = await getFilesFromSrcDir(srcDir, filesGlob);

  const filesToUpload: FileToUpload[] = [];

  await new AsyncQueue(
    concurrency,
    files.map((file) => async () => {
      const s3Key = getObjectKeyFromFilePath(
        rootDir,
        file,
        prefix,
        stripExtensionGlob
      );
      const extension = path.extname(file).toLowerCase();
      const contentType = getContentTypeForExtension(extension);

      const multipart = await isMultipartFile(
        file,
        multipartFileSizeMb * 1024 * 1024
      );

      const shouldUpload = await shouldUploadFile(
        client,
        s3BucketName,
        file,
        s3Key,
        cacheControl,
        contentType,
        multipart,
        multipartChunkBytes
      );

      if (shouldUpload) {
        filesToUpload.push({
          absoluteFilePath: file,
          key: s3Key,
          contentType,
          multipart,
        });
      } else {
        info(`Skipped ${s3Key} (no-change)`);
      }
    })
  ).process();

  const smallFiles = filesToUpload.filter((file) => !file.multipart);
  const multipartFiles = filesToUpload.filter((file) => file.multipart);

  info(`Found ${smallFiles.length} small files`);
  info(`Found ${multipartFiles.length} multipart files`);

  /**
   * Upload small files in parallel
   */
  const uploadSmallFilesQueue = await new AsyncQueue(
    concurrency,
    smallFiles.map((file) => async () => {
      const startTime = process.hrtime();
      await uploadFile(
        client,
        s3BucketName,
        file.key,
        file.absoluteFilePath,
        cacheControl,
        file.contentType,
        acl
      );
      const endTime = process.hrtime(startTime);
      info(
        `Synced ${file.key} (${getTimeString(endTime)}) (${
          uploadSmallFilesQueue.inProgress
        } ops in progress)`
      );
    })
  );

  await uploadSmallFilesQueue.process();

  /**
   * Upload large files one at a time, as we're using multipart
   * uploads to upload parts in parallel
   */
  const uploadMultipartFilesQueue = new AsyncQueue(
    1,
    multipartFiles.map((file) => async () => {
      const startTime = process.hrtime();
      await uploadMultipartFile(
        client,
        s3BucketName,
        file.key,
        file.absoluteFilePath,
        cacheControl,
        file.contentType,
        acl,
        multipartChunkBytes,
        concurrency
      );
      const endTime = process.hrtime(startTime);
      info(`Synced ${file.key} (${getTimeString(endTime)})`);
    })
  );

  await uploadMultipartFilesQueue.process();

  const endTime = process.hrtime(startTime);

  info(`Synced ${smallFiles.length} small files`);
  info(`Synced ${multipartFiles.length} multipart files`);
  info(`✅ Synced total ${smallFiles.length + multipartFiles.length} files`);

  info(`Execution time: ${getTimeString(endTime)}`);

  const getFileKey = ({ key }: FileToUpload) => key;
  return smallFiles.map(getFileKey).concat(multipartFiles.map(getFileKey));
}

export async function emptyS3Directory(
  client: S3Client,
  s3BucketName: string,
  prefix: string,
  initialObjectsCleaned: string[] = []
): Promise<string[]> {
  const objects = await client.send(
    new ListObjectsV2Command({
      Bucket: s3BucketName,
      Prefix: prefix,
    })
  );

  if (!objects.Contents?.length) {
    return initialObjectsCleaned;
  }

  const objectKeys = objects.Contents.map(({ Key }) => ({ Key }));

  await client.send(
    new DeleteObjectsCommand({
      Bucket: s3BucketName,
      Delete: { Objects: objectKeys },
    })
  );

  const totalObjectsCleaned = initialObjectsCleaned
    .concat(objectKeys.map(({ Key }) => Key || ''))
    .filter(Boolean);

  if (objects.IsTruncated) {
    return await emptyS3Directory(
      client,
      s3BucketName,
      prefix,
      totalObjectsCleaned
    );
  }

  return totalObjectsCleaned;
}
