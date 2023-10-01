#!/usr/bin/env bash

env 'INPUT_BUCKET=badsyntax-github-action-example-aws-s3-us-east-1' \
    env 'INPUT_ACTION=sync' \
    env 'INPUT_FILES-GLOB={site-assets,css,img}/**/*' \
    env 'INPUT_SRC-DIR=./test-fixtures' \
    env 'INPUT_AWS-REGION=us-east-1' \
    env 'INPUT_PREFIX=preview' \
    env 'INPUT_CONCURRENCY=6' \
    env 'INPUT_MULTIPART-FILE-SIZE-MB=100' \
    env "INPUT_SYNC-STRATEGY=ETag" \
    env 'INPUT_CACHE-CONTROL=public,max-age=31536000,immutable' \
    GITHUB_EVENT_NAME="pull_request" \
    GITHUB_ACTION="synchronize" \
    GITHUB_REPOSITORY="badsyntax/github-action-aws-s3" \
    GITHUB_WORKSPACE="$(pwd)" \
    node dist/index.js
