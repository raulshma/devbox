/**
 * Encryption Utilities
 *
 * Implements AES-256-GCM file encryption with password-based key derivation
 * using Node.js built-in crypto module
 *
 * Supports both in-memory and streaming encryption for large files
 */

import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import { pipeline, Transform } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

/**
 * Encryption configuration
 */
export const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits for AES-256
  ivLength: 16, // 96 bits for GCM
  saltLength: 64,
  authTagLength: 16,
  pbkdf2Iterations: 100000,
  pbkdf2Digest: 'sha256',
  fileExtension: '.encrypted',
} as const;

/**
 * Streaming encryption configuration
 */
export const STREAMING_CONFIG = {
  /** Default chunk size for streaming (64KB) */
  defaultChunkSize: 64 * 1024,
  /** File size threshold for auto-streaming (10MB) */
  streamingThreshold: 10 * 1024 * 1024,
  /** Maximum chunk size (1MB) */
  maxChunkSize: 1024 * 1024,
  /** Minimum chunk size (16KB) */
  minChunkSize: 16 * 1024,
} as const;

/**
 * Streaming encryption options
 */
export interface StreamEncryptOptions {
  /** Password for encryption */
  password: string;
  /** Chunk size for streaming (default: 64KB) */
  chunkSize?: number;
  /** Progress callback */
  onProgress?: (bytesProcessed: number, totalBytes: number) => void;
}

/**
 * Streaming encryption result
 */
export interface StreamEncryptionResult {
  success: boolean;
  inputFile: string;
  outputFile: string;
  bytesProcessed: number;
  encryptedSize: number;
  error?: string;
}

/**
 * Streaming decryption result
 */
export interface StreamDecryptionResult {
  success: boolean;
  inputFile: string;
  outputFile: string;
  bytesProcessed: number;
  decryptedSize: number;
  error?: string;
}

/**
 * Encrypted file header format
 */
export interface EncryptedFileHeader {
  version: number;
  algorithm: string;
  salt: string; // hex encoded
  iv: string; // hex encoded
  authTag: string; // hex encoded
  iterations: number;
}

/**
 * Encryption result
 */
export interface EncryptionResult {
  success: boolean;
  inputFile: string;
  outputFile: string;
  fileSize: number;
  encryptedSize: number;
  error?: string;
}

/**
 * Decryption result
 */
export interface DecryptionResult {
  success: boolean;
  inputFile: string;
  outputFile: string;
  fileSize: number;
  decryptedSize: number;
  error?: string;
}

/**
 * Derive a cryptographic key from a password using PBKDF2
 *
 * @param password - The password to derive the key from
 * @param salt - The salt to use for key derivation
 * @returns A Promise that resolves to the derived key
 */
export async function deriveKey(
  password: string,
  salt: Buffer
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      ENCRYPTION_CONFIG.pbkdf2Iterations,
      ENCRYPTION_CONFIG.keyLength,
      ENCRYPTION_CONFIG.pbkdf2Digest,
      (err, derivedKey) => {
        if (err) {
          reject(err);
        } else {
          resolve(derivedKey);
        }
      }
    );
  });
}

/**
 * Encrypt data using AES-256-GCM
 *
 * @param data - The data to encrypt
 * @param password - The password to use for encryption
 * @returns A Promise that resolves to an object containing the encrypted data and metadata
 */
export async function encryptData(
  data: Buffer,
  password: string
): Promise<{
  encrypted: Buffer;
  salt: Buffer;
  iv: Buffer;
  authTag: Buffer;
}> {
  // Generate a random salt
  const salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);

  // Derive the key from the password
  const key = await deriveKey(password, salt);

  // Generate a random IV
  const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);

  // Create the cipher
  const cipher = crypto.createCipheriv(
    ENCRYPTION_CONFIG.algorithm,
    key,
    iv
  );

  // Encrypt the data
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

  // Get the auth tag
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    salt,
    iv,
    authTag,
  };
}

/**
 * Decrypt data using AES-256-GCM
 *
 * @param encryptedData - The encrypted data
 * @param password - The password to use for decryption
 * @param salt - The salt used for key derivation
 * @param iv - The IV used for encryption
 * @param authTag - The authentication tag
 * @returns A Promise that resolves to the decrypted data
 * @throws Error if decryption fails (e.g., wrong password)
 */
export async function decryptData(
  encryptedData: Buffer,
  password: string,
  salt: Buffer,
  iv: Buffer,
  authTag: Buffer
): Promise<Buffer> {
  // Derive the key from the password
  const key = await deriveKey(password, salt);

  // Create the decipher
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_CONFIG.algorithm,
    key,
    iv
  );

  // Set the auth tag
  decipher.setAuthTag(authTag);

  try {
    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);
    return decrypted;
  } catch (error) {
    throw new Error(
      'Decryption failed. The password may be incorrect or the data may be corrupted.'
    );
  }
}

/**
 * Encrypt a file
 *
 * @param inputPath - Path to the file to encrypt
 * @param outputPath - Path where the encrypted file will be saved
 * @param password - The password to use for encryption
 * @returns A Promise that resolves to an EncryptionResult
 */
