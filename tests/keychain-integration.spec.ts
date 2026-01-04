import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Playwright Verification Test for OS Keychain Integration Feature
 *
 * This test verifies the keychain integration for secure password storage.
 * Note: Some tests require direct keytar usage for setup since the CLI password
 * prompts use raw mode which doesn't work with piped stdin.
 */

const TEST_DIR = path.join(process.cwd(), 'test-keychain-integration');
const CLI_CMD = 'node dist/cli.js';
const TEST_PASSWORD = 'MyStr0ng!Pass#Word';
const TEST_KEYCHAIN_NAME = 'test-keychain-pwd';

// Helper to store password directly via keytar (bypassing CLI prompt)
async function storePasswordDirectly(name: string, password: string): Promise<void> {
  // Use a small Node script to store the password using keytar directly
  const script = `
    const keytar = require('keytar');
    async function main() {
      const accountName = 'encrypt:${name}';
      await keytar.setPassword('developer-toolbox-cli', accountName, '${password}');
      console.log('Password stored');
    }
    main().catch(console.error);
  `;
  execSync(`node -e "${script.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
}

// Helper to delete password directly via keytar
async function deletePasswordDirectly(name: string): Promise<void> {
  const script = `
    const keytar = require('keytar');
    async function main() {
      const accountName = 'encrypt:${name}';
      await keytar.deletePassword('developer-toolbox-cli', accountName);
    }
    main().catch(() => {});
  `;
  try {
    execSync(`node -e "${script.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
  } catch (e) {
    // Ignore errors - password might not exist
  }
}

test.beforeAll(async () => {
  // Create test directory and test files for encryption tests
  await fs.mkdir(TEST_DIR, { recursive: true });
  await fs.writeFile(path.join(TEST_DIR, 'secret-document.txt'), 'This is a secret document to encrypt.');

  // Clean up any leftover test password and store a fresh one
  await deletePasswordDirectly(TEST_KEYCHAIN_NAME);
  await storePasswordDirectly(TEST_KEYCHAIN_NAME, TEST_PASSWORD);
});

test.afterAll(async () => {
  // Cleanup test directory
  if (await fs.access(TEST_DIR).then(() => true).catch(() => false)) {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }

  // Clean up test password from keychain
  await deletePasswordDirectly(TEST_KEYCHAIN_NAME);
});

