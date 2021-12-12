#!/usr/bin/env bash

INPUT_BUCKET="richardwillis.info-example-bucket-us-east-1" \
    INPUT_ACTION="sync" \
    INPUT_SRCGLOB="./out/css/**" \
    INPUT_AWSREGION="us-east-1" \
    INPUT_PREFIX="preview" \
    INPUT_CACHECONTROL="public,max-age=31536000,immutable" \
    GITHUB_EVENT_NAME="pull_request" \
    GITHUB_ACTION="synchronize" \
    GITHUB_REPOSITORY="badsyntax/github-action-aws-s3" \
    GITHUB_WORKSPACE=$(pwd) \
    node lib/main.js
