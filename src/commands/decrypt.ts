/**
 * Decrypt Command
 *
 * Decrypt files encrypted with the encrypt command
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { validateInput, schemas } from '../validation/index.js';
import {
  decryptFilesBatch,
  decryptFilesBatchWithStreaming,
  getDecryptedFilePath,
  isEncryptedFile,
  DecryptionResult,
  BatchDecryptionResult,
  BatchStreamDecryptionResult,
  STREAMING_CONFIG,
} from '../utils/encryption.js';
import { promptPassword } from '../utils/password.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { discoverFiles } from '../utils/fileDiscovery.js';
import {
  ValidationError,
  DecryptionError,
  FileNotFoundError,
  withErrorHandling,
} from '../errors/index.js';
import { formatFileSize } from '../utils/fileDiscovery.js';
import { Encryption } from '../config/helpers.js';
import { withProgressSpinner, SpinnerPresets, withSpinner } from '../utils/spinner.js';
import {
  retrievePassword,
  generateAccountName,
} from '../utils/keychain.js';

/**
 * Create a visual progress bar
 * @param percent - Progress percentage (0-100)
 * @param width - Width of the progress bar in characters
 * @returns A string representation of the progress bar
 */
function createProgressBar(percent: number, width: number = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `[${chalk.magenta('█'.repeat(filled))}${chalk.gray('░'.repeat(empty))}]`;
}

