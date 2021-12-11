import { info } from '@actions/core';

export function logOutputParameters(syncedFiles: string[]): void {
  info(`::set-output name=S3SyncedFiles::${syncedFiles.join(',')}`);
}
