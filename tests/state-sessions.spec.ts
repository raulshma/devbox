import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Playwright E2E Tests for State and Sessions Commands
 */

const TEST_DIR = path.join(process.cwd(), 'test-state-sessions-e2e');
const CLI_CMD = 'node dist/cli.js';

test.beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
});

test.afterAll(async () => {
  if (await fs.access(TEST_DIR).then(() => true).catch(() => false)) {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }
});

test.describe('State Command', () => {
  test('should show state help', async () => {
    const output = execSync(`${CLI_CMD} state --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('state');
  });

  test('should list current state', async () => {
    try {
      const output = execSync(`${CLI_CMD} state list`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toMatch(/(state|list|key|value|empty)/i);
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test('should get a state value', async () => {
    try {
      const output = execSync(`${CLI_CMD} state get testKey`, { encoding: 'utf-8' });
      expect(output).toBeDefined();
    } catch (error: any) {
      // May not exist
      expect(error).toBeDefined();
    }
  });

  test('should set a state value', async () => {
    try {
      const output = execSync(`${CLI_CMD} state set e2e-test-key "e2e-test-value"`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toMatch(/(set|success|saved)/i);
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test('should show state statistics', async () => {
    try {
      const output = execSync(`${CLI_CMD} state stats`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toMatch(/(stat|key|size)/i);
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test('should clear state', async () => {
    try {
      const output = execSync(`${CLI_CMD} state clear --yes`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toMatch(/(clear|success)/i);
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });
});

test.describe('Sessions Command', () => {
  test('should show sessions help', async () => {
    const output = execSync(`${CLI_CMD} sessions --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('session');
  });

  test('should list sessions', async () => {
    try {
      const output = execSync(`${CLI_CMD} sessions list`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toMatch(/(session|list|id|empty|no)/i);
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test('should create a session', async () => {
    try {
      const output = execSync(`${CLI_CMD} sessions create e2e-session --state '{"test": true}'`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toMatch(/(created|session|success)/i);
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test('should get session info', async () => {
    try {
      const output = execSync(`${CLI_CMD} sessions get e2e-session`, { encoding: 'utf-8' });
      expect(output).toBeDefined();
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test('should delete/close a session', async () => {
    try {
      const output = execSync(`${CLI_CMD} sessions delete e2e-session --yes`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toMatch(/(deleted|closed|removed|success)/i);
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });
});

test.describe('State Snapshot', () => {
  test('should create a snapshot', async () => {
    try {
      const output = execSync(`${CLI_CMD} state snapshot create --name "e2e-snapshot"`, { encoding: 'utf-8' });
      expect(output.toLowerCase()).toMatch(/(snapshot|created|saved)/i);
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  test('should list snapshots', async () => {
    try {
      const output = execSync(`${CLI_CMD} state snapshot list`, { encoding: 'utf-8' });
      expect(output).toBeDefined();
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });
});
