/**
 * PluginManager Unit Tests
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

describe('PluginManager', () => {
  let testDir: string;
  let pluginManager: any;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `plugin-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a test plugins directory
    await fs.mkdir(path.join(testDir, 'plugins'), { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const module = await import('../PluginManager.js');
    const context = {
      version: '1.0.0',
      debug: false,
    };
    pluginManager = new module.PluginManager(
      {
        pluginDirs: [path.join(testDir, 'plugins')],
        enableBuiltIn: false,
      },
      context
    );
  });

  describe('constructor', () => {
    it('should create with config and context', async () => {
      const { PluginManager } = await import('../PluginManager.js');
      const pm = new PluginManager(
        { pluginDirs: [testDir], enableBuiltIn: false },
        { version: '1.0.0', debug: false }
      );
      expect(pm).toBeDefined();
    });
  });

  describe('discoverPlugins', () => {
    it('should discover plugins in directories', async () => {
      const plugins = await pluginManager.discoverPlugins();
      expect(Array.isArray(plugins)).toBe(true);
    });

    it('should return empty array for empty directory', async () => {
      const plugins = await pluginManager.discoverPlugins();
      expect(plugins.length).toBe(0);
    });
  });

  describe('loadPlugin', () => {
    beforeEach(async () => {
      // Create a simple test plugin
      const pluginDir = path.join(testDir, 'plugins', 'test-plugin');
      await fs.mkdir(pluginDir, { recursive: true });
      
      const manifest = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        main: 'index.js',
      };
      await fs.writeFile(
        path.join(pluginDir, 'package.json'),
        JSON.stringify(manifest)
      );
      
      const indexContent = `
        module.exports = {
          id: 'test-plugin',
          name: 'Test Plugin',
          version: '1.0.0',
          initialize: async () => {},
        };
      `;
      await fs.writeFile(path.join(pluginDir, 'index.js'), indexContent);
    });

    it('should load a valid plugin', async () => {
      const pluginPath = path.join(testDir, 'plugins', 'test-plugin');
      const result = await pluginManager.loadPlugin(pluginPath);
      
      expect(result).toBeDefined();
      expect(result.pluginId).toBe('test-plugin');
    });

    it('should return error for non-existent plugin', async () => {
      const result = await pluginManager.loadPlugin('/non/existent/path');
      expect(result.success).toBe(false);
    });
  });

  describe('getLoadedPlugins', () => {
    it('should return array of loaded plugins', () => {
      const plugins = pluginManager.getLoadedPlugins();
      expect(Array.isArray(plugins)).toBe(true);
    });
  });

  describe('hasPlugin', () => {
    it('should return false for unloaded plugins', () => {
      expect(pluginManager.hasPlugin('non-existent')).toBe(false);
    });
  });

  describe('getPlugin', () => {
    it('should return undefined for non-existent plugin', () => {
      expect(pluginManager.getPlugin('non-existent')).toBeUndefined();
    });
  });

  describe('validateManifest', () => {
    it('should validate a valid manifest', () => {
      const manifest = {
        id: 'valid-plugin',
        name: 'Valid Plugin',
        version: '1.0.0',
      };

      const result = pluginManager.validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject manifest without id', () => {
      const manifest = {
        name: 'Invalid Plugin',
        version: '1.0.0',
      };

      const result = pluginManager.validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject manifest without name', () => {
      const manifest = {
        id: 'invalid-plugin',
        version: '1.0.0',
      };

      const result = pluginManager.validateManifest(manifest);
      expect(result.valid).toBe(false);
    });

    it('should reject manifest without version', () => {
      const manifest = {
        id: 'invalid-plugin',
        name: 'Invalid Plugin',
      };

      const result = pluginManager.validateManifest(manifest);
      expect(result.valid).toBe(false);
    });
  });

  describe('registerCommands', () => {
    it('should register commands with a program', () => {
      const program = new Command();
      expect(() => pluginManager.registerCommands(program)).not.toThrow();
    });
  });

  describe('executeHook', () => {
    it('should execute hooks without errors', async () => {
      await expect(
        pluginManager.executeHook('beforeCommand', 'test', {})
      ).resolves.not.toThrow();
    });
  });

  describe('unloadPlugin', () => {
    it('should return false for non-existent plugin', async () => {
      const result = await pluginManager.unloadPlugin('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('reloadAllPlugins', () => {
    it('should reload all plugins', async () => {
      const results = await pluginManager.reloadAllPlugins();
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
