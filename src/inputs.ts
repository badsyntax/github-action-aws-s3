import { getInput } from '@actions/core';
import {
  defaultConcurrency,
  defaultLargeFileSizeInMb,
  defaultMultipartUploadPartsInBytes,
  defaultSyncStrategy,
} from './defaults.js';

export function getInputs() {
  const bucket = getInput('bucket', {
    required: true,
    trimWhitespace: true,
  });

  const region = getInput('aws-region', {
    required: true,
    trimWhitespace: true,
  });

  const srcDir = getInput('src-dir', {
    required: true,
    trimWhitespace: true,
  });

  const filesGlob = getInput('files-glob', {
    required: true,
    trimWhitespace: true,
  });

  const prefix = getInput('prefix', {
    required: false,
    trimWhitespace: true,
  });

  const stripExtensionGlob = getInput('strip-extension-glob', {
    required: false,
    trimWhitespace: true,
  });

  const action = getInput('action', {
    required: false,
    trimWhitespace: true,
  });

  const cacheControl = getInput('cache-control', {
    required: false,
    trimWhitespace: true,
  });

  const acl = getInput('acl', {
    required: false,
    trimWhitespace: true,
  });

  const _multipartFileSizeMb = parseInt(
    getInput('multipart-file-size-mb', {
      required: false,
      trimWhitespace: true,
    }),
    10
  );

  const multipartFileSizeMb = isNaN(_multipartFileSizeMb)
    ? defaultLargeFileSizeInMb
    : _multipartFileSizeMb;

  const _multipartChunkBytes = parseInt(
    getInput('multipart-chunk-bytes', {
      required: false,
      trimWhitespace: true,
    }),
    10
  );

  const multipartChunkBytes = isNaN(_multipartChunkBytes)
    ? defaultMultipartUploadPartsInBytes
    : _multipartFileSizeMb;

  const _concurrency = parseInt(
    getInput('concurrency', {
      required: false,
      trimWhitespace: true,
    })
  );

  const concurrency = isNaN(_concurrency) ? defaultConcurrency : _concurrency;

  const syncStrategy =
    getInput('sync-strategy', {
      required: false,
      trimWhitespace: true,
    }) || defaultSyncStrategy;

  return {
    bucket,
    region,
    srcDir,
    filesGlob,
    prefix,
    stripExtensionGlob,
    action,
    cacheControl,
    acl,
    multipartFileSizeMb,
    multipartChunkBytes,
    concurrency,
    syncStrategy,
  };
}
