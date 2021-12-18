# AWS S3 GitHub Action

[![Build, Test & Deploy](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/build-test-deploy.yml/badge.svg?branch=master)](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/build-test-deploy.yml)
[![CodeQL](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/codeql-analysis.yml/badge.svg?branch=master)](https://github.com/badsyntax/github-action-aws-s3/actions/workflows/codeql-analysis.yml)

A GitHub Action to sync files to S3.

## Features

- Configurable sync strategy (with accurate ETAG comparisons, even for multipart uploads)
- Parallel uploads with configurable concurrency & multipart chunk sizes
- Bucket prefixes
- Clean an object path (remove a "directory")
- Custom Cache-Control headers
- Glob path patterns
- Custom ACL
- Automatic Content-Type detection
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
          aws-region: 'us-east-1'
          action: 'sync' # sync|clean
          src-dir: './out' # required only if action is sync
          files-glob: '**/*.html' # required only if action is sync
          prefix: 'preview'
          sync-strategy: |
            ETag
            Content-Type
            Cache-Control
          strip-extension-glob: '**/**.html'
          cache-control: 'public,max-age=0,s-maxage=31536000,must-revalidate'

      - name: Output Synced Files
        run: |
          echo "Synced object keys: $S3SyncedFiles"
        env:
          # Use outputs from previous sync steps
          S3SyncedFiles: ${{ steps.sync-html-s3.outputs.modified-keys }}
```

## Action Inputs

| Name                                | Description                                                                                                                                                                                                                      | Example                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `bucket`                            | The name of the S3 bucket                                                                                                                                                                                                        | `example-bucket-us-east-1`                    |
| `aws-region`                        | The AWS region                                                                                                                                                                                                                   | `us-east-1`                                   |
| `action`                            | The action to perform. Accepted values: `sync` or `clean`                                                                                                                                                                        | `sync`                                        |
| `src-dir`                           | Source directory of local files to sync (if using the sync action)                                                                                                                                                               | `./src`                                       |
| `files-glob`                        | Glob pattern for source files to sync to S3 (if using the sync action)                                                                                                                                                           | `**/*.html`                                   |
| `prefix` (optional)                 | The prefix for the uploaded object                                                                                                                                                                                               | `custom/folder`                               |
| `cache-control`                     | Cache-control header                                                                                                                                                                                                             | `public,max-age=31536000,immutable`           |
| `sync-strategy` (optional)          | A newline-separated list of criteria to define the sync strategy. Criteria values: `ETag`, `ContentType`, `CacheControl`, `LastModified`, `ContentLength`.<br/>**PLEASE NOTE** `ETag` cannot be used if your bucket is encrypted | `ETag`<br/>`Content-Type`<br/>`Cache-Control` |
| `strip-extension-glob` (optional)   | Glob pattern to strip extension (if using the sync action)                                                                                                                                                                       | `**/**.html`                                  |
| `acl` (optional)                    | Access control list (options: `authenticated-read, aws-exec-read, bucket-owner-full-control, bucket-owner-read, private, public-read, public-read-write`)                                                                        | `private`                                     |
| `multipart-file-size-mb` (optional) | The minimum file size, in megabytes, for which to upload files using multipart. The default is `100`                                                                                                                             | `100`                                         |
| `multipart-chunk-bytes` (optional)  | The chunk size, in bytes, to upload multipart file parts in. The default is `10485760` (10MB)                                                                                                                                    | `10485760`                                    |
| `concurrency` (optional)            | How many processes to perform at once. The default is `6`                                                                                                                                                                        | `6`                                           |

## Action Outputs

| Name            | Description                                                               | Example                   |
| --------------- | ------------------------------------------------------------------------- | ------------------------- |
| `modified-keys` | A comma separated list of modified object keys (either synced or removed) | `file1,folder1/file2.ext` |

## Debugging

Check the Action output for logs.

If you need to see more verbose logs you can set `ACTIONS_STEP_DEBUG` to `true` as an Action Secret.

## Related Projects

- [badsyntax/github-action-aws-cloudfront](https://github.com/badsyntax/github-action-aws-cloudfront)
- [badsyntax/github-action-aws-cloudformation](https://github.com/badsyntax/github-action-aws-cloudformation)
- [badsyntax/s3-etag](https://github.com/badsyntax/s3-etag)

## Motivation

The [`aws s3 sync`](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/sync.html) cli command syncs files based on modified times or file size, but this approach is not appropriate in situations where build hashes might change but file size is unchanged. This action provides a flexible and configuration sync strategy, as well as additional features like stripping file extensions and cleaning a bucket path.

## License

See [LICENSE.md](./LICENSE.md).
