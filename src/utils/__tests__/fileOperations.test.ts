/**
 * FileOperations Unit Tests
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  copy,
  move,
  deletePath,
  copyMultiple,
  moveMultiple,
  deleteMultiple,
  captureMetadata,
  globToRegex,
  matchesFilter,
} from '../fileOperations.js';

describe('FileOperations', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `fileops-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('copy', () => {
    it('should copy a single file', async () => {
      const source = path.join(testDir, 'copy-source.txt');
      const dest = path.join(testDir, 'copy-dest.txt');
      await fs.writeFile(source, 'copy content');

      const result = await copy(source, dest);

      expect(result.success).toBe(true);
      const destContent = await fs.readFile(dest, 'utf-8');
      expect(destContent).toBe('copy content');
    });

    it('should copy a directory recursively', async () => {
      const sourceDir = path.join(testDir, 'copy-source-dir');
      const destDir = path.join(testDir, 'copy-dest-dir');
      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(sourceDir, 'subdir'), { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'subdir', 'file3.txt'), 'content3');

      const result = await copy(sourceDir, destDir, { recursive: true });

      expect(result.success).toBe(true);
      const file1 = await fs.readFile(path.join(destDir, 'file1.txt'), 'utf-8');
      const file3 = await fs.readFile(path.join(destDir, 'subdir', 'file3.txt'), 'utf-8');
      expect(file1).toBe('content1');
      expect(file3).toBe('content3');
    });

    it('should skip existing files by default', async () => {
      const source = path.join(testDir, 'skip-source.txt');
      const dest = path.join(testDir, 'skip-dest.txt');
      await fs.writeFile(source, 'new content');
      await fs.writeFile(dest, 'existing content');

      const result = await copy(source, dest);

      // Should skip by default
      const destContent = await fs.readFile(dest, 'utf-8');
      expect(destContent).toBe('existing content');
    });

    it('should overwrite when option is set', async () => {
      const source = path.join(testDir, 'overwrite-source.txt');
      const dest = path.join(testDir, 'overwrite-dest.txt');
      await fs.writeFile(source, 'new content');
      await fs.writeFile(dest, 'existing content');

      const result = await copy(source, dest, { overwrite: true });

      expect(result.success).toBe(true);
      const destContent = await fs.readFile(dest, 'utf-8');
      expect(destContent).toBe('new content');
    });

    it('should filter files by pattern', async () => {
      const sourceDir = path.join(testDir, 'filter-source');
      const destDir = path.join(testDir, 'filter-dest');
      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'file.txt'), 'txt');
      await fs.writeFile(path.join(sourceDir, 'file.js'), 'js');
      await fs.writeFile(path.join(sourceDir, 'file.ts'), 'ts');

      await copy(sourceDir, destDir, { filter: '*.txt', recursive: true });

      const files = await fs.readdir(destDir);
      expect(files).toContain('file.txt');
    });
  });

  describe('move', () => {
    it('should move a file', async () => {
      const source = path.join(testDir, 'move-source.txt');
      const dest = path.join(testDir, 'move-dest.txt');
      await fs.writeFile(source, 'move content');

      const result = await move(source, dest);

      expect(result.success).toBe(true);
      const destContent = await fs.readFile(dest, 'utf-8');
      expect(destContent).toBe('move content');

      // Source should not exist
      const sourceExists = await fs.access(source).then(() => true).catch(() => false);
      expect(sourceExists).toBe(false);
    });

    it('should fail for non-existent source', async () => {
      const result = await move(
        path.join(testDir, 'non-existent.txt'),
        path.join(testDir, 'dest.txt')
      );

      expect(result.success).toBe(false);
    });
  });

  describe('deletePath', () => {
    it('should delete a file', async () => {
      const file = path.join(testDir, 'delete-file.txt');
      await fs.writeFile(file, 'to delete');

      const result = await deletePath(file);

      expect(result.success).toBe(true);
      const exists = await fs.access(file).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should delete a directory recursively', async () => {
      const dir = path.join(testDir, 'delete-dir');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'file.txt'), 'content');

      const result = await deletePath(dir, { recursive: true });

      expect(result.success).toBe(true);
      const exists = await fs.access(dir).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should handle non-existent paths', async () => {
      const result = await deletePath(path.join(testDir, 'non-existent'));
      // Should not fail for non-existent paths when force is used
      expect(result).toBeDefined();
    });
  });

  describe('copyMultiple', () => {
    it('should copy multiple files', async () => {
      const source1 = path.join(testDir, 'multi1.txt');
      const source2 = path.join(testDir, 'multi2.txt');
      const dest1 = path.join(testDir, 'multi1-copy.txt');
      const dest2 = path.join(testDir, 'multi2-copy.txt');
      await fs.writeFile(source1, 'content1');
      await fs.writeFile(source2, 'content2');

      const results = await copyMultiple([
        { source: source1, destination: dest1 },
        { source: source2, destination: dest2 },
      ]);

      expect(results.length).toBe(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('deleteMultiple', () => {
    it('should delete multiple files', async () => {
      const file1 = path.join(testDir, 'del-multi1.txt');
      const file2 = path.join(testDir, 'del-multi2.txt');
      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');

      const results = await deleteMultiple([file1, file2]);

      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('captureMetadata', () => {
    it('should capture file metadata', async () => {
      const file = path.join(testDir, 'metadata-file.txt');
      await fs.writeFile(file, 'content');

      const metadata = await captureMetadata(file);

      expect(metadata.mode).toBeDefined();
      expect(metadata.mtime).toBeInstanceOf(Date);
      expect(metadata.isDirectory).toBe(false);
    });

    it('should identify directories', async () => {
      const dir = path.join(testDir, 'metadata-dir');
      await fs.mkdir(dir, { recursive: true });

      const metadata = await captureMetadata(dir);

      expect(metadata.isDirectory).toBe(true);
    });
  });

  describe('globToRegex', () => {
    it('should convert * wildcard', () => {
      const regex = globToRegex('*.txt');
      expect(regex.test('file.txt')).toBe(true);
      expect(regex.test('file.js')).toBe(false);
    });

    it('should convert ? wildcard', () => {
      const regex = globToRegex('file?.txt');
      expect(regex.test('file1.txt')).toBe(true);
      expect(regex.test('file12.txt')).toBe(false);
    });

    it('should handle multiple wildcards', () => {
      const regex = globToRegex('*.test.*');
      expect(regex.test('app.test.js')).toBe(true);
      expect(regex.test('app.spec.js')).toBe(false);
    });
  });

  describe('matchesFilter', () => {
    it('should match file against filter', () => {
      const options = { filter: '*.txt' };
      expect(matchesFilter('file.txt', options, testDir)).toBe(true);
      expect(matchesFilter('file.js', options, testDir)).toBe(false);
    });

    it('should match with array filter', () => {
      const options = { filter: ['*.txt', '*.md'] };
      expect(matchesFilter('readme.md', options, testDir)).toBe(true);
    });
  });
});
