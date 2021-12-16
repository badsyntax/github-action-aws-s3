import path from 'node:path';
import { describe, it, expect } from '@jest/globals';
import { getObjectKeyFromFilePath, getFilesFromSrcDir } from '../s3';

describe('getObjectKeyFromFilePath', () => {
  it('should generate the key', () => {
    const key = getObjectKeyFromFilePath(
      '/src/root',
      '/src/root/blog.html',
      '',
      ''
    );
    expect(key).toBe('blog.html');
  });

  it('should strip extension', () => {
    const keyWithoutExtension = getObjectKeyFromFilePath(
      '/src/root',
      '/src/root/blog.html',
      '',
      '**/*.html'
    );
    expect(keyWithoutExtension).toBe('blog');
  });

  it('should find files using srcDir and filesGlob', async () => {
    const srcDir = './out';
    const rootDir = path.join(path.resolve(process.cwd()), srcDir);
    const files = await getFilesFromSrcDir(srcDir, '**/*.html');
    expect(files).toEqual([`${rootDir}/blog.html`, `${rootDir}/index.html`]);
  });
});
