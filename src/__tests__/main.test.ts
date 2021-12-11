import { describe, it, expect } from '@jest/globals';
import { getObjectKeyFromFilePath } from '../s3';

describe('getObjectKeyFromFilePath', () => {
  it('should correctly generate the key', () => {
    const objectKeyWithoutExtension = getObjectKeyFromFilePath(
      '/src/root',
      '/src/root/blog.html',
      '',
      ''
    );
    expect(objectKeyWithoutExtension).toBe('blog.html');
  });

  it('should strip extension', () => {
    const objectKeyWithoutExtension = getObjectKeyFromFilePath(
      '/src/root',
      '/src/root/blog.html',
      '',
      '**/*.html'
    );
    expect(objectKeyWithoutExtension).toBe('blog');
  });
});
