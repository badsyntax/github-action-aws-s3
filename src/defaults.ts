export const defaultConcurrency = 6;
export const defaultLargeFileSizeInMb = 100; // 100mb
export const defaultMultipartUploadPartsInBytes = 10 * (1024 * 1024); // 10mb

export const defaultSyncStrategy = `
  ETag
  ContentType
  CacheControl
  LastModified
  ContentLength
`;
