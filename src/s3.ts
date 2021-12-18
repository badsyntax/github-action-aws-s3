import path from 'node:path';
import fs from 'node:fs';
import util from 'node:util';
import mime from 'mime-types';
import glob from 'glob';
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
import { debug, info } from '@actions/core';
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
): Promise<HeadObjectCommandOutput | undefined> {
  try {
    return await client.send(
      new HeadObjectCommand({
        Bucket: s3BucketName,
        Key: key,
      })
    );
  } catch (e) {
    debug(
      `Unable to get HEAD Metadata for object key ${key} (likely it does not exist)`
    );
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
  fileSizeInBytes: number,
  partSizeInBytes: number
) {
  return fileSizeInBytes >= partSizeInBytes;
}

export async function shouldUploadFile(
  absoluteFilePath: string,
  s3Key: string,
  cacheControl: string,
  contentType: string,
  multipart: boolean,
  partSizeInBytes: number,
  fileSizeInBytes: number,
  modifiedTime: Date,
  syncCriteria: string[],
  metadata?: HeadObjectCommandOutput
) {
  if (!metadata) {
    debug(`Hit: ${s3Key}: No Metadata`);
    return true;
  }

  if (!syncCriteria.length) {
    debug(`Hit: ${s3Key}: No sync criteria set`);
    return true;
  }

  if (syncCriteria.includes('ETag')) {
    const eTag = getETag(absoluteFilePath, multipart ? partSizeInBytes : 0);
    if (metadata.ETag !== eTag) {
      debug(`Hit: ${s3Key}: ETag differs`);
      return true;
    }
  }

  if (
    syncCriteria.includes('ContentLength') &&
    metadata.ContentLength !== fileSizeInBytes
  ) {
    debug(`Hit: ${s3Key}: ContentLength differs`);
    return true;
  }

  // If the last modified time of the source (local) is newer
  // than the last modified time of the destination (s3)
  if (
    syncCriteria.includes('LastModified') &&
    modifiedTime.getTime() > (metadata.LastModified?.getTime() || 0)
  ) {
    debug(`Hit: ${s3Key}: LastModified differs`);
    return true;
  }

  if (
    syncCriteria.includes('CacheControl') &&
    metadata.CacheControl !== cacheControl
  ) {
    debug(`Hit: ${s3Key}: CacheControl differs`);
    return true;
  }

  if (
    syncCriteria.includes('ContentType') &&
    metadata.ContentType !== contentType
  ) {
    debug(`Hit: ${s3Key}: ContentType differs`);
    return true;
  }

  return false;
}

export async function getFilesFromSrcDir(
  srcDir: string,
  filesGlob: string
): Promise<string[]> {
  if (srcDir.trim() === '' || filesGlob.trim() === '') {
    throw new Error('srcDir and filesGlob must not be empty');
  }
  return util.promisify(glob)(filesGlob, {
    cwd: srcDir,
    absolute: true,
    nodir: true,
  });
}

type FileToUpload = {
  absoluteFilePath: string;
  key: string;
  contentType: string;
  multipart: boolean;
};

function getFilesPlural(isPlural: boolean): string {
  return isPlural ? 'files' : 'file';
}

export function generateSyncCriteria(syncStrategy: string): string[] {
  return syncStrategy
    .trim()
    .split('\n')
    .map((criteria) => criteria.trim())
    .filter((criteria) => !!criteria);
}

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
  concurrency: number,
  syncStrategy: string
): Promise<string[]> {
  const startTime = process.hrtime();

  if (!workspace) {
    throw new Error('GITHUB_WORKSPACE is not defined');
  }
  info(`Syncing files from ${srcDir} with ${concurrency} concurrent processes`);

  const rootDir = path.join(workspace, srcDir);
  const files = await getFilesFromSrcDir(srcDir, filesGlob);

  const filesToUpload: FileToUpload[] = [];

  const syncCriteria = generateSyncCriteria(syncStrategy);

  debug(`Sync criteria: ${syncCriteria.join(',')}`);

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
      const { size: fileSizeInBytes, mtime } = await fs.promises.stat(file);

      const multipart = await isMultipartFile(
        fileSizeInBytes,
        multipartFileSizeMb * 1024 * 1024
      );

      const metadata = await getObjectMetadata(client, s3BucketName, s3Key);

      const shouldUpload = await shouldUploadFile(
        file,
        s3Key,
        cacheControl,
        contentType,
        multipart,
        multipartChunkBytes,
        fileSizeInBytes,
        mtime,
        syncCriteria,
        metadata
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
  const totalFiles = smallFiles.length + multipartFiles.length;

  if (totalFiles > 0) {
    info(
      `Discovered ${totalFiles} ${getFilesPlural(
        totalFiles !== 1
      )} to upload (${smallFiles.length} small | ${
        multipartFiles.length
      } multipart), starting sync...`
    );
  }

  /**
   * Upload small files in parallel
   */
  const uploadSmallFilesQueue = new AsyncQueue(
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
   * Upload multipart files one at a time
   */
  await Promise.all(
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

  const endTime = process.hrtime(startTime);

  info(
    `✅ Synced ${totalFiles} ${getFilesPlural(totalFiles !== 1)} (${
      smallFiles.length
    } small | ${multipartFiles.length} multipart) in ${getTimeString(endTime)}`
  );

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
