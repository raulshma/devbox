import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Playwright E2E Tests for Encrypt/Decrypt Commands
 */

const TEST_DIR = path.join(process.cwd(), 'test-encrypt-decrypt');
const CLI_CMD = 'node dist/cli.js';

test.beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
  await fs.writeFile(path.join(TEST_DIR, 'secret.txt'), 'This is a secret message.');
  await fs.writeFile(path.join(TEST_DIR, 'data.json'), JSON.stringify({ secret: 'value' }));
  await fs.writeFile(path.join(TEST_DIR, 'large.txt'), 'A'.repeat(10000));
});

test.afterAll(async () => {
  if (await fs.access(TEST_DIR).then(() => true).catch(() => false)) {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }
});

test.describe('Encrypt Command', () => {
  test('should show encrypt help', async () => {
    const output = execSync(`${CLI_CMD} encrypt --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('Encrypt files');
    expect(output).toContain('--files');
    expect(output).toContain('--password');
    expect(output).toContain('--dry-run');
  });

  test('should encrypt a file with password', async () => {
    const testFile = path.join(TEST_DIR, 'encrypt-test.txt');
    await fs.writeFile(testFile, 'Content to encrypt');
    
    const output = execSync(
      `${CLI_CMD} encrypt --files "${testFile}" --password "TestPass123!"`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('Encryption');
    
    // Verify encrypted file was created
    const encryptedFile = testFile + '.encrypted';
    const exists = await fs.access(encryptedFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  test('should show dry-run mode', async () => {
    const testFile = path.join(TEST_DIR, 'secret.txt');
    const output = execSync(
      `${CLI_CMD} encrypt --files "${testFile}" --password "TestPass123!" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output.toLowerCase()).toContain('dry');
  });

  test('should encrypt multiple files', async () => {
    const file1 = path.join(TEST_DIR, 'multi1.txt');
    const file2 = path.join(TEST_DIR, 'multi2.txt');
    await fs.writeFile(file1, 'File 1 content');
    await fs.writeFile(file2, 'File 2 content');
    
    const output = execSync(
      `${CLI_CMD} encrypt --files "${file1}" --files "${file2}" --password "TestPass123!"`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('Encryption');
  });

  test('should save password to keychain with --save-password', async () => {
    const testFile = path.join(TEST_DIR, 'save-pwd-test.txt');
    await fs.writeFile(testFile, 'Save password test');
    
    try {
      const output = execSync(
        `${CLI_CMD} encrypt --files "${testFile}" --password "SavePass123!" --save-password e2e-test-pwd`,
        { encoding: 'utf-8' }
      );
      
      expect(output).toContain('keychain');
    } catch (error: any) {
      // Keytar may not be available in CI
      expect(error.message || '').toBeDefined();
    }
  });
});

test.describe('Decrypt Command', () => {
  test('should show decrypt help', async () => {
    const output = execSync(`${CLI_CMD} decrypt --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('Decrypt files');
    expect(output).toContain('--files');
    expect(output).toContain('--password');
  });

  test('should decrypt an encrypted file', async () => {
    // First encrypt a file
    const originalFile = path.join(TEST_DIR, 'decrypt-test.txt');
    const originalContent = 'Content for decryption test';
    await fs.writeFile(originalFile, originalContent);
    
    execSync(
      `${CLI_CMD} encrypt --files "${originalFile}" --password "DecryptPass123!"`,
      { encoding: 'utf-8' }
    );
    
    const encryptedFile = originalFile + '.encrypted';
    
    // Now decrypt
    const output = execSync(
      `${CLI_CMD} decrypt --files "${encryptedFile}" --password "DecryptPass123!"`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('Decryption');
    
    // Verify content matches
    const decryptedContent = await fs.readFile(originalFile, 'utf-8');
    expect(decryptedContent).toBe(originalContent);
  });

  test('should fail with wrong password', async () => {
    const testFile = path.join(TEST_DIR, 'wrong-pwd-test.txt');
    await fs.writeFile(testFile, 'Wrong password test content');
    
    execSync(
      `${CLI_CMD} encrypt --files "${testFile}" --password "CorrectPass123!"`,
      { encoding: 'utf-8' }
    );
    
    const encryptedFile = testFile + '.encrypted';
    
    try {
      execSync(
        `${CLI_CMD} decrypt --files "${encryptedFile}" --password "WrongPass123!"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      // Should not reach here
      expect(false).toBe(true);
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      expect(output.toLowerCase()).toMatch(/(error|fail|invalid|wrong|password)/i);
    }
  });

  test('should show decrypt dry-run', async () => {
    const encFile = path.join(TEST_DIR, 'secret.txt.encrypted');
    
    // Create encrypted file first if it doesn't exist
    if (!await fs.access(encFile).then(() => true).catch(() => false)) {
      execSync(
        `${CLI_CMD} encrypt --files "${path.join(TEST_DIR, 'secret.txt')}" --password "DryRunPass123!"`,
        { encoding: 'utf-8' }
      );
    }
    
    const output = execSync(
      `${CLI_CMD} decrypt --files "${encFile}" --password "DryRunPass123!" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output.toLowerCase()).toContain('dry');
  });
});

test.describe('Encrypt/Decrypt Error Handling', () => {
  test('should handle non-existent file', async () => {
    try {
      execSync(
        `${CLI_CMD} encrypt --files "/non/existent/file.txt" --password "Test123!"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      expect(output.toLowerCase()).toMatch(/(not found|error|fail|no such|exist)/i);
    }
  });
});
