import { setOutput } from '@actions/core';

export const workspace = process.env.GITHUB_WORKSPACE;

export function logOutputParameters(syncedFiles: string[]): void {
  setOutput('modified-keys', syncedFiles.join(','));
}
