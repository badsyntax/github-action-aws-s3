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

  const srcGlob = getInput('srcGlob', {
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

  const cacheControl = getInput('cacheControl', {
    required: false,
    trimWhitespace: true,
  });

  const acl = getInput('acl', {
    required: false,
    trimWhitespace: true,
  });

  return {
    bucket,
    region,
    srcGlob,
    prefix,
    stripExtensionGlob,
    action,
    cacheControl,
    acl,
  };
}