test.describe('OS Keychain Integration Feature', () => {

  test('should show keychain command help', async () => {
    const output = execSync(`${CLI_CMD} keychain --help`, { encoding: 'utf-8' });

    expect(output).toContain('Manage passwords stored in the OS keychain');
    expect(output).toContain('list');
    expect(output).toContain('store');
    expect(output).toContain('delete');
    expect(output).toContain('test');
    expect(output).toContain('show');
  });

  test('should test keychain availability', async () => {
    const output = execSync(`${CLI_CMD} keychain test`, { encoding: 'utf-8' });

    // Verify keychain is available
    expect(output).toContain('Keychain - Availability Test');
    expect(output).toContain('OS keychain is available and working');

    // Should show platform-specific backend
    expect(output).toMatch(/(Windows: Credential Manager|macOS: Keychain Access|Linux: Secret Service API)/);
  });

  test('should list stored passwords including test password', async () => {
    const output = execSync(`${CLI_CMD} keychain list`, { encoding: 'utf-8' });

    expect(output).toContain('Keychain - Stored Passwords');
    // The test password should be in the list
    expect(output).toContain(TEST_KEYCHAIN_NAME);
  });

  test('should show a stored password', async () => {
    const output = execSync(`${CLI_CMD} keychain show ${TEST_KEYCHAIN_NAME}`, { encoding: 'utf-8' });

    expect(output).toContain('Keychain - Show Password');
    expect(output).toContain(TEST_PASSWORD);
  });

  test('should encrypt files using saved password from keychain', async () => {
    const testFile = path.join(TEST_DIR, 'secret-document.txt');
    const output = execSync(
      `${CLI_CMD} encrypt --files "${testFile}" --use-saved ${TEST_KEYCHAIN_NAME}`,
      { encoding: 'utf-8' }
    );

    // Verify password was retrieved from keychain
    expect(output).toContain('Retrieving password from OS keychain');
    expect(output).toContain('Password retrieved from keychain');
    expect(output).toContain('Encryption complete');

    // Verify encrypted file was created
    const files = await fs.readdir(TEST_DIR);
    const encryptedFiles = files.filter(f => f.endsWith('.encrypted'));
    expect(encryptedFiles.length).toBe(1);
  });

  test('should decrypt files using saved password from keychain', async () => {
    const encryptedFile = path.join(TEST_DIR, 'secret-document.txt.encrypted');
    const output = execSync(
      `${CLI_CMD} decrypt --files "${encryptedFile}" --use-saved ${TEST_KEYCHAIN_NAME}`,
      { encoding: 'utf-8' }
    );

    // Verify password was retrieved from keychain
    expect(output).toContain('Retrieving password from OS keychain');
    expect(output).toContain('Password retrieved from keychain');
    expect(output).toContain('Decryption complete');
  });

  test('should show encrypt command with keychain options', async () => {
    const output = execSync(`${CLI_CMD} encrypt --help`, { encoding: 'utf-8' });

    expect(output).toContain('--save-password');
    expect(output).toContain('--use-saved');
    expect(output).toContain('--keychain-service');
  });

  test('should show decrypt command with keychain options', async () => {
    const output = execSync(`${CLI_CMD} decrypt --help`, { encoding: 'utf-8' });

    expect(output).toContain('--use-saved');
    expect(output).toContain('--keychain-service');
  });

  test('should save password during encryption with --save-password', async () => {
    const newPasswordName = 'test-save-during-encrypt';
    const newTestFile = path.join(TEST_DIR, 'another-document.txt');

    // Create a new test file
    await fs.writeFile(newTestFile, 'Another test document');

    // Clean up first in case it exists
    await deletePasswordDirectly(newPasswordName);

    // Encrypt with --save-password - note: since we're using the same password from keychain
    // we use --use-saved for the password and --save-password to save under a new name
    const output = execSync(
      `${CLI_CMD} encrypt --files "${newTestFile}" --password "${TEST_PASSWORD}" --save-password ${newPasswordName}`,
      { encoding: 'utf-8' }
    );

    // Verify password was saved
    expect(output).toContain('Saving password to OS keychain');
    expect(output).toContain('Password saved to keychain');

    // Verify we can retrieve the saved password
    const showOutput = execSync(`${CLI_CMD} keychain show ${newPasswordName}`, { encoding: 'utf-8' });
    expect(showOutput).toContain(TEST_PASSWORD);

    // Clean up
    await deletePasswordDirectly(newPasswordName);
  });

  test('should delete a password from keychain using CLI', async () => {
    const tempName = 'test-delete-password';

    // Store a temporary password
    await storePasswordDirectly(tempName, 'TempPass123!');

    // Verify it exists
    let listOutput = execSync(`${CLI_CMD} keychain list`, { encoding: 'utf-8' });
    expect(listOutput).toContain(tempName);

    // Delete using CLI
    const deleteOutput = execSync(`${CLI_CMD} keychain delete ${tempName} -y`, { encoding: 'utf-8' });
    expect(deleteOutput).toContain('deleted from keychain');

    // Verify it's gone
    listOutput = execSync(`${CLI_CMD} keychain list`, { encoding: 'utf-8' });
    expect(listOutput).not.toContain(tempName);
  });

  test('should show error when using non-existent saved password', async () => {
    try {
      execSync(
        `${CLI_CMD} encrypt --files "${path.join(TEST_DIR, 'secret-document.txt')}" --use-saved nonexistent-password`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      // Should not reach here
      expect(false).toBe(true);
    } catch (error: any) {
      const output = error.stderr || error.stdout || '';
      expect(output).toContain('Failed to retrieve password from keychain');
    }
  });

  test('should show error when showing non-existent password', async () => {
    try {
      execSync(`${CLI_CMD} keychain show nonexistent-password`, { encoding: 'utf-8', stdio: 'pipe' });
      // Should not reach here
      expect(false).toBe(true);
    } catch (error: any) {
      const output = error.stderr || error.stdout || '';
      expect(output).toContain('No password found');
    }
  });

});
