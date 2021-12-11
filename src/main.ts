import { debug, info, setFailed } from '@actions/core';
import { S3Client } from '@aws-sdk/client-s3';

import { logOutputParameters } from './github.js';
import { getInputs } from './inputs.js';
import { emptyS3Directory, syncFilesToS3 } from './s3.js';

export async function run(): Promise<void> {
  try {
    const inputs = getInputs();

    debug(`Inputs:\n${JSON.stringify(inputs, null, 2)}`);

    const s3Client = new S3Client({
      region: inputs.region,
    });

    if (inputs.action == 'sync') {
      const syncedFiles = await syncFilesToS3(
        s3Client,
        inputs.bucket,
        inputs.srcGlob,
        inputs.prefix,
        inputs.stripExtensionGlob,
        inputs.cacheControl,
        inputs.acl
      );
      logOutputParameters(syncedFiles);
    } else if (inputs.action === 'clean') {
      const totalObjectsCleaned = await emptyS3Directory(
        s3Client,
        inputs.bucket,
        inputs.prefix
      );
      info(
        `Cleaned ${totalObjectsCleaned} from s3://${inputs.bucket}/${inputs.prefix}`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      setFailed(error.message);
    } else {
      setFailed('Unknown error');
    }
  }
}

void run();
