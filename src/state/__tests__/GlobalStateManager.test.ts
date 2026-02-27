/**
 * GlobalStateManager Unit Tests
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('GlobalStateManager', () => {
  let testDir: string;
  let stateManager: any;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `state-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const module = await import('../GlobalStateManager.js');
    stateManager = new module.GlobalStateManager({
      stateDir: testDir,
      autoSave: false,
    });
    await stateManager.initialize();
  });

  afterEach(async () => {
    if (stateManager?.destroy) {
      await stateManager.destroy();
    }
  });

  describe('get and set', () => {
    it('should set and get values', async () => {
      await stateManager.set('testKey', 'testValue');
      const value = stateManager.get('testKey');
      expect(value).toBe('testValue');
    });

    it('should support dot notation', async () => {
      await stateManager.set('nested.key.value', 123);
      expect(stateManager.get('nested.key.value')).toBe(123);
    });

    it('should return undefined for non-existent keys', () => {
      expect(stateManager.get('non.existent.key')).toBeUndefined();
    });

    it('should handle various data types', async () => {
      await stateManager.set('string', 'test');
      await stateManager.set('number', 42);
      await stateManager.set('boolean', true);
      await stateManager.set('array', [1, 2, 3]);
      await stateManager.set('object', { key: 'value' });

      expect(stateManager.get('string')).toBe('test');
      expect(stateManager.get('number')).toBe(42);
      expect(stateManager.get('boolean')).toBe(true);
      expect(stateManager.get('array')).toEqual([1, 2, 3]);
      expect(stateManager.get('object')).toEqual({ key: 'value' });
    });
  });

  describe('has', () => {
    it('should return true for existing keys', async () => {
      await stateManager.set('exists', 'value');
      expect(stateManager.has('exists')).toBe(true);
    });

    it('should return false for non-existing keys', () => {
      expect(stateManager.has('nonexistent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing keys', async () => {
      await stateManager.set('toDelete', 'value');
      expect(stateManager.has('toDelete')).toBe(true);

      const result = await stateManager.delete('toDelete');
      
      expect(result).toBe(true);
      expect(stateManager.has('toDelete')).toBe(false);
    });

    it('should return false for non-existing keys', async () => {
      const result = await stateManager.delete('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('merge', () => {
    it('should merge partial state', async () => {
      await stateManager.set('existing', 'value');
      await stateManager.merge({
        newKey1: 'value1',
        newKey2: 'value2',
      });

      expect(stateManager.get('existing')).toBe('value');
      expect(stateManager.get('newKey1')).toBe('value1');
      expect(stateManager.get('newKey2')).toBe('value2');
    });
  });

  describe('keys', () => {
    it('should return all keys', async () => {
      await stateManager.set('key1', 'value1');
      await stateManager.set('key2', 'value2');
      await stateManager.set('key3', 'value3');

      const keys = stateManager.keys();
      
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should filter keys by pattern', async () => {
      await stateManager.set('test.key1', 'value1');
      await stateManager.set('test.key2', 'value2');
      await stateManager.set('other.key', 'value3');

      const keys = stateManager.keys('test.*');
      
      expect(keys).toContain('test.key1');
      expect(keys).toContain('test.key2');
      expect(keys).not.toContain('other.key');
    });
  });

  describe('createSnapshot and restoreSnapshot', () => {
    it('should create a snapshot', async () => {
      await stateManager.set('snapshot.key', 'value');
      
      const snapshot = stateManager.createSnapshot({ description: 'Test snapshot' });
      
      expect(snapshot.id).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.state).toBeDefined();
    });

    it('should restore from snapshot', async () => {
      await stateManager.set('restore.key', 'original');
      const snapshot = stateManager.createSnapshot();
      
      await stateManager.set('restore.key', 'modified');
      expect(stateManager.get('restore.key')).toBe('modified');

      await stateManager.restoreSnapshot(snapshot);
      expect(stateManager.get('restore.key')).toBe('original');
    });
  });

  describe('clear', () => {
    it('should clear all state', async () => {
      await stateManager.set('clear1', 'value1');
      await stateManager.set('clear2', 'value2');
      
      await stateManager.clear();
      
      expect(stateManager.get('clear1')).toBeUndefined();
      expect(stateManager.get('clear2')).toBeUndefined();
    });
  });

  describe('on and off (listeners)', () => {
    it('should register and call listeners', async () => {
      const listener = jest.fn();
      const unsubscribe = stateManager.on('listener.key', listener);

      await stateManager.set('listener.key', 'value');
      
      expect(listener).toHaveBeenCalled();
      unsubscribe();
    });

    it('should stop calling listeners after unsubscribe', async () => {
      const listener = jest.fn();
      const unsubscribe = stateManager.on('unsub.key', listener);
      
      unsubscribe();
      await stateManager.set('unsub.key', 'value');
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should return state statistics', async () => {
      await stateManager.set('stats.key1', 'value1');
      await stateManager.set('stats.key2', 'value2');

      const stats = stateManager.getStatistics();

      expect(stats.keyCount).toBeGreaterThanOrEqual(2);
      expect(typeof stats.approximateSize).toBe('number');
    });
  });

  describe('save', () => {
    it('should save state to file', async () => {
      await stateManager.set('save.key', 'save.value');
      const savePath = path.join(testDir, 'saved-state.json');
      
      await stateManager.save(savePath);
      
      const exists = await fs.access(savePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });
});
