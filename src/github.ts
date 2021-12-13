import { info } from '@actions/core';

export const workspace = process.env.GITHUB_WORKSPACE;

export function logOutputParameters(syncedFiles: string[]): void {
  info(`::set-output name=modifiedKeys::${syncedFiles.join(',')}`);
}
