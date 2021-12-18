import { getInput } from '@actions/core';

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

  const multipartFileSizeMb = Number(
    getInput('multipart-file-size-mb', {
      required: false,
      trimWhitespace: true,
    })
  );

  const multipartChunkBytes = Number(
    getInput('multipart-chunk-bytes', {
      required: false,
      trimWhitespace: true,
    })
  );

  const concurrency = Number(
    getInput('concurrency', {
      required: false,
      trimWhitespace: true,
    })
  );

  const syncStrategy = getInput('sync-strategy', {
    required: false,
    trimWhitespace: true,
  });

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
