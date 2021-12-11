# AWS S3 GitHub Action

[![Sync S3](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/sync-s3.yml/badge.svg)](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/sync-s3.yml)

A GitHub Action to sync files to S3 based on contents hash.

## Motivation

The `aws cli` syncs files based on file modified times or file size. This approach is not ideal when syncing in CI or when build hashes might change but file size is unchanged.

This Action compares the md5 hash against the uploaded file, and if there's a match it will not sync the file. It also provides additional feature over the `aws cli`.

## Features

- Sync based on contents hash
- Bucket prefixes
- Clean an object path (remove a "directory")
- Custom cache-control headers
- Glob path patterns
- Custom ACL
- Automatic content-type detection
- Strip extension from filename

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

      - uses: badsyntax/github-action-aws-cloudformation@30e8484d108a13d803aa449c1ec1bd6aa4c932ff
        name: Update CloudFormation Stack
        id: update-stack
        with:
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          stackName: 'example-cloudformation-stack'
          template: './cloudformation/s3bucket-example.yml'
          applyChangeSet: ${{ github.event_name != 'repository_dispatch' }}
          awsRegion: 'us-east-1'
          parameters: 'S3BucketName=rexample-bucket-us-east-1&S3AllowedOrigins=https://example.com'

      - uses: badsyntax/github-action-aws-s3@v0.0.1
        name: Sync HTML files to S3
        id: sync-html-s3
        with:
          bucket: ${{ steps.update-stack.outputs.S3BucketName }}
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
          bucket: ${{ steps.update-stack.outputs.S3BucketName }}
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
