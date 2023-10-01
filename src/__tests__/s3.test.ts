import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from '@jest/globals';
import type { HeadObjectCommandOutput } from '@aws-sdk/client-s3';
import {
  getObjectKeyFromFilePath,
  getFilesFromSrcDir,
  shouldUploadFile,
  generateSyncCriteria,
} from '../s3.js';

describe('getObjectKeyFromFilePath', () => {
  it('should generate the key', () => {
    const key = getObjectKeyFromFilePath(
      '/src/root',
      '/src/root/blog.html',
      '',
      '',
    );
    expect(key).toBe('blog.html');
  });

  it('should strip extension', () => {
    const keyWithoutExtension = getObjectKeyFromFilePath(
      '/src/root',
      '/src/root/blog.html',
      '',
      '**/*.html',
    );
    expect(keyWithoutExtension).toBe('blog');
  });

  it('should find files using srcDir and filesGlob', async () => {
    const srcDir = './test-fixtures';
    const rootDir = path.join(path.resolve(process.cwd()), srcDir);
    const files = await getFilesFromSrcDir(srcDir, '**/*.html');
    expect(files).toEqual([`${rootDir}/blog.html`, `${rootDir}/index.html`]);
  });

  it('should find files using srcDir and filesGlob with brace expansion', async () => {
    const srcDir = './test-fixtures';
    const rootDir = path.join(path.resolve(process.cwd()), srcDir);
    const files = await getFilesFromSrcDir(srcDir, '{css,site-assets}/**/*');
    expect(files).toEqual([
      `${rootDir}/css/styles.css`,
      `${rootDir}/site-assets/script.js`,
    ]);
  });
});

describe('shouldUploadFile', () => {
  const srcDir = './test-fixtures';
  const absoluteFilePath = path.join(
    path.resolve(process.cwd()),
    srcDir,
    'index.html',
  );
  const s3Key = 'index.html';
  const cacheControl = 'no-cache';
  const contentType = 'text/html';
  const isMultipart = false;
  const partSizeInBytes = 0;
  const { size: contentLength, mtime: lastModified } =
    fs.statSync(absoluteFilePath);

  it('should upload if no metadata is specified', async () => {
    const criteria = generateSyncCriteria('ETag\nCache-Control');
    const metadata = undefined;
    const shouldUpload = await shouldUploadFile(
      absoluteFilePath,
      s3Key,
      cacheControl,
      contentType,
      isMultipart,
      partSizeInBytes,
      contentLength,
      lastModified,
      criteria,
      metadata,
    );
    expect(shouldUpload).toBe(true);
  });

  it('should upload if no criteria is specified', async () => {
    const criteria = generateSyncCriteria('');
    const metadata = { $metadata: {} };

    const shouldUpload = await shouldUploadFile(
      absoluteFilePath,
      s3Key,
      cacheControl,
      contentType,
      isMultipart,
      partSizeInBytes,
      contentLength,
      lastModified,
      criteria,
      metadata,
    );
    expect(shouldUpload).toBe(true);
  });

  describe('matching criteria', () => {
    const criteria = generateSyncCriteria(`
      ETag
      ContentType
      CacheControl
      LastModified
      ContentLength
    `);

    const metadata: HeadObjectCommandOutput = {
      $metadata: {},
      ETag: '"753b7861727f367c606aaaacb60dc4ab"',
      ContentType: contentType,
      CacheControl: cacheControl,
      LastModified: lastModified,
      ContentLength: contentLength,
    };

    it('should not upload if all criteria match', async () => {
      expect(
        await shouldUploadFile(
          absoluteFilePath,
          s3Key,
          cacheControl,
          contentType,
          isMultipart,
          partSizeInBytes,
          contentLength,
          lastModified,
          criteria,
          metadata,
        ),
      ).toBe(false);
    });

    it("should upload if ContentType doesn't match", async () => {
      expect(
        await shouldUploadFile(
          absoluteFilePath,
          s3Key,
          cacheControl,
          contentType,
          isMultipart,
          partSizeInBytes,
          contentLength,
          lastModified,
          criteria,
          {
            ...metadata,
            ContentType: 'text/xml',
          },
        ),
      ).toBe(true);
    });

    it("should upload if CacheControl doesn't match", async () => {
      expect(
        await shouldUploadFile(
          absoluteFilePath,
          s3Key,
          cacheControl,
          contentType,
          isMultipart,
          partSizeInBytes,
          contentLength,
          lastModified,
          criteria,
          {
            ...metadata,
            CacheControl: 'public',
          },
        ),
      ).toBe(true);
    });

    it("should upload if ContentLength doesn't match", async () => {
      expect(
        await shouldUploadFile(
          absoluteFilePath,
          s3Key,
          cacheControl,
          contentType,
          isMultipart,
          partSizeInBytes,
          contentLength,
          lastModified,
          criteria,
          {
            ...metadata,
            ContentLength: 2,
          },
        ),
      ).toBe(true);
    });

    it("should upload if LastModified doesn't match", async () => {
      const lastModifiedLocal = new Date(Date.now() + 1000); // local is newer
      const lastModifiedRemote = new Date();
      expect(
        await shouldUploadFile(
          absoluteFilePath,
          s3Key,
          cacheControl,
          contentType,
          isMultipart,
          partSizeInBytes,
          contentLength,
          lastModifiedLocal,
          criteria,
          {
            ...metadata,
            LastModified: lastModifiedRemote,
          },
        ),
      ).toBe(true);
    });

    it("should upload if ETag doesn't match", async () => {
      expect(
        await shouldUploadFile(
          absoluteFilePath,
          s3Key,
          cacheControl,
          contentType,
          isMultipart,
          partSizeInBytes,
          contentLength,
          lastModified,
          criteria,
          {
            ...metadata,
            ETag: '"1234"',
          },
        ),
      ).toBe(true);
    });
  });
});