export const decryptCommand = new Command('decrypt')
  .description('Decrypt files encrypted with AES-256-GCM')
  .alias('dec')
  .option('-f, --files <files...>', 'Encrypted files to decrypt')
  .option('-d, --directory <path>', 'Decrypt all files in directory')
  .option('-p, --password <password>', 'Decryption password (prompted if not provided)')
  .option('-o, --output <path>', 'Output directory for decrypted files')
  .option('--filter <pattern>', 'Filter by file type (e.g., "*.encrypted")')
  .option('--dry-run', 'Preview decryption without applying')
  .option('--parallel <number>', 'Number of parallel workers', '4')
  .option('--stream', 'Force streaming mode for large file support')
  .option('--chunk-size <bytes>', 'Chunk size for streaming (default: 64KB)', String(STREAMING_CONFIG.defaultChunkSize))
  .option('--stream-threshold <bytes>', 'File size threshold for auto-streaming (default: 10MB)', String(STREAMING_CONFIG.streamingThreshold))
  .option('--use-saved <name>', 'Use password from OS keychain by name')
  .option('--keychain-service <service>', 'Custom keychain service name')
  .action(withErrorHandling(async (options) => {
    // Validate inputs using new error handling
    const validation = validateInput(schemas.decrypt, options, 'Decrypt command');

    if (!validation.success) {
      throw new ValidationError({
        code: 'DECRYPT_VALIDATION_FAILED',
        message: 'Input validation failed for decrypt command',
        userMessage: 'Invalid input provided for decryption operation',
        suggestions: validation.errors,
        context: { errors: validation.errors },
      });
    }

    console.log(chalk.blue.bold('🔓 Decrypt Command'));
    console.log(chalk.gray('Decrypt AES-256-GCM encrypted files\n'));

    if (options.dryRun) {
      console.log(chalk.yellow('⚠️  Dry-run mode: No changes will be applied\n'));
    }

    // Determine keychain service
    const keychainService = options.keychainService || Encryption.getKeychainService();

    // Get password
    let password = options.password;

    // Try to retrieve password from keychain if --use-saved is specified
    if (options.useSaved && !password) {
      const keychainAccountName = generateAccountName(options.useSaved, 'encrypt');
      console.log(chalk.blue(`🔑 Retrieving password from OS keychain: ${options.useSaved}`));

      const keychainResult = await retrievePassword(keychainAccountName, { service: keychainService });

      if (keychainResult.success && keychainResult.data) {
        password = keychainResult.data;
        console.log(chalk.green('✓ Password retrieved from keychain\n'));
      } else {
        console.error(chalk.red(`❌ Failed to retrieve password from keychain: ${keychainResult.error}`));
        console.error(chalk.yellow('Please provide the password manually or save it first.\n'));
        process.exit(1);
      }
    }

    if (!password) {
      try {
        password = await promptPassword('Enter decryption password: ');
        console.log(); // Add newline after password prompt
      } catch (error) {
        console.error(chalk.red('\n❌ Password entry cancelled'));
        process.exit(1);
      }
    }

    // Collect files to decrypt
    let filesToDecrypt: string[] = [];

    if (options.files && options.files.length > 0) {
      filesToDecrypt = options.files;
    } else if (options.directory) {
      const filter = options.filter || '*.encrypted';
      const result = await withSpinner(
        () => discoverFiles({
          patterns: filter,
          cwd: options.directory,
          onlyFiles: true,
        }),
        `Scanning directory: ${options.directory}...`,
        undefined,
        'Failed to scan directory',
        { color: 'cyan' }
      );

      filesToDecrypt = result.files.map((f) => path.join(options.directory, f));

      console.log(chalk.gray(`📂 Found ${result.count} file(s)\n`));
    } else {
      console.error(chalk.red('❌ No files specified'));
      console.error(chalk.yellow('Use --files or --directory to specify files to decrypt\n'));
      process.exit(1);
    }

    if (filesToDecrypt.length === 0) {
      console.log(chalk.yellow('⚠️  No files to decrypt'));
      return;
    }

    // Decrypt files using batch processing
    const outputDir = options.output;
    const parallelWorkers = parseInt(options.parallel, 10);

    if (options.dryRun) {
      // Dry run mode - process sequentially and show what would happen
      console.log(chalk.blue('\n🔍 Preview Mode:\n'));

      // Analyze files with progress indicator
      interface FilePreview {
        file: string;
        accessible: boolean;
        isEncrypted: boolean;
        outputPath?: string;
        size?: number;
        error?: string;
      }

      const previewResults: FilePreview[] = await withProgressSpinner(
        async (spinner) => {
          const results: FilePreview[] = [];
          for (let i = 0; i < filesToDecrypt.length; i++) {
            const file = filesToDecrypt[i];
            const progress = Math.round(((i + 1) / filesToDecrypt.length) * 100);
            const progressBar = createProgressBar(progress);
            spinner.text = `${progressBar} ${progress}% | Analyzing: ${path.basename(file)}`;

            try {
              const stats = await fs.stat(file);
              if (!stats.isFile()) {
                results.push({ file, accessible: false, isEncrypted: false, error: 'Not a file' });
                continue;
              }

              const encrypted = await isEncryptedFile(file);
              if (!encrypted) {
                results.push({ file, accessible: true, isEncrypted: false });
                continue;
              }

              const outputPath = getDecryptedFilePath(file, outputDir);
              results.push({
                file,
                accessible: true,
                isEncrypted: true,
                outputPath,
                size: stats.size,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              results.push({ file, accessible: false, isEncrypted: false, error: message });
            }
          }
          return results;
        },
        'Analyzing files for decryption...',
        { color: 'cyan' }
      );

      console.log(); // Add spacing after spinner

      // Display preview results
      let validFiles = 0;
      for (const result of previewResults) {
        if (result.error) {
          console.log(chalk.red(`  ✗ ${path.basename(result.file)}: ${result.error}`));
        } else if (!result.isEncrypted) {
          console.log(chalk.yellow(`  ⏭️  Skipping (not encrypted): ${result.file}`));
        } else if (result.accessible && result.isEncrypted) {
          validFiles++;
          console.log(chalk.gray(`  📄 ${result.file}`));
          console.log(chalk.gray(`     → Would create: ${result.outputPath}`));
          console.log(chalk.gray(`     Size: ${formatFileSize(result.size || 0)}`));
        }
      }

      console.log();
      console.log(chalk.blue.bold('📊 Summary'));
      console.log(chalk.white(`Total files: ${filesToDecrypt.length}`));
      console.log(chalk.green(`✓ Can be decrypted: ${validFiles}`));
      if (filesToDecrypt.length - validFiles > 0) {
        console.log(chalk.yellow(`⏭️  Skipped: ${filesToDecrypt.length - validFiles}`));
      }
      console.log(chalk.yellow('\n⚠️  Dry-run complete - no files were modified\n'));
      return;
    }

    // Parse streaming options
    const forceStream = options.stream || false;
    const chunkSize = options.chunkSize ? parseInt(options.chunkSize, 10) : STREAMING_CONFIG.defaultChunkSize;
    const streamThreshold = options.streamThreshold ? parseInt(options.streamThreshold, 10) : STREAMING_CONFIG.streamingThreshold;

    // Use batch decryption with progress callback
    console.log(chalk.blue(`\n🔓 Decrypting ${filesToDecrypt.length} file(s)...`));

    if (forceStream) {
      console.log(chalk.cyan('🌊 Streaming mode enabled for large file support'));
    }
    console.log();

    const batchResult: BatchStreamDecryptionResult = await withProgressSpinner(
      async (spinner) => {
        return decryptFilesBatchWithStreaming(
          filesToDecrypt,
          password,
          {
            outputDir,
            concurrency: parallelWorkers,
            forceStream,
            chunkSize,
            threshold: streamThreshold,
            onProgress: (current, total, file) => {
              const progress = Math.round((current / total) * 100);
              const progressBar = createProgressBar(progress);
              spinner.text = `${progressBar} ${progress}% | Decrypting: ${path.basename(file)}`;
            },
          }
        );
      },
      'Starting decryption...',
      { color: 'magenta' }
    );

    // Display results
    console.log();
    for (const result of batchResult.results) {
      if (result.success) {
        console.log(chalk.green(`✓ Decrypted: ${result.outputFile}`));
        console.log(
          chalk.gray(
            `  Size: ${formatFileSize(result.fileSize)} → ${formatFileSize(result.decryptedSize)}`
          )
        );
      } else {
        console.log(chalk.red(`✗ Failed: ${result.inputFile}`));
        console.log(chalk.red(`  Error: ${result.error}`));

        // Throw a structured error for decryption failures
        if (result.error?.includes('wrong password') || result.error?.includes('corrupted')) {
          throw new DecryptionError({
            code: 'DECRYPTION_FAILED',
            message: result.error,
            userMessage: 'Could not decrypt the file. The password might be incorrect.',
            suggestions: [
              'Verify the decryption password is correct',
              'Ensure the file was encrypted with the same algorithm',
              'Check if the file is corrupted',
            ],
          });
        }
      }
    }

    // Summary
    console.log();
    console.log(chalk.blue.bold('📊 Summary'));
    console.log(chalk.white(`Total files: ${batchResult.total}`));
    console.log(chalk.green(`✓ Decrypted: ${batchResult.successful}`));

    if (batchResult.failed > 0) {
      console.log(chalk.red(`✗ Failed: ${batchResult.failed}`));
    }

    if (batchResult.streamedFiles > 0) {
      console.log(chalk.cyan(`🌊 Streamed: ${batchResult.streamedFiles} (large files)`));
    }

    console.log(chalk.gray(`Processing time: ${batchResult.processingTime}ms`));
    console.log(
      chalk.gray(
        `Total size: ${formatFileSize(batchResult.totalEncryptedSize)} → ${formatFileSize(batchResult.totalDecryptedSize)}`
      )
    );

    if (batchResult.failed > 0) {
      process.exit(1);
    }

    console.log(chalk.green('\n✓ Decryption complete\n'));
  }));
