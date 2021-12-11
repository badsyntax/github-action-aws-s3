import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import mime from 'mime-types';
import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  ListObjectsV2Command,
  PutObjectCommand,
  PutObjectCommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import glob from '@actions/glob';
import { info } from '@actions/core';
import minimatch from 'minimatch';

export type S3ObjectPrefix = string;

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

function getCacheControlForExtension(extension: string): string {
  switch (extension) {
    case '.html':
      return 'public,max-age=0,s-maxage=31536000,must-revalidate';
    default:
      return 'public,max-age=31536000,immutable';
  }
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
  contentType: string
): Promise<PutObjectCommandOutput> {
  return client.send(
    new PutObjectCommand({
      Bucket: s3BucketName,
      Key: key,
      CacheControl: cacheControl,
      ContentType: contentType,
      Body: fs.createReadStream(absoluteFilePath),
    })
  );
}

function getETag(absoluteFilePath: string): string {
  const fileContents = fs.readFileSync(absoluteFilePath, 'utf-8');
  const base64ETag = Buffer.from(
    crypto.createHash('md5').update(fileContents).digest('hex'),
    'base64'
  ).toString('base64');
  return JSON.stringify(base64ETag);
}

export async function maybeUploadFile(
  client: S3Client,
  s3BucketName: string,
  absoluteFilePath: string,
  key: string
): Promise<boolean> {
  const extension = path.extname(absoluteFilePath).toLowerCase();
  const cacheControl = getCacheControlForExtension(extension);
  const contentType = getContentTypeForExtension(extension);
  const eTag = getETag(absoluteFilePath);
  const metadata = await getObjectMetadata(client, s3BucketName, key);

  const shouldUploadFile =
    !metadata ||
    metadata.CacheControl !== cacheControl ||
    metadata.ContentType !== contentType ||
    metadata.ETag !== eTag;

  if (shouldUploadFile) {
    await uploadFile(
      client,
      s3BucketName,
      key,
      absoluteFilePath,
      cacheControl,
      contentType
    );
  }
  return shouldUploadFile;
}

const trailingSlashRegex = /\/$/;

async function getFilesFromSrcDir(srcDir: string): Promise<string[]> {
  const sanitisedSrcDir = srcDir.replace(trailingSlashRegex, '');
  const patterns = [`${sanitisedSrcDir}/**`];
  const globber = await glob.create(patterns.join('\n'), {
    matchDirectories: false,
  });
  return globber.glob();
}

export async function syncFilesToS3(
  client: S3Client,
  s3BucketName: string,
  srcDir: string,
  prefix: S3ObjectPrefix | string,
  stripExtensionGlob: string
): Promise<string[]> {
  if (srcDir.trim() === '') {
    throw new Error('srcDir must not be empty');
  }
  const files = await getFilesFromSrcDir(srcDir);
  const rootDir = path.resolve(srcDir);
  const uploadedKeys: string[] = [];
  for (const file of files) {
    const key = getObjectKeyFromFilePath(
      rootDir,
      file,
      prefix,
      stripExtensionGlob
    );
    const uploaded = await maybeUploadFile(client, s3BucketName, file, key);
    if (uploaded) {
      info(`Synced ${key}`);
      uploadedKeys.push(key);
    } else {
      info(`Skipped ${key} (no change)`);
    }
  }
  info(`Synced ${uploadedKeys.length} files`);
  return uploadedKeys;
}

export async function emptyS3Directory(
  client: S3Client,
  s3BucketName: string,
  prefix: string
): Promise<void> {
  const objects = await client.send(
    new ListObjectsV2Command({
      Bucket: s3BucketName,
      Prefix: prefix,
    })
  );

  if (!objects.Contents?.length) {
    return;
  }

  await client.send(
    new DeleteObjectsCommand({
      Bucket: s3BucketName,
      Delete: { Objects: objects.Contents.map(({ Key }) => ({ Key })) },
    })
  );

  if (objects.IsTruncated) {
    return await emptyS3Directory(client, s3BucketName, prefix);
  }
}
