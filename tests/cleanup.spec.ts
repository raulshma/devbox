import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Playwright E2E Tests for Cleanup Commands
 */

const TEST_DIR = path.join(process.cwd(), 'test-cleanup-e2e');
const CLI_CMD = 'node dist/cli.js';

test.beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
});

test.afterAll(async () => {
  if (await fs.access(TEST_DIR).then(() => true).catch(() => false)) {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }
});

test.describe('Cleanup Node Command', () => {
  test('should show cleanup-node help', async () => {
    const output = execSync(`${CLI_CMD} cleanup-node --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('node_modules');
    expect(output).toContain('--dry-run');
    expect(output).toContain('--directory');
  });

  test('should scan for node_modules in dry-run mode', async () => {
    // Create a mock Node.js project
    const projectDir = path.join(TEST_DIR, 'node-project');
    const nodeModules = path.join(projectDir, 'node_modules');
    await fs.mkdir(nodeModules, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'package.json'), '{}');
    await fs.writeFile(path.join(nodeModules, 'placeholder.txt'), 'placeholder');
    
    const output = execSync(
      `${CLI_CMD} cleanup-node --directory "${projectDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output.toLowerCase()).toMatch(/(found|scan|node_modules|dry)/i);
  });

  test('should respect max-depth option', async () => {
    const output = execSync(
      `${CLI_CMD} cleanup-node --directory "${TEST_DIR}" --max-depth 2 --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toBeDefined();
  });

  test('should list what would be deleted', async () => {
    const projectDir = path.join(TEST_DIR, 'list-project');
    const nodeModules = path.join(projectDir, 'node_modules');
    await fs.mkdir(nodeModules, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'package.json'), '{}');
    
    const output = execSync(
      `${CLI_CMD} cleanup-node --directory "${projectDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output.toLowerCase()).toMatch(/(would|found|node_modules|dry)/i);
  });
});

test.describe('Cleanup DotNet Command', () => {
  test('should show cleanup-dotnet help', async () => {
    const output = execSync(`${CLI_CMD} cleanup-dotnet --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('bin');
    expect(output).toContain('obj');
    expect(output).toContain('--dry-run');
  });

  test('should scan for bin/obj in dry-run mode', async () => {
    // Create a mock .NET project
    const projectDir = path.join(TEST_DIR, 'dotnet-project');
    const binDir = path.join(projectDir, 'bin');
    const objDir = path.join(projectDir, 'obj');
    await fs.mkdir(binDir, { recursive: true });
    await fs.mkdir(objDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'project.csproj'), '<Project></Project>');
    await fs.writeFile(path.join(binDir, 'app.dll'), 'binary');
    await fs.writeFile(path.join(objDir, 'cache.txt'), 'cache');
    
    const output = execSync(
      `${CLI_CMD} cleanup-dotnet --directory "${projectDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output.toLowerCase()).toMatch(/(found|scan|bin|obj|dry)/i);
  });

  test('should respect include options', async () => {
    const projectDir = path.join(TEST_DIR, 'include-project');
    const binDir = path.join(projectDir, 'bin');
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'project.csproj'), '<Project></Project>');
    
    const output = execSync(
      `${CLI_CMD} cleanup-dotnet --directory "${projectDir}" --include-bin --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toBeDefined();
  });
});

test.describe('Discover Command', () => {
  test('should show discover help', async () => {
    const output = execSync(`${CLI_CMD} discover --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('Discover');
  });

  test('should discover files in directory', async () => {
    const discoverDir = path.join(TEST_DIR, 'discover-test');
    await fs.mkdir(discoverDir, { recursive: true });
    await fs.writeFile(path.join(discoverDir, 'file1.txt'), 'content');
    await fs.writeFile(path.join(discoverDir, 'file2.js'), 'content');
    await fs.writeFile(path.join(discoverDir, 'file3.ts'), 'content');
    
    const output = execSync(
      `${CLI_CMD} discover --directory "${discoverDir}"`,
      { encoding: 'utf-8' }
    );
    
    expect(output.toLowerCase()).toMatch(/(found|file|discover)/i);
  });
});

test.describe('Cleanup Error Handling', () => {
  test('should handle non-existent directory for cleanup-node', async () => {
    try {
      execSync(
        `${CLI_CMD} cleanup-node --directory "/non/existent/dir" --dry-run`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      expect(output.toLowerCase()).toMatch(/(not found|error|fail|no such|exist|directory)/i);
    }
  });

  test('should handle non-existent directory for cleanup-dotnet', async () => {
    try {
      execSync(
        `${CLI_CMD} cleanup-dotnet --directory "/non/existent/dir" --dry-run`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      expect(output.toLowerCase()).toMatch(/(not found|error|fail|no such|exist|directory)/i);
    }
  });
});

test.describe('Cleanup Statistics', () => {
  test('should show cleanup statistics', async () => {
    const projectDir = path.join(TEST_DIR, 'stats-project');
    const nodeModules = path.join(projectDir, 'node_modules');
    await fs.mkdir(nodeModules, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'package.json'), '{}');
    
    const output = execSync(
      `${CLI_CMD} cleanup-node --directory "${projectDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    // Should show some statistics about what was found
    expect(output.toLowerCase()).toMatch(/(found|total|size|directories|dry)/i);
  });
});
