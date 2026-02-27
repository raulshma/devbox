/**
 * ToolRegistry Unit Tests
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ToolRegistry', () => {
  let testDir: string;
  let toolRegistry: any;
  let ToolCategory: any;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `tool-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const module = await import('../ToolRegistry.js');
    const types = await import('../types.js');
    ToolCategory = types.ToolCategory;
    toolRegistry = new module.ToolRegistry({ stateDir: testDir });
  });

  afterEach(async () => {
    if (toolRegistry?.clearRegistry) {
      await toolRegistry.clearRegistry();
    }
  });

  describe('constructor', () => {
    it('should create with default config', async () => {
      const { ToolRegistry } = await import('../ToolRegistry.js');
      const registry = new ToolRegistry();
      expect(registry).toBeDefined();
    });

    it('should accept custom config', async () => {
      const { ToolRegistry } = await import('../ToolRegistry.js');
      const registry = new ToolRegistry({
        enablePersistence: false,
      });
      expect(registry).toBeDefined();
    });
  });

  describe('registerTool', () => {
    it('should register a valid tool', async () => {
      const tool = {
        id: 'test-tool',
        metadata: {
          name: 'Test Tool',
          version: '1.0.0',
          description: 'A test tool',
          category: ToolCategory?.FILE_SYSTEM || 'file-system',
        },
        execute: async () => ({ success: true }),
      };

      const result = await toolRegistry.registerTool(tool);
      expect(result.success).toBe(true);
    });

    it('should reject duplicate tool IDs', async () => {
      const tool = {
        id: 'duplicate-tool',
        metadata: {
          name: 'Duplicate Tool',
          version: '1.0.0',
          description: 'A duplicate tool',
          category: ToolCategory?.UTILITY || 'utility',
        },
        execute: async () => ({ success: true }),
      };

      await toolRegistry.registerTool(tool);
      const result = await toolRegistry.registerTool(tool);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already registered');
    });
  });

  describe('unregisterTool', () => {
    it('should unregister an existing tool', async () => {
      const tool = {
        id: 'to-unregister',
        metadata: {
          name: 'To Unregister',
          version: '1.0.0',
          description: 'Will be unregistered',
          category: ToolCategory?.UTILITY || 'utility',
        },
        execute: async () => ({ success: true }),
      };

      await toolRegistry.registerTool(tool);
      const result = await toolRegistry.unregisterTool('to-unregister');
      
      expect(result.success).toBe(true);
      expect(toolRegistry.hasTool('to-unregister')).toBe(false);
    });

    it('should fail for non-existent tool', async () => {
      const result = await toolRegistry.unregisterTool('non-existent');
      expect(result.success).toBe(false);
    });
  });

  describe('getTool', () => {
    it('should get a registered tool', async () => {
      const tool = {
        id: 'get-test',
        metadata: {
          name: 'Get Test',
          version: '1.0.0',
          description: 'For get test',
          category: ToolCategory?.UTILITY || 'utility',
        },
        execute: async () => ({ success: true }),
      };

      await toolRegistry.registerTool(tool);
      const retrieved = toolRegistry.getTool('get-test');
      
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe('get-test');
    });

    it('should return undefined for non-existent tool', () => {
      expect(toolRegistry.getTool('non-existent')).toBeUndefined();
    });
  });

  describe('hasTool', () => {
    it('should return true for registered tools', async () => {
      const tool = {
        id: 'has-test',
        metadata: {
          name: 'Has Test',
          version: '1.0.0',
          description: 'For has test',
          category: ToolCategory?.UTILITY || 'utility',
        },
        execute: async () => ({ success: true }),
      };

      await toolRegistry.registerTool(tool);
      expect(toolRegistry.hasTool('has-test')).toBe(true);
    });

    it('should return false for non-registered tools', () => {
      expect(toolRegistry.hasTool('non-existent')).toBe(false);
    });
  });

  describe('getAllTools', () => {
    it('should return all registered tools', async () => {
      const tool1 = {
        id: 'all-test-1',
        metadata: { name: 'Tool 1', version: '1.0.0', description: 'First', category: 'utility' },
        execute: async () => ({ success: true }),
      };
      const tool2 = {
        id: 'all-test-2',
        metadata: { name: 'Tool 2', version: '1.0.0', description: 'Second', category: 'utility' },
        execute: async () => ({ success: true }),
      };

      await toolRegistry.registerTool(tool1);
      await toolRegistry.registerTool(tool2);
      
      const tools = toolRegistry.getAllTools();
      expect(tools.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('searchTools', () => {
    beforeEach(async () => {
      const tools = [
        { id: 'search-1', metadata: { name: 'File Tool', version: '1.0.0', description: 'File operations', category: 'file-system' }, execute: async () => ({ success: true }) },
        { id: 'search-2', metadata: { name: 'Network Tool', version: '1.0.0', description: 'Network operations', category: 'network' }, execute: async () => ({ success: true }) },
      ];
      for (const tool of tools) {
        await toolRegistry.registerTool(tool);
      }
    });

    it('should search tools by name', () => {
      const results = toolRegistry.searchTools({ name: 'File' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should search tools by category', () => {
      const results = toolRegistry.searchTools({ category: 'file-system' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('executeTool', () => {
    it('should execute a tool', async () => {
      const tool = {
        id: 'exec-test',
        metadata: { name: 'Exec Test', version: '1.0.0', description: 'For execution', category: 'utility' },
        execute: async (ctx: any) => ({ success: true, result: 'executed' }),
      };

      await toolRegistry.registerTool(tool);
      const result = await toolRegistry.executeTool('exec-test', { args: {} });
      
      expect(result.success).toBe(true);
    });

    it('should fail for non-existent tool', async () => {
      const result = await toolRegistry.executeTool('non-existent', { args: {} });
      expect(result.success).toBe(false);
    });
  });

  describe('enableTool and disableTool', () => {
    it('should disable and enable tools', async () => {
      const tool = {
        id: 'toggle-test',
        metadata: { name: 'Toggle Test', version: '1.0.0', description: 'For toggle', category: 'utility' },
        execute: async () => ({ success: true }),
      };

      await toolRegistry.registerTool(tool);
      
      const disableResult = await toolRegistry.disableTool('toggle-test');
      expect(disableResult.success).toBe(true);
      
      const enableResult = await toolRegistry.enableTool('toggle-test');
      expect(enableResult.success).toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('should return registry statistics', async () => {
      const stats = toolRegistry.getStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalTools).toBe('number');
      expect(typeof stats.enabledTools).toBe('number');
    });
  });

  describe('validateToolMetadata', () => {
    it('should validate valid metadata', () => {
      const metadata = {
        name: 'Valid Tool',
        version: '1.0.0',
        description: 'A valid tool',
        category: 'utility',
      };

      const result = toolRegistry.validateToolMetadata(metadata);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid metadata', () => {
      const metadata = {
        name: '', // Empty name
        version: '1.0.0',
      };

      const result = toolRegistry.validateToolMetadata(metadata);
      expect(result.valid).toBe(false);
    });
  });
});
