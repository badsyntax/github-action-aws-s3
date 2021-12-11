# AWS S3 GitHub Action

[![Sync S3](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/sync-s3.yml/badge.svg)](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/sync-s3.yml)

An intelligent S3 sync action that syncs based on contents hash.

## Motivation

The aws cli syncs based on modified times or file size. These two approaches causes problems when syncing from different environments like in CI, or when build hashes might change but the file size is unchanged.

This Action compares the md5 hash against the uploaded file, and if there's a match it will not sync the file.

## Features

- Sync based on contents hash
- Supports prefixes
- Supports cleaning an object path
- Custom cache-control headers
- Custom ACL

## Getting Started

Please read: <https://github.com/aws-actions/configure-aws-credentials#credentials>

```yml
name: 'Sync S3'

concurrency:
  group: prod_deploy
  cancel-in-progress: false

on:
  repository_dispatch:
  workflow_dispatch:
  push:
    branches:
      - main

jobs:
  deploy:
    name: 'Sync'
    runs-on: ubuntu-20.04
    steps:
      - uses: actions/checkout@v2
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - uses: badsyntax/github-action-aws-s3@v0.0.1
        name: Sync HTML files to S3
        id: sync-html-s3
        with:
          bucket: 'richardwillis.info-example-bucket-us-east-1'
          action: 'sync' # sync|clean
          srcGlob: './out/**/*.html' # required only if action is sync
          awsRegion: 'us-east-1'
          prefix: 'preview'
          stripExtensionGlob: '**/**.html'
          cacheControl: 'public,max-age=0,s-maxage=31536000,must-revalidate'

      - uses: badsyntax/github-action-aws-s3@v0.0.1
        name: Sync immutable files to S3
        id: sync-immutable-s3
        with:
          bucket: 'richardwillis.info-example-bucket-us-east-1'
          action: 'sync' # sync|clean
          srcGlob: './out/css/**' # required only if action is sync
          awsRegion: 'us-east-1'
          prefix: 'preview'
          cacheControl: 'public,max-age=31536000,immutable'

      - name: Output Synced Files
        run: |
          echo "Synced HTML Files: $S3SyncedHTMLFiles"
          echo "Synced Immutable Files: $S3SyncedImmutableFiles"
        env:
          # Use outputs from previous sync steps
          S3SyncedHTMLFiles: ${{ steps.sync-html-s3.outputs.S3SyncedFiles }}
          S3SyncedImmutableFiles: ${{ steps.sync-immutable-s3.outputs.S3SyncedFiles }}
```

## Debugging

Check the Action output for logs.

If you need to see more verbose logs you can set `ACTIONS_STEP_DEBUG` to `true` as an Action Secret.

## License

See [LICENSE.md](./LICENSE.md).