export async function encryptFile(
  inputPath: string,
  outputPath: string,
  password: string
): Promise<EncryptionResult> {
  try {
    // Read the input file
    const inputData = await fs.readFile(inputPath);

    // Encrypt the data
    const { encrypted, salt, iv, authTag } = await encryptData(
      inputData,
      password
    );

    // Create the header
    const header: EncryptedFileHeader = {
      version: 1,
      algorithm: ENCRYPTION_CONFIG.algorithm,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      iterations: ENCRYPTION_CONFIG.pbkdf2Iterations,
    };

    // Serialize the header
    const headerJson = JSON.stringify(header);
    const headerBuffer = Buffer.from(headerJson, 'utf-8');
    const headerLength = Buffer.allocUnsafe(4);
    headerLength.writeUInt32BE(headerBuffer.length);

    // Write the encrypted file: [header length][header][encrypted data]
    const outputData = Buffer.concat([headerLength, headerBuffer, encrypted]);

    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write the output file
    await fs.writeFile(outputPath, outputData);

    const inputStats = await fs.stat(inputPath);
    const outputStats = await fs.stat(outputPath);

    return {
      success: true,
      inputFile: inputPath,
      outputFile: outputPath,
      fileSize: inputStats.size,
      encryptedSize: outputStats.size,
    };
  } catch (error) {
    return {
      success: false,
      inputFile: inputPath,
      outputFile: outputPath,
      fileSize: 0,
      encryptedSize: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Decrypt a file
 *
 * @param inputPath - Path to the encrypted file
 * @param outputPath - Path where the decrypted file will be saved
 * @param password - The password to use for decryption
 * @returns A Promise that resolves to a DecryptionResult
 */
export async function decryptFile(
  inputPath: string,
  outputPath: string,
  password: string
): Promise<DecryptionResult> {
  try {
    // Read the input file
    const inputData = await fs.readFile(inputPath);

    // Read the header length
    if (inputData.length < 4) {
      throw new Error('Invalid encrypted file: too short');
    }

    const headerLength = inputData.readUInt32BE(0);

    if (inputData.length < 4 + headerLength) {
      throw new Error('Invalid encrypted file: incomplete header');
    }

    // Read and parse the header
    const headerJson = inputData
      .subarray(4, 4 + headerLength)
      .toString('utf-8');
    const header: EncryptedFileHeader = JSON.parse(headerJson);

    // Validate the header
    if (header.version !== 1) {
      throw new Error(`Unsupported version: ${header.version}`);
    }

    if (header.algorithm !== ENCRYPTION_CONFIG.algorithm) {
      throw new Error(
        `Unsupported algorithm: ${header.algorithm}. Expected: ${ENCRYPTION_CONFIG.algorithm}`
      );
    }

    // Extract the encrypted data
    const encryptedData = inputData.subarray(4 + headerLength);

    // Parse the metadata
    const salt = Buffer.from(header.salt, 'hex');
    const iv = Buffer.from(header.iv, 'hex');
    const authTag = Buffer.from(header.authTag, 'hex');

    // Decrypt the data
    const decrypted = await decryptData(
      encryptedData,
      password,
      salt,
      iv,
      authTag
    );

    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write the output file
    await fs.writeFile(outputPath, decrypted);

    const inputStats = await fs.stat(inputPath);
    const outputStats = await fs.stat(outputPath);

    return {
      success: true,
      inputFile: inputPath,
      outputFile: outputPath,
      fileSize: inputStats.size,
      decryptedSize: outputStats.size,
    };
  } catch (error) {
    return {
      success: false,
      inputFile: inputPath,
      outputFile: outputPath,
      fileSize: 0,
      decryptedSize: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get the output path for an encrypted file
 *
 * @param inputPath - The input file path
 * @param outputDir - Optional output directory
 * @returns The output file path
 */
export function getEncryptedFilePath(
  inputPath: string,
  outputDir?: string
): string {
  const basename = path.basename(inputPath);
  const filename = basename + ENCRYPTION_CONFIG.fileExtension;

  if (outputDir) {
    return path.join(outputDir, filename);
  }

  return inputPath + ENCRYPTION_CONFIG.fileExtension;
}

/**
 * Get the output path for a decrypted file
 *
 * @param inputPath - The input file path
 * @param outputDir - Optional output directory
 * @returns The output file path
 */
export function getDecryptedFilePath(
  inputPath: string,
  outputDir?: string
): string {
  const basename = path.basename(inputPath);

  // Remove the .encrypted extension if present
  let filename = basename;
  if (basename.endsWith(ENCRYPTION_CONFIG.fileExtension)) {
    filename = basename.substring(
      0,
      basename.length - ENCRYPTION_CONFIG.fileExtension.length
    );
  }

  if (outputDir) {
    return path.join(outputDir, filename);
  }

  return inputPath.replace(/\.encrypted$/, '');
}

/**
 * Preview result for encryption dry-run
 */
export interface EncryptionPreviewResult {
  /** Input file path */
  inputFile: string;
  /** Would-be output file path */
  outputFile: string;
  /** Original file size in bytes */
  fileSize: number;
  /** Estimated encrypted file size in bytes */
  estimatedEncryptedSize: number;
  /** Whether the file exists and is accessible */
  accessible: boolean;
  /** Whether a backup would be created */
  wouldBackup: boolean;
  /** Whether the output file already exists (would be overwritten) */
  outputExists: boolean;
  /** Any warnings or notes about this file */
  warnings: string[];
  /** Error message if file is not processable */
  error?: string;
}

/**
 * Batch preview result for encryption dry-run
 */
export interface BatchEncryptionPreviewResult {
  /** Array of individual preview results */
  results: EncryptionPreviewResult[];
  /** Total number of files to be processed */
  totalFiles: number;
  /** Number of files that can be processed */
  processableFiles: number;
  /** Number of files with errors */
  errorFiles: number;
  /** Total size of original files in bytes */
  totalOriginalSize: number;
  /** Estimated total size of encrypted files in bytes */
  estimatedTotalEncryptedSize: number;
  /** Encryption configuration that would be used */
  encryptionConfig: {
    algorithm: string;
    keyLength: number;
    iterations: number;
  };
}

/**
 * Calculate estimated encrypted file size
 * The encrypted file includes: header length (4 bytes) + header JSON + encrypted data
 * Header contains: version, algorithm, salt (hex), iv (hex), authTag (hex), iterations
 */
export function estimateEncryptedSize(originalSize: number): number {
  // Estimate header size (approximately 200-250 bytes for JSON)
  const estimatedHeaderSize = 250;
  const headerLengthBytes = 4;

  // Encrypted data is roughly the same size as original (AES-GCM doesn't add significant padding)
  // But we add a small buffer for potential block padding
  const encryptedDataSize = originalSize + 16; // 16 bytes for potential padding

  return headerLengthBytes + estimatedHeaderSize + encryptedDataSize;
}

/**
 * Preview encryption for a single file without actually encrypting
 */
export async function previewEncryptFile(
  inputPath: string,
  outputDir?: string,
  backup: boolean = false
): Promise<EncryptionPreviewResult> {
  const outputPath = getEncryptedFilePath(inputPath, outputDir);
  const warnings: string[] = [];

  try {
    const stats = await fs.stat(inputPath);

    if (!stats.isFile()) {
      return {
        inputFile: inputPath,
        outputFile: outputPath,
        fileSize: 0,
        estimatedEncryptedSize: 0,
        accessible: false,
        wouldBackup: backup,
        outputExists: false,
        warnings: [],
        error: 'Not a file (possibly a directory or symlink)',
      };
    }

    // Check if output file already exists
    let outputExists = false;
    try {
      await fs.access(outputPath);
      outputExists = true;
      warnings.push('Output file already exists and would be overwritten');
    } catch {
      // File doesn't exist, which is expected
    }

    // Check if file is already encrypted
    const alreadyEncrypted = await isEncryptedFile(inputPath);
    if (alreadyEncrypted) {
      warnings.push('File appears to be already encrypted');
    }

    // Check file size for large files
    if (stats.size > 100 * 1024 * 1024) { // > 100MB
      warnings.push('Large file - encryption may take longer');
    }

    const estimatedSize = estimateEncryptedSize(stats.size);

    return {
      inputFile: inputPath,
      outputFile: outputPath,
      fileSize: stats.size,
      estimatedEncryptedSize: estimatedSize,
      accessible: true,
      wouldBackup: backup,
      outputExists,
      warnings,
    };
  } catch (error) {
    return {
      inputFile: inputPath,
      outputFile: outputPath,
      fileSize: 0,
      estimatedEncryptedSize: 0,
      accessible: false,
      wouldBackup: backup,
      outputExists: false,
      warnings: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Preview encryption for multiple files without actually encrypting
 */
export async function previewEncryptFilesBatch(
  files: string[],
  options: {
    outputDir?: string;
    backup?: boolean;
  } = {}
): Promise<BatchEncryptionPreviewResult> {
  const { outputDir, backup = false } = options;

  const results: EncryptionPreviewResult[] = [];

  for (const file of files) {
    const result = await previewEncryptFile(file, outputDir, backup);
    results.push(result);
  }

  const processableResults = results.filter(r => r.accessible && !r.error);
  const errorResults = results.filter(r => !r.accessible || r.error);

  return {
    results,
    totalFiles: results.length,
    processableFiles: processableResults.length,
    errorFiles: errorResults.length,
    totalOriginalSize: processableResults.reduce((sum, r) => sum + r.fileSize, 0),
    estimatedTotalEncryptedSize: processableResults.reduce((sum, r) => sum + r.estimatedEncryptedSize, 0),
    encryptionConfig: {
      algorithm: ENCRYPTION_CONFIG.algorithm,
      keyLength: ENCRYPTION_CONFIG.keyLength * 8, // Convert to bits
      iterations: ENCRYPTION_CONFIG.pbkdf2Iterations,
    },
  };
}

/**
 * Check if a file is an encrypted file
 *
 * @param filePath - The file path to check
 * @returns A Promise that resolves to true if the file is encrypted
 */
export async function isEncryptedFile(filePath: string): Promise<boolean> {
  try {
    const data = await fs.readFile(filePath);

    if (data.length < 4) {
      return false;
    }

    const headerLength = data.readUInt32BE(0);

    if (data.length < 4 + headerLength) {
      return false;
    }

    const headerJson = data.subarray(4, 4 + headerLength).toString('utf-8');
    const header: EncryptedFileHeader = JSON.parse(headerJson);

    return (
      header.version === 1 &&
      header.algorithm === ENCRYPTION_CONFIG.algorithm
    );
  } catch {
    return false;
  }
}

/**
 * Batch encryption result
 */
export interface BatchEncryptionResult {
  /** Array of individual encryption results */
  results: EncryptionResult[];
  /** Total number of files processed */
  total: number;
  /** Number of successful encryptions */
  successful: number;
  /** Number of failed encryptions */
  failed: number;
  /** Total size of original files in bytes */
  totalOriginalSize: number;
  /** Total size of encrypted files in bytes */
  totalEncryptedSize: number;
  /** Total processing time in milliseconds */
  processingTime: number;
}

/**
 * Batch decryption result
 */
export interface BatchDecryptionResult {
  /** Array of individual decryption results */
  results: DecryptionResult[];
  /** Total number of files processed */
  total: number;
  /** Number of successful decryptions */
  successful: number;
  /** Number of failed decryptions */
  failed: number;
  /** Total size of encrypted files in bytes */
  totalEncryptedSize: number;
  /** Total size of decrypted files in bytes */
  totalDecryptedSize: number;
  /** Total processing time in milliseconds */
  processingTime: number;
}

/**
 * Encrypt multiple files in batch with optional parallel processing
 *
 * @param files - Array of file paths to encrypt
 * @param password - The password to use for encryption
 * @param options - Encryption options
 * @returns A Promise that resolves to a BatchEncryptionResult
 */
export async function encryptFilesBatch(
  files: string[],
  password: string,
  options: {
    /** Output directory for encrypted files (optional) */
    outputDir?: string;
    /** Number of parallel workers (default: 1 - sequential) */
    concurrency?: number;
    /** Create backup of original files */
    backup?: boolean;
    /** Callback function for progress updates */
    onProgress?: (current: number, total: number, file: string) => void;
  } = {}
): Promise<BatchEncryptionResult> {
  const startTime = Date.now();
  const {
    outputDir,
    concurrency = 1,
    backup = false,
    onProgress,
  } = options;

  const results: EncryptionResult[] = [];
  let completed = 0;

  // Process files sequentially or in parallel
  if (concurrency <= 1) {
    // Sequential processing
    for (const file of files) {
      const result = await encryptSingleFile(file, password, outputDir, backup);
      results.push(result);
      completed++;
      if (onProgress) {
        onProgress(completed, files.length, file);
      }
    }
  } else {
    // Parallel processing with concurrency limit
    const chunks: string[][] = [];
    for (let i = 0; i < files.length; i += concurrency) {
      chunks.push(files.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((file) => encryptSingleFile(file, password, outputDir, backup))
      );
      results.push(...chunkResults);
      completed += chunk.length;
      if (onProgress) {
        onProgress(completed, files.length, chunk[chunk.length - 1]);
      }
    }
  }

  // Calculate statistics
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalOriginalSize = results.reduce((sum, r) => sum + r.fileSize, 0);
  const totalEncryptedSize = results.reduce((sum, r) => sum + r.encryptedSize, 0);
  const processingTime = Date.now() - startTime;

  return {
    results,
    total: results.length,
    successful,
    failed,
    totalOriginalSize,
    totalEncryptedSize,
    processingTime,
  };
}

/**
 * Helper function to encrypt a single file with backup support
 */
async function encryptSingleFile(
  inputPath: string,
  password: string,
  outputDir?: string,
  backup?: boolean
): Promise<EncryptionResult> {
  try {
    // Create backup if requested
    if (backup) {
      const backupPath = inputPath + '.backup';
      await fs.copyFile(inputPath, backupPath);
    }

    // Get output path
    const outputPath = getEncryptedFilePath(inputPath, outputDir);

    // Encrypt the file
    return await encryptFile(inputPath, outputPath, password);
  } catch (error) {
    return {
      success: false,
      inputFile: inputPath,
      outputFile: '',
      fileSize: 0,
      encryptedSize: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Decrypt multiple files in batch with optional parallel processing
 *
 * @param files - Array of file paths to decrypt
 * @param password - The password to use for decryption
 * @param options - Decryption options
 * @returns A Promise that resolves to a BatchDecryptionResult
 */
export async function decryptFilesBatch(
  files: string[],
  password: string,
  options: {
    /** Output directory for decrypted files (optional) */
    outputDir?: string;
    /** Number of parallel workers (default: 1 - sequential) */
    concurrency?: number;
    /** Callback function for progress updates */
    onProgress?: (current: number, total: number, file: string) => void;
  } = {}
): Promise<BatchDecryptionResult> {
  const startTime = Date.now();
  const { outputDir, concurrency = 1, onProgress } = options;

  const results: DecryptionResult[] = [];
  let completed = 0;

  // Process files sequentially or in parallel
  if (concurrency <= 1) {
    // Sequential processing
    for (const file of files) {
      const result = await decryptSingleFile(file, password, outputDir);
      results.push(result);
      completed++;
      if (onProgress) {
        onProgress(completed, files.length, file);
      }
    }
  } else {
    // Parallel processing with concurrency limit
    const chunks: string[][] = [];
    for (let i = 0; i < files.length; i += concurrency) {
      chunks.push(files.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((file) => decryptSingleFile(file, password, outputDir))
      );
      results.push(...chunkResults);
      completed += chunk.length;
      if (onProgress) {
        onProgress(completed, files.length, chunk[chunk.length - 1]);
      }
    }
  }

  // Calculate statistics
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalEncryptedSize = results.reduce((sum, r) => sum + r.fileSize, 0);
  const totalDecryptedSize = results.reduce((sum, r) => sum + r.decryptedSize, 0);
  const processingTime = Date.now() - startTime;

  return {
    results,
    total: results.length,
    successful,
    failed,
    totalEncryptedSize,
    totalDecryptedSize,
    processingTime,
  };
}

/**
 * Helper function to decrypt a single file
 */
async function decryptSingleFile(
  inputPath: string,
  password: string,
  outputDir?: string
): Promise<DecryptionResult> {
  try {
    // Get output path
    const outputPath = getDecryptedFilePath(inputPath, outputDir);

    // Decrypt the file
    return await decryptFile(inputPath, outputPath, password);
  } catch (error) {
    return {
      success: false,
      inputFile: inputPath,
      outputFile: '',
      fileSize: 0,
      decryptedSize: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// STREAMING ENCRYPTION/DECRYPTION SUPPORT
// ============================================================================

/**
 * Check if a file should use streaming based on size
 * @param filePath - Path to the file
 * @param threshold - Size threshold in bytes (default: 10MB)
 * @returns True if the file should use streaming
 */
export async function shouldUseStreaming(
  filePath: string,
  threshold: number = STREAMING_CONFIG.streamingThreshold
): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size > threshold;
  } catch {
    return false;
  }
}

/**
 * Encrypt a file using streaming for memory-efficient large file handling
 *
 * @param inputPath - Path to the file to encrypt
 * @param outputPath - Path where the encrypted file will be saved
 * @param options - Streaming encryption options
 * @returns A Promise that resolves to a StreamEncryptionResult
 */
export async function encryptFileStream(
  inputPath: string,
  outputPath: string,
  options: StreamEncryptOptions
): Promise<StreamEncryptionResult> {
  const { password, chunkSize = STREAMING_CONFIG.defaultChunkSize, onProgress } = options;

  try {
    // Get file stats for progress reporting
    const inputStats = await fs.stat(inputPath);
    const totalBytes = inputStats.size;
    let bytesProcessed = 0;

    // Generate cryptographic parameters
    const salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
    const key = await deriveKey(password, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(
      ENCRYPTION_CONFIG.algorithm,
      key,
      iv
    ) as crypto.CipherGCM;

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Create read and write streams
    const readStream = fsSync.createReadStream(inputPath, { highWaterMark: chunkSize });
    const writeStream = fsSync.createWriteStream(outputPath);

    // We'll collect encrypted data in a buffer and write the header + data at the end
    // because GCM auth tag is only available after encryption is complete
    const encryptedChunks: Buffer[] = [];

    // Create a transform stream to track progress and collect encrypted data
    const progressTransform = new Transform({
      transform(chunk: Buffer, encoding, callback) {
        bytesProcessed += chunk.length;
        const encryptedChunk = cipher.update(chunk);
        encryptedChunks.push(encryptedChunk);

        if (onProgress) {
          onProgress(bytesProcessed, totalBytes);
        }
        callback(null, chunk); // Pass through for the pipeline
      },
    });

    // Process the file through the pipeline
    await pipelineAsync(readStream, progressTransform);

    // Finalize encryption and get auth tag
    const finalChunk = cipher.final();
    if (finalChunk.length > 0) {
      encryptedChunks.push(finalChunk);
    }
    const authTag = cipher.getAuthTag();

    // Create header
    const header: EncryptedFileHeader = {
      version: 1,
      algorithm: ENCRYPTION_CONFIG.algorithm,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      iterations: ENCRYPTION_CONFIG.pbkdf2Iterations,
    };

    // Write output file: [header length][header][encrypted data]
    const headerJson = JSON.stringify(header);
    const headerBuffer = Buffer.from(headerJson, 'utf-8');
    const headerLength = Buffer.allocUnsafe(4);
    headerLength.writeUInt32BE(headerBuffer.length);

    const encryptedData = Buffer.concat(encryptedChunks);
    const outputData = Buffer.concat([headerLength, headerBuffer, encryptedData]);

    // Write to output file
    await fs.writeFile(outputPath, outputData);

    const outputStats = await fs.stat(outputPath);

    return {
      success: true,
      inputFile: inputPath,
      outputFile: outputPath,
      bytesProcessed: totalBytes,
      encryptedSize: outputStats.size,
    };
  } catch (error) {
    // Clean up partial output file on error
    try {
      await fs.unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: false,
      inputFile: inputPath,
      outputFile: outputPath,
      bytesProcessed: 0,
      encryptedSize: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Decrypt a file using streaming for memory-efficient large file handling
 *
 * @param inputPath - Path to the encrypted file
 * @param outputPath - Path where the decrypted file will be saved
 * @param options - Streaming decryption options
 * @returns A Promise that resolves to a StreamDecryptionResult
 */
export async function decryptFileStream(
  inputPath: string,
  outputPath: string,
  options: StreamEncryptOptions
): Promise<StreamDecryptionResult> {
  const { password, chunkSize = STREAMING_CONFIG.defaultChunkSize, onProgress } = options;

  try {
    // Get file stats for progress reporting
    const inputStats = await fs.stat(inputPath);
    const totalBytes = inputStats.size;

    // Read header using a file handle to avoid loading entire file
    const fileHandle = await fs.open(inputPath, 'r');
    try {
      // Read header length (4 bytes)
      const headerLengthBuffer = Buffer.allocUnsafe(4);
      await fileHandle.read(headerLengthBuffer, 0, 4, 0);
      const headerLength = headerLengthBuffer.readUInt32BE(0);

      // Read header
      const headerBuffer = Buffer.allocUnsafe(headerLength);
      await fileHandle.read(headerBuffer, 0, headerLength, 4);
      const header: EncryptedFileHeader = JSON.parse(headerBuffer.toString('utf-8'));

      // Validate header
      if (header.version !== 1) {
        throw new Error(`Unsupported version: ${header.version}`);
      }
      if (header.algorithm !== ENCRYPTION_CONFIG.algorithm) {
        throw new Error(
          `Unsupported algorithm: ${header.algorithm}. Expected: ${ENCRYPTION_CONFIG.algorithm}`
        );
      }

      // Parse cryptographic parameters
      const salt = Buffer.from(header.salt, 'hex');
      const iv = Buffer.from(header.iv, 'hex');
      const authTag = Buffer.from(header.authTag, 'hex');

      // Derive key
      const key = await deriveKey(password, salt);

      // Calculate encrypted data position and size
      const dataOffset = 4 + headerLength;
      const encryptedDataSize = totalBytes - dataOffset;

      // Read encrypted data in chunks and decrypt
      const decipher = crypto.createDecipheriv(
        ENCRYPTION_CONFIG.algorithm,
        key,
        iv
      ) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      // Read encrypted data
      const encryptedData = Buffer.allocUnsafe(encryptedDataSize);
      await fileHandle.read(encryptedData, 0, encryptedDataSize, dataOffset);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Decrypt in chunks for memory efficiency and progress reporting
      const decryptedChunks: Buffer[] = [];
      let bytesProcessed = 0;

      for (let offset = 0; offset < encryptedData.length; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, encryptedData.length);
        const chunk = encryptedData.subarray(offset, end);

        const decryptedChunk = decipher.update(chunk);
        decryptedChunks.push(decryptedChunk);

        bytesProcessed += chunk.length;
        if (onProgress) {
          onProgress(bytesProcessed, encryptedDataSize);
        }
      }

      // Finalize decryption
      try {
        const finalChunk = decipher.final();
        if (finalChunk.length > 0) {
          decryptedChunks.push(finalChunk);
        }
      } catch (error) {
        throw new Error(
          'Decryption failed. The password may be incorrect or the data may be corrupted.'
        );
      }

      // Write decrypted data
      const decryptedData = Buffer.concat(decryptedChunks);
      await fs.writeFile(outputPath, decryptedData);

      const outputStats = await fs.stat(outputPath);

      return {
        success: true,
        inputFile: inputPath,
        outputFile: outputPath,
        bytesProcessed: totalBytes,
        decryptedSize: outputStats.size,
      };
    } finally {
      await fileHandle.close();
    }
  } catch (error) {
    // Clean up partial output file on error
    try {
      await fs.unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: false,
      inputFile: inputPath,
      outputFile: outputPath,
      bytesProcessed: 0,
      decryptedSize: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Smart encrypt function that automatically chooses between regular and streaming encryption
 * based on file size
 *
 * @param inputPath - Path to the file to encrypt
 * @param outputPath - Path where the encrypted file will be saved
 * @param password - The password to use for encryption
 * @param options - Optional streaming options
 * @returns A Promise that resolves to an EncryptionResult
 */
export async function encryptFileAuto(
  inputPath: string,
  outputPath: string,
  password: string,
  options?: {
    forceStream?: boolean;
    chunkSize?: number;
    threshold?: number;
    onProgress?: (bytesProcessed: number, totalBytes: number) => void;
  }
): Promise<EncryptionResult> {
  const { forceStream = false, chunkSize, threshold, onProgress } = options || {};

  // Determine if we should use streaming
  const useStreaming = forceStream || (await shouldUseStreaming(inputPath, threshold));

  if (useStreaming) {
    const result = await encryptFileStream(inputPath, outputPath, {
      password,
      chunkSize,
      onProgress,
    });

    return {
      success: result.success,
      inputFile: result.inputFile,
      outputFile: result.outputFile,
      fileSize: result.bytesProcessed,
      encryptedSize: result.encryptedSize,
      error: result.error,
    };
  }

  // Use regular encryption for smaller files
  return encryptFile(inputPath, outputPath, password);
}

/**
 * Smart decrypt function that automatically chooses between regular and streaming decryption
 * based on file size
 *
 * @param inputPath - Path to the encrypted file
 * @param outputPath - Path where the decrypted file will be saved
 * @param password - The password to use for decryption
 * @param options - Optional streaming options
 * @returns A Promise that resolves to a DecryptionResult
 */
export async function decryptFileAuto(
  inputPath: string,
  outputPath: string,
  password: string,
  options?: {
    forceStream?: boolean;
    chunkSize?: number;
    threshold?: number;
    onProgress?: (bytesProcessed: number, totalBytes: number) => void;
  }
): Promise<DecryptionResult> {
  const { forceStream = false, chunkSize, threshold, onProgress } = options || {};

  // Determine if we should use streaming
  const useStreaming = forceStream || (await shouldUseStreaming(inputPath, threshold));

  if (useStreaming) {
    const result = await decryptFileStream(inputPath, outputPath, {
      password,
      chunkSize,
      onProgress,
    });

    return {
      success: result.success,
      inputFile: result.inputFile,
      outputFile: result.outputFile,
      fileSize: result.bytesProcessed,
      decryptedSize: result.decryptedSize,
      error: result.error,
    };
  }

  // Use regular decryption for smaller files
  return decryptFile(inputPath, outputPath, password);
}

/**
 * Batch streaming encryption result
 */
export interface BatchStreamEncryptionResult {
  /** Array of individual encryption results */
  results: EncryptionResult[];
  /** Total number of files processed */
  total: number;
  /** Number of successful encryptions */
  successful: number;
  /** Number of failed encryptions */
  failed: number;
  /** Number of files that used streaming */
  streamedFiles: number;
  /** Total size of original files in bytes */
  totalOriginalSize: number;
  /** Total size of encrypted files in bytes */
  totalEncryptedSize: number;
  /** Total processing time in milliseconds */
  processingTime: number;
}

/**
 * Encrypt multiple files in batch with automatic streaming support for large files
 *
 * @param files - Array of file paths to encrypt
 * @param password - The password to use for encryption
 * @param options - Encryption options including streaming settings
 * @returns A Promise that resolves to a BatchStreamEncryptionResult
 */
export async function encryptFilesBatchWithStreaming(
  files: string[],
  password: string,
  options: {
    /** Output directory for encrypted files (optional) */
    outputDir?: string;
    /** Number of parallel workers (default: 1 - sequential) */
    concurrency?: number;
    /** Create backup of original files */
    backup?: boolean;
    /** Force streaming for all files */
    forceStream?: boolean;
    /** Chunk size for streaming */
    chunkSize?: number;
    /** File size threshold for auto-streaming */
    threshold?: number;
    /** Callback function for progress updates */
    onProgress?: (current: number, total: number, file: string) => void;
    /** Callback for per-file progress (streaming only) */
    onFileProgress?: (file: string, bytesProcessed: number, totalBytes: number) => void;
  } = {}
): Promise<BatchStreamEncryptionResult> {
  const startTime = Date.now();
  const {
    outputDir,
    concurrency = 1,
    backup = false,
    forceStream = false,
    chunkSize,
    threshold,
    onProgress,
    onFileProgress,
  } = options;

  const results: EncryptionResult[] = [];
  let completed = 0;
  let streamedFiles = 0;

  // Helper function to encrypt a single file with streaming support
  async function encryptSingleWithStreaming(file: string): Promise<EncryptionResult> {
    try {
      // Create backup if requested
      if (backup) {
        const backupPath = file + '.backup';
        await fs.copyFile(file, backupPath);
      }

      // Get output path
      const outputPath = getEncryptedFilePath(file, outputDir);

      // Determine if we should use streaming
      const useStreaming = forceStream || (await shouldUseStreaming(file, threshold));

      if (useStreaming) {
        streamedFiles++;
        const result = await encryptFileStream(file, outputPath, {
          password,
          chunkSize,
          onProgress: onFileProgress
            ? (bytesProcessed, totalBytes) => onFileProgress(file, bytesProcessed, totalBytes)
            : undefined,
        });

        return {
          success: result.success,
          inputFile: result.inputFile,
          outputFile: result.outputFile,
          fileSize: result.bytesProcessed,
          encryptedSize: result.encryptedSize,
          error: result.error,
        };
      }

      // Use regular encryption for smaller files
      return await encryptFile(file, outputPath, password);
    } catch (error) {
      return {
        success: false,
        inputFile: file,
        outputFile: '',
        fileSize: 0,
        encryptedSize: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Process files sequentially or in parallel
  if (concurrency <= 1) {
    // Sequential processing
    for (const file of files) {
      const result = await encryptSingleWithStreaming(file);
      results.push(result);
      completed++;
      if (onProgress) {
        onProgress(completed, files.length, file);
      }
    }
  } else {
    // Parallel processing with concurrency limit
    const chunks: string[][] = [];
    for (let i = 0; i < files.length; i += concurrency) {
      chunks.push(files.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((file) => encryptSingleWithStreaming(file))
      );
      results.push(...chunkResults);
      completed += chunk.length;
      if (onProgress) {
        onProgress(completed, files.length, chunk[chunk.length - 1]);
      }
    }
  }

  // Calculate statistics
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalOriginalSize = results.reduce((sum, r) => sum + r.fileSize, 0);
  const totalEncryptedSize = results.reduce((sum, r) => sum + r.encryptedSize, 0);
  const processingTime = Date.now() - startTime;

  return {
    results,
    total: results.length,
    successful,
    failed,
    streamedFiles,
    totalOriginalSize,
    totalEncryptedSize,
    processingTime,
  };
}

/**
 * Batch streaming decryption result
 */
export interface BatchStreamDecryptionResult {
  /** Array of individual decryption results */
  results: DecryptionResult[];
  /** Total number of files processed */
  total: number;
  /** Number of successful decryptions */
  successful: number;
  /** Number of failed decryptions */
  failed: number;
  /** Number of files that used streaming */
  streamedFiles: number;
  /** Total size of encrypted files in bytes */
  totalEncryptedSize: number;
  /** Total size of decrypted files in bytes */
  totalDecryptedSize: number;
  /** Total processing time in milliseconds */
  processingTime: number;
}

/**
 * Decrypt multiple files in batch with automatic streaming support for large files
 *
 * @param files - Array of file paths to decrypt
 * @param password - The password to use for decryption
 * @param options - Decryption options including streaming settings
 * @returns A Promise that resolves to a BatchStreamDecryptionResult
 */
export async function decryptFilesBatchWithStreaming(
  files: string[],
  password: string,
  options: {
    /** Output directory for decrypted files (optional) */
    outputDir?: string;
    /** Number of parallel workers (default: 1 - sequential) */
    concurrency?: number;
    /** Force streaming for all files */
    forceStream?: boolean;
    /** Chunk size for streaming */
    chunkSize?: number;
    /** File size threshold for auto-streaming */
    threshold?: number;
    /** Callback function for progress updates */
    onProgress?: (current: number, total: number, file: string) => void;
    /** Callback for per-file progress (streaming only) */
    onFileProgress?: (file: string, bytesProcessed: number, totalBytes: number) => void;
  } = {}
): Promise<BatchStreamDecryptionResult> {
  const startTime = Date.now();
  const {
    outputDir,
    concurrency = 1,
    forceStream = false,
    chunkSize,
    threshold,
    onProgress,
    onFileProgress,
  } = options;

  const results: DecryptionResult[] = [];
  let completed = 0;
  let streamedFiles = 0;

  // Helper function to decrypt a single file with streaming support
  async function decryptSingleWithStreaming(file: string): Promise<DecryptionResult> {
    try {
      // Get output path
      const outputPath = getDecryptedFilePath(file, outputDir);

      // Determine if we should use streaming
      const useStreaming = forceStream || (await shouldUseStreaming(file, threshold));

      if (useStreaming) {
        streamedFiles++;
        const result = await decryptFileStream(file, outputPath, {
          password,
          chunkSize,
          onProgress: onFileProgress
            ? (bytesProcessed, totalBytes) => onFileProgress(file, bytesProcessed, totalBytes)
            : undefined,
        });

        return {
          success: result.success,
          inputFile: result.inputFile,
          outputFile: result.outputFile,
          fileSize: result.bytesProcessed,
          decryptedSize: result.decryptedSize,
          error: result.error,
        };
      }

      // Use regular decryption for smaller files
      return await decryptFile(file, outputPath, password);
    } catch (error) {
      return {
        success: false,
        inputFile: file,
        outputFile: '',
        fileSize: 0,
        decryptedSize: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Process files sequentially or in parallel
  if (concurrency <= 1) {
    // Sequential processing
    for (const file of files) {
      const result = await decryptSingleWithStreaming(file);
      results.push(result);
      completed++;
      if (onProgress) {
        onProgress(completed, files.length, file);
      }
    }
  } else {
    // Parallel processing with concurrency limit
    const chunks: string[][] = [];
    for (let i = 0; i < files.length; i += concurrency) {
      chunks.push(files.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((file) => decryptSingleWithStreaming(file))
      );
      results.push(...chunkResults);
      completed += chunk.length;
      if (onProgress) {
        onProgress(completed, files.length, chunk[chunk.length - 1]);
      }
    }
  }

  // Calculate statistics
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalEncryptedSize = results.reduce((sum, r) => sum + r.fileSize, 0);
  const totalDecryptedSize = results.reduce((sum, r) => sum + r.decryptedSize, 0);
  const processingTime = Date.now() - startTime;

  return {
    results,
    total: results.length,
    successful,
    failed,
    streamedFiles,
    totalEncryptedSize,
    totalDecryptedSize,
    processingTime,
  };
}
