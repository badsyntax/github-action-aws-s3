# AWS S3 GitHub Action

[![Build & Test](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/test.yml/badge.svg)](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/test.yml)
[![Sync S3](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/sync-s3.yml/badge.svg)](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/sync-s3.yml)
[![CodeQL](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/codeql-analysis.yml)

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

      - uses: badsyntax/github-action-aws-s3@v0.0.1
        name: Sync HTML files to S3
        id: sync-html-s3
        with:
          bucket: ${{ steps.update-stack.outputs.S3BucketName }}
          action: 'sync' # sync|clean
          srcDir: './out' # required only if action is sync
          filesGlob: '**/*.html' # required only if action is sync
          awsRegion: 'us-east-1'
          prefix: 'preview'
          stripExtensionGlob: '**/**.html'
          cacheControl: 'public,max-age=0,s-maxage=31536000,must-revalidate'

      - name: Output Synced Files
        run: |
          echo "Synced object keys: $S3SyncedFiles"
        env:
          # Use outputs from previous sync steps
          S3SyncedFiles: ${{ steps.sync-html-s3.outputs.modifiedKeys }}
```

## Action Inputs

| Name                            | Description                                                                                                                                               | Example                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `bucket`                        | The name of the S3 bucket                                                                                                                                 | `example-bucket-us-east-1`          |
| `action`                        | The action to perform. Accepted values: `sync` or `clean`                                                                                                 | `sync`                              |
| `srcDir`                        | Source directory of local files to sync (if using the sync action)                                                                                        | `./src`                             |
| `filesGlob`                     | Glob pattern for source files to sync to S3 (if using the sync action)                                                                                    | `**/*.html`                         |
| `awsRegion`                     | The AWS region                                                                                                                                            | `us-east-1`                         |
| `cacheControl`                  | Cache-control headers                                                                                                                                     | `public,max-age=31536000,immutable` |
| `prefix` (optional)             | The prefix for the uploaded object                                                                                                                        | `custom/folder`                     |
| `stripExtensionGlob` (optional) | Glob pattern to strip extension (if using the sync action)                                                                                                | `**/**.html`                        |
| `acl` (optional)                | Access control list (options: `authenticated-read, aws-exec-read, bucket-owner-full-control, bucket-owner-read, private, public-read, public-read-write`) | `private`                           |

## Action Outputs

| Name           | Description                                                               | Example                   |
| -------------- | ------------------------------------------------------------------------- | ------------------------- |
| `modifiedKeys` | A comma separated list of modified object keys (either synced or removed) | `file1,folder1/file2.ext` |

## Related GitHub Actions

- [badsyntax/github-action-aws-cloudfront](https://github.com/badsyntax/github-action-aws-cloudfront)
- [badsyntax/github-action-aws-cloudformation](https://github.com/badsyntax/github-action-aws-cloudformation)

## Debugging

Check the Action output for logs.

If you need to see more verbose logs you can set `ACTIONS_STEP_DEBUG` to `true` as an Action Secret.

## License

See [LICENSE.md](./LICENSE.md).
