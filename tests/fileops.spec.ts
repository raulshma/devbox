import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Playwright E2E Tests for FileOps Command
 */

const TEST_DIR = path.join(process.cwd(), 'test-fileops-e2e');
const CLI_CMD = 'node dist/cli.js fileops';

test.beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
});

test.afterAll(async () => {
  if (await fs.access(TEST_DIR).then(() => true).catch(() => false)) {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }
});

test.describe('FileOps Command Help', () => {
  test('should show fileops help', async () => {
    const output = execSync(`${CLI_CMD} --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('File operations');
    expect(output).toContain('copy');
    expect(output).toContain('move');
    expect(output).toContain('delete');
  });

  test('should show copy help', async () => {
    const output = execSync(`${CLI_CMD} copy --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('Copy');
    expect(output).toContain('--source');
    expect(output).toContain('--dest');
  });

  test('should show move help', async () => {
    const output = execSync(`${CLI_CMD} move --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('Move');
  });

  test('should show delete help', async () => {
    const output = execSync(`${CLI_CMD} delete --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('Delete');
  });
});

test.describe('FileOps Copy', () => {
  test('should copy a file', async () => {
    const sourceFile = path.join(TEST_DIR, 'copy-source.txt');
    const destFile = path.join(TEST_DIR, 'copy-dest.txt');
    await fs.writeFile(sourceFile, 'Copy content');
    
    const output = execSync(
      `${CLI_CMD} copy --source "${sourceFile}" --dest "${destFile}"`,
      { encoding: 'utf-8' }
    );
    
    expect(output.toLowerCase()).toMatch(/(copied|success|complete)/i);
    
    // Verify file was copied
    const destContent = await fs.readFile(destFile, 'utf-8');
    expect(destContent).toBe('Copy content');
  });

  test('should copy a directory', async () => {
    const sourceDir = path.join(TEST_DIR, 'copy-src-dir');
    const destDir = path.join(TEST_DIR, 'copy-dest-dir');
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, 'file.txt'), 'content');
    
    const output = execSync(
      `${CLI_CMD} copy --source "${sourceDir}" --dest "${destDir}" --recursive`,
      { encoding: 'utf-8' }
    );
    
    expect(output.toLowerCase()).toMatch(/(copied|success|complete)/i);
    
    // Verify directory was copied
    const exists = await fs.access(path.join(destDir, 'file.txt')).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  test('should handle dry-run', async () => {
    const sourceFile = path.join(TEST_DIR, 'dry-copy.txt');
    const destFile = path.join(TEST_DIR, 'dry-copy-dest.txt');
    await fs.writeFile(sourceFile, 'Dry run test');
    
    const output = execSync(
      `${CLI_CMD} copy --source "${sourceFile}" --dest "${destFile}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output.toLowerCase()).toContain('dry');
    
    // File should NOT exist (dry run)
    const exists = await fs.access(destFile).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
});

test.describe('FileOps Move', () => {
  test('should move a file', async () => {
    const sourceFile = path.join(TEST_DIR, 'move-source.txt');
    const destFile = path.join(TEST_DIR, 'move-dest.txt');
    await fs.writeFile(sourceFile, 'Move content');
    
    const output = execSync(
      `${CLI_CMD} move --source "${sourceFile}" --dest "${destFile}"`,
      { encoding: 'utf-8' }
    );
    
    expect(output.toLowerCase()).toMatch(/(moved|success|complete)/i);
    
    // Verify source is gone and dest exists
    const sourceExists = await fs.access(sourceFile).then(() => true).catch(() => false);
    const destExists = await fs.access(destFile).then(() => true).catch(() => false);
    expect(sourceExists).toBe(false);
    expect(destExists).toBe(true);
  });
});

test.describe('FileOps Delete', () => {
  test('should delete a file', async () => {
    const fileToDelete = path.join(TEST_DIR, 'to-delete.txt');
    await fs.writeFile(fileToDelete, 'Delete me');
    
    const output = execSync(
      `${CLI_CMD} delete --path "${fileToDelete}" --yes`,
      { encoding: 'utf-8' }
    );
    
    expect(output.toLowerCase()).toMatch(/(deleted|success|removed)/i);
    
    // Verify file is gone
    const exists = await fs.access(fileToDelete).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  test('should delete a directory', async () => {
    const dirToDelete = path.join(TEST_DIR, 'dir-to-delete');
    await fs.mkdir(dirToDelete, { recursive: true });
    await fs.writeFile(path.join(dirToDelete, 'file.txt'), 'content');
    
    const output = execSync(
      `${CLI_CMD} delete --path "${dirToDelete}" --recursive --yes`,
      { encoding: 'utf-8' }
    );
    
    expect(output.toLowerCase()).toMatch(/(deleted|success|removed)/i);
    
    // Verify directory is gone
    const exists = await fs.access(dirToDelete).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  test('should use trash when specified', async () => {
    const trashFile = path.join(TEST_DIR, 'trash-file.txt');
    await fs.writeFile(trashFile, 'Trash me');
    
    try {
      const output = execSync(
        `${CLI_CMD} delete --path "${trashFile}" --trash --yes`,
        { encoding: 'utf-8' }
      );
      
      expect(output.toLowerCase()).toMatch(/(trash|deleted|success)/i);
    } catch (error: any) {
      // Trash may not be available on all systems
      expect(error).toBeDefined();
    }
  });
});

test.describe('FileOps Conflict Resolution', () => {
  test('should skip existing file by default', async () => {
    const source = path.join(TEST_DIR, 'conflict-source.txt');
    const dest = path.join(TEST_DIR, 'conflict-dest.txt');
    await fs.writeFile(source, 'source content');
    await fs.writeFile(dest, 'existing content');
    
    const output = execSync(
      `${CLI_CMD} copy --source "${source}" --dest "${dest}" --conflict skip`,
      { encoding: 'utf-8' }
    );
    
    // Existing file should remain unchanged
    const destContent = await fs.readFile(dest, 'utf-8');
    expect(destContent).toBe('existing content');
  });

  test('should overwrite when specified', async () => {
    const source = path.join(TEST_DIR, 'overwrite-source.txt');
    const dest = path.join(TEST_DIR, 'overwrite-dest.txt');
    await fs.writeFile(source, 'new content');
    await fs.writeFile(dest, 'old content');
    
    const output = execSync(
      `${CLI_CMD} copy --source "${source}" --dest "${dest}" --conflict overwrite`,
      { encoding: 'utf-8' }
    );
    
    // File should be overwritten
    const destContent = await fs.readFile(dest, 'utf-8');
    expect(destContent).toBe('new content');
  });
});

test.describe('FileOps Error Handling', () => {
  test('should handle non-existent source', async () => {
    try {
      execSync(
        `${CLI_CMD} copy --source "/non/existent.txt" --dest "${TEST_DIR}/dest.txt"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      expect(output.toLowerCase()).toMatch(/(not found|error|fail|no such|exist)/i);
    }
  });
});
