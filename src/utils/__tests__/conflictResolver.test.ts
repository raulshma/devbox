/**
 * ConflictResolver Unit Tests
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ConflictResolver,
  ConflictStrategy,
  parseConflictStrategy,
  getAvailableStrategies,
  calculateChecksum,
  generateUniqueName,
} from '../conflictResolver.js';

describe('ConflictResolver', () => {
  let testDir: string;
  let resolver: ConflictResolver;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `conflict-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  describe('constructor and getStrategy', () => {
    it('should use default SKIP strategy', () => {
      const r = new ConflictResolver();
      expect(r.getStrategy()).toBe(ConflictStrategy.SKIP);
    });

    it('should accept custom strategy', () => {
      const r = new ConflictResolver({ strategy: ConflictStrategy.OVERWRITE });
      expect(r.getStrategy()).toBe(ConflictStrategy.OVERWRITE);
    });

    it('should accept all strategy types', () => {
      const strategies = [
        ConflictStrategy.SKIP,
        ConflictStrategy.OVERWRITE,
        ConflictStrategy.RENAME,
        ConflictStrategy.BACKUP,
        ConflictStrategy.NEWER,
        ConflictStrategy.OLDER,
      ];
      
      for (const strategy of strategies) {
        const r = new ConflictResolver({ strategy });
        expect(r.getStrategy()).toBe(strategy);
      }
    });
  });

  describe('updateOptions', () => {
    it('should update strategy', () => {
      resolver.updateOptions({ strategy: ConflictStrategy.OVERWRITE });
      expect(resolver.getStrategy()).toBe(ConflictStrategy.OVERWRITE);
    });
  });

  describe('hasConflict', () => {
    it('should return false for non-existent file', () => {
      const nonExistent = path.join(testDir, 'non-existent.txt');
      expect(resolver.hasConflict(nonExistent)).toBe(false);
    });

    it('should return true for existing file', async () => {
      const existingFile = path.join(testDir, 'existing.txt');
      await fs.writeFile(existingFile, 'content');
      expect(resolver.hasConflict(existingFile)).toBe(true);
    });
  });

  describe('detectConflict', () => {
    it('should return null when destination does not exist', async () => {
      const source = path.join(testDir, 'source-detect.txt');
      const dest = path.join(testDir, 'dest-nonexistent.txt');
      await fs.writeFile(source, 'source content');

      const result = await resolver.detectConflict(source, dest, 'copy');
      expect(result).toBeNull();
    });

    it('should detect conflict when destination exists', async () => {
      const source = path.join(testDir, 'source-conflict.txt');
      const dest = path.join(testDir, 'dest-conflict.txt');
      await fs.writeFile(source, 'source content');
      await fs.writeFile(dest, 'dest content');

      const result = await resolver.detectConflict(source, dest, 'copy');
      expect(result).not.toBeNull();
      expect(result?.source).toBe(source);
      expect(result?.destination).toBe(dest);
      expect(result?.operation).toBe('copy');
    });
  });

  describe('resolveConflict with SKIP strategy', () => {
    it('should skip conflicting files', async () => {
      const source = path.join(testDir, 'skip-source.txt');
      const dest = path.join(testDir, 'skip-dest.txt');
      await fs.writeFile(source, 'source');
      await fs.writeFile(dest, 'dest');

      const r = new ConflictResolver({ strategy: ConflictStrategy.SKIP });
      const conflict = await r.detectConflict(source, dest, 'copy');
      expect(conflict).not.toBeNull();

      const resolution = await r.resolveConflict(conflict!);
      expect(resolution.action).toBe('skip');
    });
  });

  describe('resolveConflict with OVERWRITE strategy', () => {
    it('should proceed with overwrite', async () => {
      const source = path.join(testDir, 'overwrite-source.txt');
      const dest = path.join(testDir, 'overwrite-dest.txt');
      await fs.writeFile(source, 'source');
      await fs.writeFile(dest, 'dest');

      const r = new ConflictResolver({ strategy: ConflictStrategy.OVERWRITE });
      const conflict = await r.detectConflict(source, dest, 'copy');
      expect(conflict).not.toBeNull();

      const resolution = await r.resolveConflict(conflict!);
      expect(resolution.action).toBe('proceed');
    });
  });

  describe('resolveConflict with RENAME strategy', () => {
    it('should provide new destination', async () => {
      const source = path.join(testDir, 'rename-source.txt');
      const dest = path.join(testDir, 'rename-dest.txt');
      await fs.writeFile(source, 'source');
      await fs.writeFile(dest, 'dest');

      const r = new ConflictResolver({ strategy: ConflictStrategy.RENAME });
      const conflict = await r.detectConflict(source, dest, 'copy');
      expect(conflict).not.toBeNull();

      const resolution = await r.resolveConflict(conflict!);
      expect(resolution.action).toBe('rename');
      expect(resolution.newDestination).toBeDefined();
      expect(resolution.newDestination).not.toBe(dest);
    });
  });
});

describe('parseConflictStrategy', () => {
  it('should parse valid strategy strings', () => {
    expect(parseConflictStrategy('skip')).toBe(ConflictStrategy.SKIP);
    expect(parseConflictStrategy('overwrite')).toBe(ConflictStrategy.OVERWRITE);
    expect(parseConflictStrategy('rename')).toBe(ConflictStrategy.RENAME);
    expect(parseConflictStrategy('backup')).toBe(ConflictStrategy.BACKUP);
    expect(parseConflictStrategy('newer')).toBe(ConflictStrategy.NEWER);
    expect(parseConflictStrategy('older')).toBe(ConflictStrategy.OLDER);
  });

  it('should be case-insensitive', () => {
    expect(parseConflictStrategy('SKIP')).toBe(ConflictStrategy.SKIP);
    expect(parseConflictStrategy('Skip')).toBe(ConflictStrategy.SKIP);
  });

  it('should return undefined for invalid strategies', () => {
    expect(parseConflictStrategy('invalid')).toBeUndefined();
    expect(parseConflictStrategy('')).toBeUndefined();
  });
});

describe('getAvailableStrategies', () => {
  it('should return all available strategies', () => {
    const strategies = getAvailableStrategies();
    expect(strategies).toContain('skip');
    expect(strategies).toContain('overwrite');
    expect(strategies).toContain('rename');
    expect(strategies).toContain('backup');
    expect(strategies.length).toBeGreaterThanOrEqual(4);
  });
});

describe('generateUniqueName', () => {
  it('should generate unique names with suffix', () => {
    const result = generateUniqueName('/path/to/file.txt', '_$n', 1);
    expect(result).toContain('_1');
    expect(result).toContain('.txt');
  });

  it('should handle multiple attempts', () => {
    const result1 = generateUniqueName('/path/to/file.txt', '_$n', 1);
    const result2 = generateUniqueName('/path/to/file.txt', '_$n', 2);
    expect(result1).not.toBe(result2);
  });
});

describe('calculateChecksum', () => {
  let testDir: string;
  
  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `checksum-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should calculate consistent checksum for same content', async () => {
    const file = path.join(testDir, 'checksum-test.txt');
    await fs.writeFile(file, 'test content');

    const checksum1 = await calculateChecksum(file);
    const checksum2 = await calculateChecksum(file);
    
    expect(checksum1).toBe(checksum2);
  });

  it('should calculate different checksums for different content', async () => {
    const file1 = path.join(testDir, 'checksum1.txt');
    const file2 = path.join(testDir, 'checksum2.txt');
    await fs.writeFile(file1, 'content 1');
    await fs.writeFile(file2, 'content 2');

    const checksum1 = await calculateChecksum(file1);
    const checksum2 = await calculateChecksum(file2);
    
    expect(checksum1).not.toBe(checksum2);
  });
});
