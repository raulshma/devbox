import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Simplified Playwright Test for Sequential Numbering Feature
 */

const TEST_DIR = path.join(process.cwd(), 'test-renames-simple');
const CLI_CMD = 'node dist/cli.js rename';

test.beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });

  // Create test files
  await fs.writeFile(path.join(TEST_DIR, 'file1.txt'), 'content1');
  await fs.writeFile(path.join(TEST_DIR, 'file2.txt'), 'content2');
  await fs.writeFile(path.join(TEST_DIR, 'file3.txt'), 'content3');
});

test.afterAll(async () => {
  if (await fs.access(TEST_DIR).then(() => true).catch(() => false)) {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }
});

test.describe('Sequential Numbering', () => {
  test('should number files from 1 to 5 without padding', async () => {
    const output = execSync(
      `${CLI_CMD} --number "1,5" --filter "*.txt" --directory "${TEST_DIR}" --dry-run`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Found 3 file(s)');
    expect(output).toContain('file1.txt');
    expect(output).toContain('1.txt');
  });

  test('should number files with prefix', async () => {
    const output = execSync(
      `${CLI_CMD} --number "doc-1,10" --filter "*.txt" --directory "${TEST_DIR}" --dry-run`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Found 3 file(s)');
    expect(output).toContain('doc-01.txt');
  });

  test('should number files with step increment', async () => {
    const output = execSync(
      `${CLI_CMD} --number "1,100,10" --filter "*.txt" --directory "${TEST_DIR}" --dry-run`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Found 3 file(s)');
    expect(output).toContain('01.txt');
  });

  test('should actually rename files (not dry-run)', async () => {
    // Create a temp subdirectory
    const tempDir = path.join(TEST_DIR, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(path.join(tempDir, 'a.txt'), 'a');
    await fs.writeFile(path.join(tempDir, 'b.txt'), 'b');

    // Perform rename
    const output = execSync(
      `${CLI_CMD} --number "1,5" --filter "*.txt" --directory "${tempDir}"`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Success: 2');

    // Verify files were renamed
    const files = await fs.readdir(tempDir);
    expect(files).toContain('1.txt');
    expect(files).toContain('2.txt');

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  });

});
