/**
 * Encrypt Command
 *
 * Advanced file encryption with password-based keys using AES-256-GCM
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { validateInput, schemas } from '../validation/index.js';
import {
  encryptFilesBatch,
  encryptFilesBatchWithStreaming,
  getEncryptedFilePath,
  previewEncryptFilesBatch,
  EncryptionResult,
  BatchEncryptionResult,
  BatchStreamEncryptionResult,
  EncryptionPreviewResult,
  BatchEncryptionPreviewResult,
  STREAMING_CONFIG,
} from '../utils/encryption.js';
import { promptPassword, validatePassword } from '../utils/password.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { discoverFiles } from '../utils/fileDiscovery.js';
import { formatFileSize } from '../utils/fileDiscovery.js';
import { getAuditLogger } from '../audit/index.js';
import { Encryption } from '../config/helpers.js';
import { withProgressSpinner, SpinnerPresets, withSpinner } from '../utils/spinner.js';
import {
  storePassword,
  retrievePassword,
  generateAccountName,
  isKeychainAvailable,
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

export const encryptCommand = new Command('encrypt')
  .description('Encrypt files with AES-256-GCM encryption')
  .alias('enc')
  .option('-f, --files <files...>', 'Files to encrypt')
  .option('-d, --directory <path>', 'Encrypt all files in directory')
  .option('-p, --password <password>', 'Encryption password (prompted if not provided)')
  .option('-o, --output <path>', 'Output directory for encrypted files')
  .option('--filter <pattern>', 'Filter by file type (e.g., "*.txt")')
  .option('--dry-run', 'Preview encryption without applying')
  .option('--backup <boolean>', 'Create backup of original files (default: true from config)')
  .option('--no-backup', 'Disable automatic backup')
  .option('--parallel <number>', 'Number of parallel workers', '4')
  .option('--stream', 'Force streaming mode for large file support')
  .option('--chunk-size <bytes>', 'Chunk size for streaming (default: 64KB)', String(STREAMING_CONFIG.defaultChunkSize))
  .option('--stream-threshold <bytes>', 'File size threshold for auto-streaming (default: 10MB)', String(STREAMING_CONFIG.streamingThreshold))
  .option('--save-password [name]', 'Save password to OS keychain with optional custom name')
  .option('--use-saved <name>', 'Use password from OS keychain by name')
  .option('--keychain-service <service>', 'Custom keychain service name')
  .action(async (options) => {
    const auditLogger = getAuditLogger();

    // Validate inputs
    const validation = validateInput(schemas.encrypt, options, 'Encrypt command');

    if (!validation.success) {
      console.error(chalk.red.bold('❌ Validation Error'));
      validation.errors.forEach((error) => {
        console.error(chalk.red(`  • ${error}`));
      });
      console.error(chalk.yellow('\nPlease fix these issues and try again.\n'));

      await auditLogger.logFailure('file_encrypt', 'Encrypt validation failed', validation.errors.join(', '));

      process.exit(1);
    }

    console.log(chalk.blue.bold('🔐 Encrypt Command'));
    console.log(chalk.gray('Advanced file encryption with AES-256-GCM\n'));

    if (options.dryRun) {
      console.log(chalk.yellow('⚠️  Dry-run mode: No changes will be applied\n'));
    }

    await auditLogger.logStart('file_encrypt', 'File encryption command started');

    // Determine keychain service
    const keychainService = options.keychainService || Encryption.getKeychainService();
    let passwordFromKeychain = false;
    let keychainAccountName: string | null = null;

    // Get password
    let password = options.password;

    // Try to retrieve password from keychain if --use-saved is specified
    if (options.useSaved && !password) {
      keychainAccountName = generateAccountName(options.useSaved, 'encrypt');
      console.log(chalk.blue(`🔑 Retrieving password from OS keychain: ${options.useSaved}`));

      const keychainResult = await retrievePassword(keychainAccountName, { service: keychainService });

      if (keychainResult.success && keychainResult.data) {
        password = keychainResult.data;
        passwordFromKeychain = true;
        console.log(chalk.green('✓ Password retrieved from keychain\n'));
      } else {
        console.error(chalk.red(`❌ Failed to retrieve password from keychain: ${keychainResult.error}`));
        console.error(chalk.yellow('Please provide the password manually or save it first.\n'));
        process.exit(1);
      }
    }

    if (!password) {
      try {
        password = await promptPassword('Enter encryption password: ');
        console.log(); // Add newline after password prompt
      } catch (error) {
        console.error(chalk.red('\n❌ Password entry cancelled'));
        process.exit(1);
      }
    }

    // Validate password with detailed feedback
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      console.error(chalk.red.bold(`❌ Invalid Password`));
      passwordValidation.errors.forEach((error) => {
        console.error(chalk.red(`  • ${error}`));
      });

      if (passwordValidation.warnings.length > 0) {
        console.error(chalk.yellow('\n⚠️  Warnings:'));
        passwordValidation.warnings.forEach((warning) => {
          console.error(chalk.yellow(`  • ${warning}`));
        });
      }

      if (passwordValidation.suggestions.length > 0) {
        console.error(chalk.cyan('\n💡 Suggestions:'));
        passwordValidation.suggestions.slice(0, 3).forEach((suggestion) => {
          console.error(chalk.cyan(`  • ${suggestion}`));
        });
      }

      console.error(chalk.yellow('\nPlease use a stronger password and try again.\n'));
      process.exit(1);
    }

    // Display password strength information
    const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const strengthColors = [
      chalk.red,      // Very Weak
      chalk.red,      // Weak
      chalk.yellow,   // Fair
      chalk.yellow,   // Good
      chalk.green,    // Strong
      chalk.green,    // Very Strong
    ];
    const strengthLabel = strengthLabels[passwordValidation.strength];
    const strengthColor = strengthColors[passwordValidation.strength];

    console.log(strengthColor(`🔒 Password Strength: ${strengthLabel} (${passwordValidation.score}/100)`));

    if (passwordValidation.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      passwordValidation.warnings.forEach((warning) => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }

    if (passwordValidation.suggestions.length > 0 && passwordValidation.strength < 3) {
      console.log(chalk.cyan('\n💡 Suggestions for stronger password:'));
      passwordValidation.suggestions.slice(0, 3).forEach((suggestion) => {
        console.log(chalk.cyan(`  • ${suggestion}`));
      });
      console.log();
    } else {
      console.log();
    }

    // Collect files to encrypt
    let filesToEncrypt: string[] = [];

    if (options.files && options.files.length > 0) {
      filesToEncrypt = options.files;
    } else if (options.directory) {
      const filter = options.filter || '*';
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

      filesToEncrypt = result.files.map((f) => path.join(options.directory, f));

      console.log(chalk.gray(`📂 Found ${result.count} file(s)\n`));
    } else {
      console.error(chalk.red('❌ No files specified'));
      console.error(chalk.yellow('Use --files or --directory to specify files to encrypt\n'));
      process.exit(1);
    }

    if (filesToEncrypt.length === 0) {
      console.log(chalk.yellow('⚠️  No files to encrypt'));
      return;
    }

    // Encrypt files using batch processing
    const outputDir = options.output;
    const parallelWorkers = parseInt(options.parallel, 10);

    if (options.dryRun) {
      // Determine backup setting for preview
      const shouldBackup = options.backup !== undefined ? options.backup : Encryption.shouldBackupOriginal();

      // Use enhanced preview mode
      console.log(chalk.blue('\n🔍 Preview Mode - Encryption Dry Run\n'));

      const previewResult = await withSpinner(
        () => previewEncryptFilesBatch(filesToEncrypt, {
          outputDir,
          backup: shouldBackup,
        }),
        'Analyzing files for encryption...',
        'File analysis complete',
        'Failed to analyze files',
        { color: 'cyan' }
      );

      console.log(); // Add spacing after spinner

      // Display encryption configuration
      console.log(chalk.cyan.bold('📋 Encryption Configuration'));
      console.log(chalk.gray(`  Algorithm: ${previewResult.encryptionConfig.algorithm.toUpperCase()}`));
      console.log(chalk.gray(`  Key Length: ${previewResult.encryptionConfig.keyLength} bits`));
      console.log(chalk.gray(`  PBKDF2 Iterations: ${previewResult.encryptionConfig.iterations.toLocaleString()}`));
      console.log(chalk.gray(`  Backup Enabled: ${shouldBackup ? 'Yes' : 'No'}`));
      console.log();

      // Display file details
      console.log(chalk.cyan.bold('📁 Files to Encrypt\n'));

      for (const result of previewResult.results) {
        if (result.accessible && !result.error) {
          console.log(chalk.white(`  📄 ${path.basename(result.inputFile)}`));
          console.log(chalk.gray(`     Input:  ${result.inputFile}`));
          console.log(chalk.gray(`     Output: ${result.outputFile}`));
          console.log(chalk.gray(`     Size:   ${formatFileSize(result.fileSize)} → ~${formatFileSize(result.estimatedEncryptedSize)}`));

          if (result.wouldBackup) {
            console.log(chalk.blue(`     📦 Backup: ${result.inputFile}.backup`));
          }

          if (result.warnings.length > 0) {
            for (const warning of result.warnings) {
              console.log(chalk.yellow(`     ⚠️  ${warning}`));
            }
          }
          console.log();
        } else {
          console.log(chalk.red(`  ❌ ${path.basename(result.inputFile)}`));
          console.log(chalk.gray(`     Path: ${result.inputFile}`));
          console.log(chalk.red(`     Error: ${result.error}`));
          console.log();
        }
      }

      // Display summary
      console.log(chalk.blue.bold('📊 Summary'));
      console.log(chalk.white(`  Total files:        ${previewResult.totalFiles}`));
      console.log(chalk.green(`  ✓ Can be encrypted: ${previewResult.processableFiles}`));

      if (previewResult.errorFiles > 0) {
        console.log(chalk.red(`  ✗ Cannot process:   ${previewResult.errorFiles}`));
      }

      console.log(chalk.gray(`  Original size:      ${formatFileSize(previewResult.totalOriginalSize)}`));
      console.log(chalk.gray(`  Estimated output:   ~${formatFileSize(previewResult.estimatedTotalEncryptedSize)}`));

      console.log(chalk.yellow('\n⚠️  Dry-run complete - no files were modified'));
      console.log(chalk.gray('Run without --dry-run to perform actual encryption\n'));

      await auditLogger.logSuccess('file_encrypt', 'Encryption preview completed (dry-run)', undefined, {
        dryRun: true,
        totalFiles: previewResult.totalFiles,
        processableFiles: previewResult.processableFiles,
        errorFiles: previewResult.errorFiles,
      });

      return;
    }

    // Determine backup setting: use CLI flag if provided, otherwise use config default
    const shouldBackup = options.backup !== undefined ? options.backup : Encryption.shouldBackupOriginal();

    // Parse streaming options
    const forceStream = options.stream || false;
    const chunkSize = options.chunkSize ? parseInt(options.chunkSize, 10) : STREAMING_CONFIG.defaultChunkSize;
    const streamThreshold = options.streamThreshold ? parseInt(options.streamThreshold, 10) : STREAMING_CONFIG.streamingThreshold;

    // Use batch encryption with progress callback
    console.log(chalk.blue(`\n🔐 Encrypting ${filesToEncrypt.length} file(s)...`));

    if (forceStream) {
      console.log(chalk.cyan('🌊 Streaming mode enabled for large file support'));
    }

    if (shouldBackup) {
      console.log(chalk.blue('📦 Automatic backup enabled'));
    }
    console.log();

    const batchResult: BatchStreamEncryptionResult = await withProgressSpinner(
      async (spinner) => {
        return encryptFilesBatchWithStreaming(
          filesToEncrypt,
          password,
          {
            outputDir,
            concurrency: parallelWorkers,
            backup: shouldBackup,
            forceStream,
            chunkSize,
            threshold: streamThreshold,
            onProgress: (current, total, file) => {
              const progress = Math.round((current / total) * 100);
              const progressBar = createProgressBar(progress);
              spinner.text = `${progressBar} ${progress}% | Encrypting: ${path.basename(file)}`;
            },
          }
        );
      },
      'Starting encryption...',
      { color: 'magenta' }
    );

    // Display results
    console.log();
    for (const result of batchResult.results) {
      if (result.success) {
        console.log(chalk.green(`✓ Encrypted: ${result.outputFile}`));
        console.log(
          chalk.gray(
            `  Size: ${formatFileSize(result.fileSize)} → ${formatFileSize(result.encryptedSize)}`
          )
        );
      } else {
        console.log(chalk.red(`✗ Failed: ${result.inputFile}`));
        console.log(chalk.red(`  Error: ${result.error}`));
      }
    }

    // Summary
    console.log();
    console.log(chalk.blue.bold('📊 Summary'));
    console.log(chalk.white(`Total files: ${batchResult.total}`));
    console.log(chalk.green(`✓ Encrypted: ${batchResult.successful}`));

    if (batchResult.failed > 0) {
      console.log(chalk.red(`✗ Failed: ${batchResult.failed}`));
    }

    if (batchResult.streamedFiles > 0) {
      console.log(chalk.cyan(`🌊 Streamed: ${batchResult.streamedFiles} (large files)`));
    }

    console.log(chalk.gray(`Processing time: ${batchResult.processingTime}ms`));
    console.log(
      chalk.gray(
        `Total size: ${formatFileSize(batchResult.totalOriginalSize)} → ${formatFileSize(batchResult.totalEncryptedSize)}`
      )
    );

    if (batchResult.failed > 0) {
      process.exit(1);
    }

    console.log(chalk.green('\n✓ Encryption complete\n'));

    // Save password to keychain if requested
    if (options.savePassword && !options.dryRun && !passwordFromKeychain) {
      // Determine the account name for saving
      const saveName = typeof options.savePassword === 'string'
        ? options.savePassword
        : (options.directory
          ? path.basename(options.directory)
          : 'default');
      const saveAccountName = generateAccountName(saveName, 'encrypt');

      console.log(chalk.blue(`🔑 Saving password to OS keychain as: ${saveName}`));

      const keychainAvailable = await isKeychainAvailable();
      if (!keychainAvailable) {
        console.error(chalk.yellow('⚠️  OS keychain is not available on this system'));
      } else {
        const saveResult = await storePassword(saveAccountName, password, { service: keychainService });

        if (saveResult.success) {
          console.log(chalk.green(`✓ Password saved to keychain. Use --use-saved "${saveName}" to retrieve it.\n`));
        } else {
          console.error(chalk.red(`❌ Failed to save password: ${saveResult.error}\n`));
        }
      }
    }

    // Log successful batch operation
    await auditLogger.logBatchOperation(
      'Batch file encryption',
      {
        total: batchResult.total,
        successful: batchResult.successful,
        failed: batchResult.failed,
        duration: batchResult.processingTime,
      },
      options.directory || filesToEncrypt.join(', ')
    );
  });
