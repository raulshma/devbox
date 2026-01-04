import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Playwright Verification Test for Azure Blob Storage Feature
 *
 * This test verifies the Azure Blob Storage integration functionality.
 * Tests use mock storage to avoid requiring actual Azure credentials.
 */

const TEST_DIR = path.join(process.cwd(), 'test-azure-blob');
const CLI_CMD = 'node dist/cli.js';

test.beforeAll(async () => {
  // Create test directory and test files
  await fs.mkdir(TEST_DIR, { recursive: true });
  await fs.writeFile(path.join(TEST_DIR, 'test-file.txt'), 'This is a test file for Azure Blob Storage.');
  await fs.writeFile(path.join(TEST_DIR, 'test-file.json'), JSON.stringify({ message: 'Test data', version: 1 }));
  await fs.writeFile(path.join(TEST_DIR, 'large-file.txt'), 'A'.repeat(10000));
});

test.afterAll(async () => {
  // Cleanup test directory
  if (await fs.access(TEST_DIR).then(() => true).catch(() => false)) {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }
});

test.describe('Azure Blob Storage Feature', () => {

  test('should show azure-blob command help', async () => {
    const output = execSync(`${CLI_CMD} azure-blob --help`, { encoding: 'utf-8' });

    expect(output).toContain('Azure Blob Storage operations');
    expect(output).toContain('upload');
    expect(output).toContain('download');
    expect(output).toContain('list');
    expect(output).toContain('delete');
    expect(output).toContain('copy');
    expect(output).toContain('stats');
    expect(output).toContain('azblob');
  });

  test('should show upload command help', async () => {
    const output = execSync(`${CLI_CMD} azure-blob upload --help`, { encoding: 'utf-8' });

    expect(output).toContain('Upload a file to Azure Blob Storage');
    expect(output).toContain('--blob-name');
    expect(output).toContain('--container');
    expect(output).toContain('--account');
    expect(output).toContain('--content-type');
    expect(output).toContain('--tier');
  });

  test('should upload a file to Azure Blob Storage', async () => {
    const testFile = path.join(TEST_DIR, 'test-file.txt');
    const output = execSync(
      `${CLI_CMD} azure-blob upload "${testFile}" --blob-name documents/test-file.txt`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Azure Blob Storage - Upload File');
    expect(output).toContain('Connected to Azure Blob Storage');
    expect(output).toContain('Upload successful');
    expect(output).toContain('documents/test-file.txt');
  });

  test('should upload a JSON file with content type', async () => {
    const testFile = path.join(TEST_DIR, 'test-file.json');
    const output = execSync(
      `${CLI_CMD} azure-blob upload "${testFile}" --blob-name data/test.json --content-type application/json`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Upload successful');
    expect(output).toContain('data/test.json');
  });

  test('should upload a file with access tier', async () => {
    const testFile = path.join(TEST_DIR, 'large-file.txt');
    const output = execSync(
      `${CLI_CMD} azure-blob upload "${testFile}" --blob-name archives/large-file.txt --tier Cool`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Upload successful');
    expect(output).toContain('archives/large-file.txt');
  });

  test('should list blobs in container', async () => {
    const output = execSync(
      `${CLI_CMD} azure-blob list --container default-container`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Azure Blob Storage - List Blobs');
    expect(output).toContain('Connected to Azure Blob Storage');
    expect(output).toContain('Found');
    expect(output).toContain('blob(s)');
  });

  test('should list blobs with prefix filter', async () => {
    const output = execSync(
      `${CLI_CMD} azure-blob list --prefix "documents/"`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('documents/test-file.txt');
  });

  test('should download a blob from Azure Blob Storage', async () => {
    const downloadPath = path.join(TEST_DIR, 'downloaded-file.txt');

    const output = execSync(
      `${CLI_CMD} azure-blob download documents/test-file.txt --file "${downloadPath}"`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Azure Blob Storage - Download Blob');
    expect(output).toContain('Download successful');
    expect(output).toContain('documents/test-file.txt');
    expect(output).toContain('Saved to:');

    // Verify file was downloaded
    const exists = await fs.access(downloadPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    // Verify content
    const content = await fs.readFile(downloadPath, 'utf-8');
    expect(content).toContain('This is a test file for Azure Blob Storage');
  });

  test('should copy a blob within Azure Blob Storage', async () => {
    const output = execSync(
      `${CLI_CMD} azure-blob copy documents/test-file.txt documents/test-file-copy.txt`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Azure Blob Storage - Copy Blob');
    expect(output).toContain('Blob copied successfully');
    expect(output).toContain('Source: default-container/documents/test-file.txt');
    expect(output).toContain('Destination: default-container/documents/test-file-copy.txt');
  });

  test('should delete a blob from Azure Blob Storage', async () => {
    const output = execSync(
      `${CLI_CMD} azure-blob delete documents/test-file-copy.txt --yes`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Azure Blob Storage - Delete Blob');
    expect(output).toContain('Blob deleted successfully');
    expect(output).toContain('documents/test-file-copy.txt');
  });

  test('should get storage statistics', async () => {
    const output = execSync(
      `${CLI_CMD} azure-blob stats`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Azure Blob Storage - Statistics');
    expect(output).toContain('Storage Statistics');
    expect(output).toContain('Total Containers:');
    expect(output).toContain('Total Blobs:');
    expect(output).toContain('Total Storage Used:');
  });

  test('should upload with dry-run flag', async () => {
    const testFile = path.join(TEST_DIR, 'test-file.txt');
    const output = execSync(
      `${CLI_CMD} azure-blob upload "${testFile}" --blob-name dryrun/test.txt --dry-run`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Dry-run mode: No actual upload will be performed');
    expect(output).toContain('dryrun/test.txt');
    expect(output).toContain('(Dry-run complete - no changes made)');
  });

  test('should show alias azblob works', async () => {
    const output = execSync(`${CLI_CMD} azblob --help`, { encoding: 'utf-8' });

    expect(output).toContain('Azure Blob Storage operations');
    expect(output).toContain('upload');
    expect(output).toContain('download');
  });

  test('should handle non-existent file upload gracefully', async () => {
    try {
      execSync(
        `${CLI_CMD} azure-blob upload nonexistent.txt --blob-name test.txt`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      // Should not reach here
      expect(false).toBe(true);
    } catch (error: any) {
      const output = error.stderr || error.stdout || '';
      expect(output).toContain('File not found');
    }
  });

  test('should handle download to non-existent directory (should create)', async () => {
    const downloadPath = path.join(TEST_DIR, 'subdir', 'downloaded.txt');

    const output = execSync(
      `${CLI_CMD} azure-blob download data/test.json --file "${downloadPath}"`,
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Download successful');

    // Verify file was downloaded and directory was created
    const exists = await fs.access(downloadPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    // Verify content
    const content = await fs.readFile(downloadPath, 'utf-8');
    expect(content).toContain('Test data');
  });

});
