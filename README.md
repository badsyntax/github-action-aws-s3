# AWS S3 GitHub Action

An intelligent S3 sync action that syncs purely based on contents hash.

## Motivation

The aws cli syncs based on modified times or file size. These two approaches causes problems when syncing from different environments like in CI, or when build hashes might change but the file size is unchanged.

This Action compares the md5 hash against the uploaded file, and if there's a match it will not sync the file.

## Getting Started

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
        name: Sync to S3
        id: sync-s3
        with:
          bucket: 'example-bucket-us-east-1'
          action: 'sync' # sync|clean
          srcDir: './out' # required only if action is sync
          awsRegion: 'us-east-1'
          prefix: 'custom/folder'
          stripExtensionGlob: '**/**.html' # required only if action is sync

      - name: Output Synced Files
        run: |
          echo "Synced Files: $S3SyncedFiles"
        env:
          # Use outputs from the S3 step
          S3SyncedFiles: ${{ steps.sync-s3.outputs.S3SyncedFiles }}
```

## Debugging

Check the Action output for logs.

If you need to see more verbose logs you can set `ACTIONS_STEP_DEBUG` to `true` as an Action Secret.

## License

See [LICENSE.md](./LICENSE.md).
