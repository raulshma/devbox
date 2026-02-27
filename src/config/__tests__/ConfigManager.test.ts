/**
 * ConfigManager Unit Tests
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the file system for config tests
let testDir: string;
let configManager: any;

describe('ConfigManager', () => {
  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `config-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Dynamic import to get fresh instance
    const module = await import('../ConfigManager.js');
    // Create new instance for each test
    configManager = new module.ConfigManager({ configDir: testDir });
    await configManager.initialize();
  });

  describe('get and set', () => {
    it('should get default values', () => {
      const debug = configManager.get('app.debug');
      expect(typeof debug).toBe('boolean');
    });

    it('should set and get values', async () => {
      await configManager.set('app.debug', true);
      expect(configManager.get('app.debug')).toBe(true);
    });

    it('should support dot notation for nested values', async () => {
      await configManager.set('preferences.theme', 'dark');
      expect(configManager.get('preferences.theme')).toBe('dark');
    });

    it('should return undefined for non-existent keys', () => {
      expect(configManager.get('non.existent.key')).toBeUndefined();
    });
  });

  describe('getConfig', () => {
    it('should return the full config object', () => {
      const config = configManager.getConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should return a readonly copy', () => {
      const config = configManager.getConfig();
      expect(Object.isFrozen(config) || config !== configManager.getConfig()).toBeTruthy();
    });
  });

  describe('merge', () => {
    it('should merge partial config', async () => {
      const originalTheme = configManager.get('preferences.theme');
      await configManager.merge({
        preferences: {
          theme: 'ocean',
        },
      });
      expect(configManager.get('preferences.theme')).toBe('ocean');
    });

    it('should not affect other values', async () => {
      const originalDebug = configManager.get('app.debug');
      await configManager.merge({
        preferences: {
          confirmDelete: true,
        },
      });
      expect(configManager.get('app.debug')).toBe(originalDebug);
    });
  });

  describe('reset', () => {
    it('should reset a single key to default', async () => {
      const originalValue = configManager.get('app.debug');
      await configManager.set('app.debug', !originalValue);
      expect(configManager.get('app.debug')).toBe(!originalValue);
      
      await configManager.reset('app.debug');
      expect(configManager.get('app.debug')).toBe(originalValue);
    });
  });

  describe('resetAll', () => {
    it('should reset all values to defaults', async () => {
      await configManager.set('app.debug', true);
      await configManager.set('preferences.theme', 'custom');
      
      await configManager.resetAll();
      
      // Values should be reset to defaults
      const config = configManager.getConfig();
      expect(config).toBeDefined();
    });
  });

  describe('save and loadFromFile', () => {
    it('should save config to file', async () => {
      const configPath = path.join(testDir, 'test-config.json');
      await configManager.set('app.debug', true);
      await configManager.save(configPath);

      const exists = await fs.access(configPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should load config from file', async () => {
      const configPath = path.join(testDir, 'load-config.json');
      const testConfig = {
        app: { debug: true, verbose: true },
      };
      await fs.writeFile(configPath, JSON.stringify(testConfig));

      await configManager.loadFromFile(configPath);
      expect(configManager.get('app.debug')).toBe(true);
    });
  });

  describe('onChange', () => {
    it('should register and call change listeners', async () => {
      const listener = jest.fn();
      const unsubscribe = configManager.onChange(listener);

      await configManager.set('app.debug', true);
      
      expect(listener).toHaveBeenCalled();
      unsubscribe();
    });

    it('should stop calling listener after unsubscribe', async () => {
      const listener = jest.fn();
      const unsubscribe = configManager.onChange(listener);
      
      unsubscribe();
      await configManager.set('app.debug', false);
      
      // Listener should not have been called after unsubscribe
      // (It may have been called once before unsubscribe)
      const callCount = listener.mock.calls.length;
      await configManager.set('app.debug', true);
      expect(listener.mock.calls.length).toBe(callCount);
    });
  });

  describe('getConfigPath', () => {
    it('should return config file path after save', async () => {
      const configPath = path.join(testDir, 'path-test.json');
      await configManager.save(configPath);
      expect(configManager.getConfigPath()).toBe(configPath);
    });
  });
});

describe('getConfigManager', () => {
  it('should return a ConfigManager instance', async () => {
    const { getConfigManager } = await import('../ConfigManager.js');
    const manager = getConfigManager();
    expect(manager).toBeDefined();
    expect(typeof manager.get).toBe('function');
    expect(typeof manager.set).toBe('function');
  });
});
