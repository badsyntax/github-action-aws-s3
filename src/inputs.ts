import { getInput } from '@actions/core';

export function getInputs() {
  const bucket = getInput('bucket', {
    required: true,
    trimWhitespace: true,
  });

  const region = getInput('awsRegion', {
    required: true,
    trimWhitespace: true,
  });

  const srcDir = getInput('srcDir', {
    required: true,
    trimWhitespace: true,
  });

  const prefix = getInput('prefix', {
    required: false,
    trimWhitespace: true,
  });

  const stripExtensionGlob = getInput('stripExtensionGlob', {
    required: false,
    trimWhitespace: true,
  });

  const action = getInput('action', {
    required: false,
    trimWhitespace: true,
  });

  const headers = getInput('headers', {
    required: false,
    trimWhitespace: true,
  });

  return {
    bucket,
    region,
    srcDir,
    prefix,
    stripExtensionGlob,
    action,
    headers,
  };
}
