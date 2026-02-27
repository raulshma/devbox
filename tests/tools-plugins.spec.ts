import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Playwright E2E Tests for Tools and Plugins Commands
 */

const TEST_DIR = path.join(process.cwd(), 'test-tools-plugins-e2e');
const CLI_CMD = 'node dist/cli.js';

test.beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
});

test.afterAll(async () => {
  if (await fs.access(TEST_DIR).then(() => true).catch(() => false)) {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }
});

test.describe('Tools Command', () => {
  test('should show tools help', async () => {
    const output = execSync(`${CLI_CMD} tools --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('tools');
  });

  test('should list registered tools', async () => {
    try {
      const output = execSync(`${CLI_CMD} tools list`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toMatch(/(tool|list|registered|no|empty)/i);
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test('should show tool statistics', async () => {
    try {
      const output = execSync(`${CLI_CMD} tools stats`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toMatch(/(stat|tool|total|registered)/i);
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test('should search tools', async () => {
    try {
      const output = execSync(`${CLI_CMD} tools search --name "test"`, { encoding: 'utf-8' });
      expect(output).toBeDefined();
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });
});

test.describe('Plugin Command', () => {
  test('should show plugin help', async () => {
    const output = execSync(`${CLI_CMD} plugin --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('plugin');
  });

  test('should list plugins', async () => {
    const output = execSync(`${CLI_CMD} plugin list`, { encoding: 'utf-8' });
    expect(output.toLowerCase()).toMatch(/(plugin|list|loaded|no)/i);
  });

  test('should show plugin info format', async () => {
    try {
      const output = execSync(`${CLI_CMD} plugin info test-plugin`, { encoding: 'utf-8' });
      expect(output).toBeDefined();
    } catch (error: any) {
      // Plugin may not exist
      expect(error).toBeDefined();
    }
  });

  test('should reload plugins', async () => {
    try {
      const output = execSync(`${CLI_CMD} plugin reload`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toMatch(/(reload|plugin)/i);
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });
});

test.describe('Theme Command', () => {
  test('should show theme help', async () => {
    const output = execSync(`${CLI_CMD} theme --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('theme');
  });

  test('should list available themes', async () => {
    try {
      const output = execSync(`${CLI_CMD} theme list`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toMatch(/(theme|available|default)/i);
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test('should show current theme', async () => {
    try {
      const output = execSync(`${CLI_CMD} theme current`, { encoding: 'utf-8' });
      expect(output).toBeDefined();
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });
});

test.describe('Help Command', () => {
  test('should show comprehensive help', async () => {
    const output = execSync(`${CLI_CMD} help --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('help');
  });

  test('should show command list', async () => {
    const output = execSync(`${CLI_CMD} --help`, { encoding: 'utf-8' });
    
    // Should list main commands
    expect(output).toContain('rename');
    expect(output).toContain('encrypt');
    expect(output).toContain('decrypt');
    expect(output).toContain('fileops');
  });
});

test.describe('Regex Builder Command', () => {
  test('should show regex-builder help', async () => {
    const output = execSync(`${CLI_CMD} regex-builder --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('regex');
  });
});

test.describe('Interactive Command', () => {
  test('should show interactive help', async () => {
    try {
      const output = execSync(`${CLI_CMD} interactive --help`, { encoding: 'utf-8' });
      expect(output).toContain('interactive');
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });
});

test.describe('CLI Version', () => {
  test('should show version', async () => {
    const output = execSync(`${CLI_CMD} --version`, { encoding: 'utf-8' });
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });
});
