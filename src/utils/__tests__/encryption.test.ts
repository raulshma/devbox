/**
 * Encryption Utility Unit Tests
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  deriveKey,
  encryptData,
  decryptData,
  encryptFile,
  decryptFile,
  getEncryptedFilePath,
  getDecryptedFilePath,
} from '../encryption.js';

describe('Encryption Utilities', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `encrypt-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('deriveKey', () => {
    it('should derive a key from password and salt', async () => {
      const password = 'testPassword123';
      const salt = Buffer.from('0123456789abcdef');

      const key = await deriveKey(password, salt);
      
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32); // 256 bits
    });

    it('should derive same key for same password and salt', async () => {
      const password = 'testPassword123';
      const salt = Buffer.from('0123456789abcdef');

      const key1 = await deriveKey(password, salt);
      const key2 = await deriveKey(password, salt);
      
      expect(key1.equals(key2)).toBe(true);
    });

    it('should derive different keys for different passwords', async () => {
      const salt = Buffer.from('0123456789abcdef');

      const key1 = await deriveKey('password1', salt);
      const key2 = await deriveKey('password2', salt);
      
      expect(key1.equals(key2)).toBe(false);
    });

    it('should derive different keys for different salts', async () => {
      const password = 'testPassword';

      const key1 = await deriveKey(password, Buffer.from('salt1234567890ab'));
      const key2 = await deriveKey(password, Buffer.from('salt0987654321ab'));
      
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('encryptData and decryptData', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const originalData = Buffer.from('Hello, World!');
      const password = 'testPassword123';

      const encrypted = await encryptData(originalData, password);
      
      expect(encrypted.encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.salt).toBeInstanceOf(Buffer);
      expect(encrypted.iv).toBeInstanceOf(Buffer);
      expect(encrypted.authTag).toBeInstanceOf(Buffer);

      const decrypted = await decryptData(
        encrypted.encrypted,
        password,
        encrypted.salt,
        encrypted.iv,
        encrypted.authTag
      );

      expect(decrypted.equals(originalData)).toBe(true);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const data = Buffer.from('Test data');
      const password = 'password';

      const encrypted1 = await encryptData(data, password);
      const encrypted2 = await encryptData(data, password);

      // Due to random IV, encrypted data should be different
      expect(encrypted1.encrypted.equals(encrypted2.encrypted)).toBe(false);
    });

    it('should throw error for wrong password', async () => {
      const data = Buffer.from('Secret data');
      const encrypted = await encryptData(data, 'correctPassword');

      await expect(
        decryptData(
          encrypted.encrypted,
          'wrongPassword',
          encrypted.salt,
          encrypted.iv,
          encrypted.authTag
        )
      ).rejects.toThrow();
    });

    it('should handle empty data', async () => {
      const emptyData = Buffer.from('');
      const password = 'password';

      const encrypted = await encryptData(emptyData, password);
      const decrypted = await decryptData(
        encrypted.encrypted,
        password,
        encrypted.salt,
        encrypted.iv,
        encrypted.authTag
      );

      expect(decrypted.equals(emptyData)).toBe(true);
    });

    it('should handle large data', async () => {
      const largeData = Buffer.alloc(1024 * 100, 'A'); // 100KB
      const password = 'password';

      const encrypted = await encryptData(largeData, password);
      const decrypted = await decryptData(
        encrypted.encrypted,
        password,
        encrypted.salt,
        encrypted.iv,
        encrypted.authTag
      );

      expect(decrypted.equals(largeData)).toBe(true);
    });
  });

  describe('encryptFile and decryptFile', () => {
    it('should encrypt a file', async () => {
      const inputPath = path.join(testDir, 'test-input.txt');
      const outputPath = path.join(testDir, 'test-input.txt.encrypted');
      const password = 'filePassword123';

      await fs.writeFile(inputPath, 'File content to encrypt');

      const result = await encryptFile(inputPath, outputPath, password);

      expect(result.success).toBe(true);
      expect(result.inputFile).toBe(inputPath);
      expect(result.outputFile).toBe(outputPath);

      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should decrypt a file', async () => {
      const originalPath = path.join(testDir, 'decrypt-test.txt');
      const encryptedPath = path.join(testDir, 'decrypt-test.txt.encrypted');
      const decryptedPath = path.join(testDir, 'decrypt-test.decrypted.txt');
      const password = 'decryptPassword123';
      const originalContent = 'Original file content for decryption test';

      await fs.writeFile(originalPath, originalContent);
      await encryptFile(originalPath, encryptedPath, password);

      const result = await decryptFile(encryptedPath, decryptedPath, password);

      expect(result.success).toBe(true);
      
      const decryptedContent = await fs.readFile(decryptedPath, 'utf-8');
      expect(decryptedContent).toBe(originalContent);
    });

    it('should fail for non-existent file', async () => {
      const result = await encryptFile(
        path.join(testDir, 'non-existent.txt'),
        path.join(testDir, 'output.encrypted'),
        'password'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail decryption with wrong password', async () => {
      const inputPath = path.join(testDir, 'wrong-pwd-test.txt');
      const encryptedPath = path.join(testDir, 'wrong-pwd-test.txt.encrypted');
      const decryptedPath = path.join(testDir, 'wrong-pwd-test.decrypted.txt');

      await fs.writeFile(inputPath, 'Test content');
      await encryptFile(inputPath, encryptedPath, 'correctPassword');

      const result = await decryptFile(encryptedPath, decryptedPath, 'wrongPassword');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getEncryptedFilePath', () => {
    it('should append .encrypted extension', () => {
      const result = getEncryptedFilePath('/path/to/file.txt');
      expect(result).toBe('/path/to/file.txt.encrypted');
    });

    it('should use custom output directory', () => {
      const result = getEncryptedFilePath('/path/to/file.txt', '/output');
      expect(result).toBe('/output/file.txt.encrypted');
    });

    it('should handle files without extension', () => {
      const result = getEncryptedFilePath('/path/to/file');
      expect(result).toBe('/path/to/file.encrypted');
    });
  });

  describe('getDecryptedFilePath', () => {
    it('should remove .encrypted extension', () => {
      const result = getDecryptedFilePath('/path/to/file.txt.encrypted');
      expect(result).toBe('/path/to/file.txt');
    });

    it('should use custom output directory', () => {
      const result = getDecryptedFilePath('/path/to/file.txt.encrypted', '/output');
      expect(result).toBe('/output/file.txt');
    });

    it('should add .decrypted for non-encrypted files', () => {
      const result = getDecryptedFilePath('/path/to/file.bin');
      expect(result).toContain('decrypted');
    });
  });
});
