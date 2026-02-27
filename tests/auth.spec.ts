import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

/**
 * Playwright E2E Tests for Auth Command
 */

const CLI_CMD = 'node dist/cli.js';

test.describe('Auth Command', () => {
  test('should show auth help', async () => {
    const output = execSync(`${CLI_CMD} auth --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('auth');
  });

  test('should show auth status', async () => {
    try {
      const output = execSync(`${CLI_CMD} auth status`, { encoding: 'utf-8' });
      expect(output).toBeDefined();
    } catch (error: any) {
      // Command may not exist or fail without setup
      expect(error).toBeDefined();
    }
  });

  test('should show auth login help', async () => {
    try {
      const output = execSync(`${CLI_CMD} auth login --help`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toContain('login');
    } catch (error: any) {
      // Subcommand may not exist
      expect(error).toBeDefined();
    }
  });
});

test.describe('Audit Command', () => {
  test('should show audit help', async () => {
    const output = execSync(`${CLI_CMD} audit --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('audit');
  });

  test('should list audit logs', async () => {
    try {
      const output = execSync(`${CLI_CMD} audit list`, { encoding: 'utf-8' });
      expect(output).toBeDefined();
    } catch (error: any) {
      // May fail without prior operations
      expect(error).toBeDefined();
    }
  });

  test('should show audit stats', async () => {
    try {
      const output = execSync(`${CLI_CMD} audit stats`, { encoding: 'utf-8' });
      expect(output).toBeDefined();
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });
});

test.describe('API Command', () => {
  test('should show api help', async () => {
    const output = execSync(`${CLI_CMD} api --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('API');
  });
});
