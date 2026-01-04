/**
 * File Operations Command
 *
 * Advanced copy, move, and delete operations with powerful filtering
 * and smart conflict resolution strategies
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { validateInput, schemas } from '../validation/index.js';
import { handleError } from '../errors/ErrorHandler.js';
import {
  copy,
  move,
  deletePath,
  deleteMultiple,
  parseConflictStrategy,
  getAvailableStrategies,
  ConflictStrategy,
} from '../utils/fileOperations.js';
import { getAuditLogger } from '../audit/index.js';

// Build the conflict strategy descriptions for help text
const strategyHelp = getAvailableStrategies()
  .map((s) => `    ${s.name.padEnd(15)} ${s.description}`)
  .join('\n');

export const fileOpsCommand = new Command('fileops')
  .description('Advanced file operations (copy, move, delete) with smart conflict resolution')
  .alias('fo')
  .option('-c, --copy <source> <destination>', 'Copy files or directories')
  .option('-m, --move <source> <destination>', 'Move files or directories')
  .option('-d, --delete <path...>', 'Delete files or directories')
  .option('--filter <pattern>', 'Filter files by glob pattern')
  .option('--regex <pattern>', 'Filter files by regex pattern')
  .option('--recursive', 'Process directories recursively')
  .option('--depth <number>', 'Maximum depth for recursive operations', '10')
  .option('--dry-run', 'Preview operations without applying')
  .option('--preserve', 'Preserve permissions and timestamps')
  .option('--overwrite', 'Overwrite existing files (same as --conflict-strategy overwrite)')
  .option('--trash', 'Move deleted files to system trash/recycle bin (default: true)')
  .option('--no-trash', 'Permanently delete files instead of moving to trash')
  .option(
    '--conflict-strategy <strategy>',
    'Conflict resolution strategy (skip, overwrite, rename, keep-newer, keep-older, keep-larger, keep-smaller, backup, skip-identical, merge)'
  )
  .option('--list-strategies', 'List all available conflict resolution strategies')
  .addHelpText('after', '\nExamples:\n' +
    '  $ fileops --copy srcdir destdir --recursive --depth 2\n' +
    '  $ fileops --copy srcdir destdir --filter "*.ts"\n' +
    '  $ fileops --copy src dest --conflict-strategy rename\n' +
    '  $ fileops --copy src dest --conflict-strategy keep-newer\n' +
    '  $ fileops --copy src dest --conflict-strategy backup\n' +
    '  $ fileops --move old.txt new.txt\n' +
    '  $ fileops --move src dest --conflict-strategy skip-identical\n' +
    '  $ fileops --delete file1.txt file2.txt --recursive\n' +
    '  $ fileops --delete file.txt --no-trash  # Permanent deletion\n' +
    '  $ fileops --list-strategies\n' +
    '\nConflict Resolution Strategies:\n' + strategyHelp + '\n')
  .action(async (options, command) => {
    const auditLogger = getAuditLogger();

    // Handle --list-strategies flag
    if (options.listStrategies) {
      console.log(chalk.blue.bold('\n📋 Available Conflict Resolution Strategies\n'));
      getAvailableStrategies().forEach((s) => {
        console.log(`  ${chalk.cyan(s.name.padEnd(15))} ${chalk.gray(s.description)}`);
      });
      console.log('');
      return;
    }

    // Commander doesn't properly handle multiple values in options, so we need to parse from process.argv
    const argv = process.argv;
    const copyIndex = argv.findIndex(arg => arg === '--copy' || arg === '-c');
    const moveIndex = argv.findIndex(arg => arg === '--move' || arg === '-m');

    // Parse copy arguments from command line
    if (copyIndex !== -1 && copyIndex + 2 < argv.length) {
      options.copy = [argv[copyIndex + 1], argv[copyIndex + 2]];
    }

    // Parse move arguments from command line
    if (moveIndex !== -1 && moveIndex + 2 < argv.length) {
      options.move = [argv[moveIndex + 1], argv[moveIndex + 2]];
    }

    // Parse conflict strategy
    let conflictStrategy: ConflictStrategy | undefined;
    if (options.conflictStrategy) {
      const strategy = parseConflictStrategy(options.conflictStrategy);
      if (!strategy) {
        console.error(chalk.red.bold('❌ Invalid conflict strategy: ' + options.conflictStrategy));
        console.log(chalk.gray('Available strategies:'));
        getAvailableStrategies().forEach((s) => {
          console.log(chalk.gray(`  - ${s.name}: ${s.description}`));
        });
        process.exit(1);
      }
      conflictStrategy = strategy;
    } else if (options.overwrite) {
      conflictStrategy = ConflictStrategy.OVERWRITE;
    }

    try {
      // Validate inputs
      const validation = validateInput(schemas.fileops, options, 'File operations command');

      if (!validation.success) {
        console.error(chalk.red.bold('❌ Validation Error'));
        validation.errors.forEach((error) => {
          console.error(chalk.red(`  • ${error}`));
        });
        console.error(chalk.yellow('\nPlease fix these issues and try again.\n'));
        process.exit(1);
      }

      console.log(chalk.blue.bold('📁 File Operations Command'));
      console.log(chalk.gray('Advanced file operations with smart conflict resolution\n'));

      if (options.dryRun) {
        console.log(chalk.yellow('⚠️  Dry-run mode: No changes will be applied\n'));
      }

      if (conflictStrategy) {
        console.log(chalk.cyan(`🔄 Conflict Strategy: ${conflictStrategy}\n`));
      }

      let operationCount = 0;

      // Handle copy operation
      if (options.copy && Array.isArray(options.copy) && options.copy.length >= 2) {
        const [source, destination] = options.copy;
        console.log(chalk.cyan(`\n📋 Copy: ${source} → ${destination}`));

        if (options.dryRun) {
          console.log(chalk.gray('  (Dry-run: Would copy file/directory)'));
          if (conflictStrategy) {
            console.log(chalk.gray(`  (Conflict strategy: ${conflictStrategy})`));
          }
          operationCount++;
        } else {
          // Prepare copy options with depth control, filtering, and conflict resolution
          const copyOptions: any = {
            preserve: options.preserve,
            overwrite: options.overwrite || false,
            recursive: options.recursive,
            conflictStrategy,
          };

          // Add max depth if specified
          if (options.depth) {
            copyOptions.maxDepth = parseInt(options.depth, 10);
          }

          // Add filter if specified
          if (options.filter) {
            copyOptions.filter = options.filter;
          }

          // Add regex filter if specified
          if (options.regex) {
            try {
              copyOptions.filterRegex = new RegExp(options.regex);
            } catch (error) {
              console.error(chalk.red(`  ✗ Invalid regex pattern: ${options.regex}`));
              process.exit(1);
            }
          }

          const result = await copy(source, destination, copyOptions);

          if (result.success) {
            console.log(chalk.green(`  ✓ Copied ${result.filesProcessed} item(s)`));

            // Display conflict resolution summary if applicable
            if (result.filesSkipped && result.filesSkipped > 0) {
              console.log(chalk.yellow(`  ⤳ Skipped ${result.filesSkipped} item(s) (conflict resolution)`));
            }
            if (result.filesRenamed && result.filesRenamed > 0) {
              console.log(chalk.blue(`  ⤳ Renamed ${result.filesRenamed} item(s) (conflict resolution)`));
            }
            if (result.backupsCreated && result.backupsCreated > 0) {
              console.log(chalk.cyan(`  ⤳ Created ${result.backupsCreated} backup(s)`));
            }

            await auditLogger.logFileOperation('copy', `${source} → ${destination}`, 'success', {
              filesProcessed: result.filesProcessed,
              filesSkipped: result.filesSkipped,
              filesRenamed: result.filesRenamed,
              backupsCreated: result.backupsCreated,
              conflictStrategy,
            });
            operationCount++;
          } else {
            await auditLogger.logFileOperation('copy', `${source} → ${destination}`, 'failed', undefined, result.error);
          }
        }
      }

      // Handle move operation
      if (options.move && options.move.length >= 2) {
        const [source, destination] = options.move;
        console.log(chalk.cyan(`\n📦 Move: ${source} → ${destination}`));

        if (options.dryRun) {
          console.log(chalk.gray('  (Dry-run: Would move file/directory)'));
          if (conflictStrategy) {
            console.log(chalk.gray(`  (Conflict strategy: ${conflictStrategy})`));
          }
          operationCount++;
        } else {
          const moveOptions: any = {
            preserve: options.preserve,
            overwrite: options.overwrite || false,
            conflictStrategy,
          };

          const result = await move(source, destination, moveOptions);

          if (result.success) {
            console.log(chalk.green(`  ✓ Moved ${result.filesProcessed} item(s)`));

            // Display conflict resolution summary if applicable
            if (result.filesSkipped && result.filesSkipped > 0) {
              console.log(chalk.yellow(`  ⤳ Skipped ${result.filesSkipped} item(s) (conflict resolution)`));
            }
            if (result.filesRenamed && result.filesRenamed > 0) {
              console.log(chalk.blue(`  ⤳ Renamed to: ${result.destination}`));
            }
            if (result.backupsCreated && result.backupsCreated > 0) {
              console.log(chalk.cyan(`  ⤳ Created ${result.backupsCreated} backup(s)`));
            }

            await auditLogger.logFileOperation('move', `${source} → ${result.destination}`, 'success', {
              filesProcessed: result.filesProcessed,
              filesSkipped: result.filesSkipped,
              filesRenamed: result.filesRenamed,
              backupsCreated: result.backupsCreated,
              conflictStrategy,
            });
            operationCount++;
          } else {
            await auditLogger.logFileOperation('move', `${source} → ${destination}`, 'failed', undefined, result.error);
          }
        }
      }

      // Handle delete operation
      if (options.delete && options.delete.length > 0) {
        // Determine if using trash (options.trash is undefined when neither --trash nor --no-trash is used)
        // Commander sets options.trash to true when --trash is used, false when --no-trash is used
        const useTrash = options.trash !== false; // Default to true unless --no-trash is specified
        const actionWord = useTrash ? 'Move to trash' : 'Delete';
        const actionPast = useTrash ? 'Moved to trash' : 'Deleted';
        const emoji = useTrash ? '♻️' : '🗑️';

        console.log(chalk.cyan(`\n${emoji}  ${actionWord}: ${options.delete.length} item(s)`));

        if (options.dryRun) {
          options.delete.forEach((path: string) => {
            console.log(chalk.gray(`  (Dry-run: Would ${actionWord.toLowerCase()} ${path})`));
          });
          operationCount++;
        } else {
          const results = await deleteMultiple(options.delete, {
            recursive: options.recursive,
            useTrash,
          });

          const successCount = results.filter((r) => r.success).length;
          const failCount = results.length - successCount;

          console.log(chalk.green(`  ✓ ${actionPast} ${successCount} item(s)`));

          if (failCount > 0) {
            console.log(chalk.red(`  ✗ Failed to ${actionWord.toLowerCase()} ${failCount} item(s)`));
            results.filter((r) => !r.success).forEach((result) => {
              console.log(chalk.red(`    - ${result.source}: ${result.error}`));
            });
          }

          // Log each delete operation
          for (const result of results) {
            await auditLogger.logFileOperation(
              useTrash ? 'trash' : 'delete',
              result.source || 'unknown',
              result.success ? 'success' : 'failed',
              { useTrash },
              result.error
            );
          }

          operationCount++;
        }
      }

      if (operationCount === 0) {
        console.log(chalk.yellow('\n⚠️  No operation specified'));
        console.log(chalk.gray('Use --copy, --move, or --delete to perform an operation'));
        console.log(chalk.gray('Example: fileops --copy source.txt dest.txt'));
        console.log(chalk.gray('Example: fileops --copy src dest --conflict-strategy rename'));
      } else {
        console.log(chalk.green(`\n✓ Completed ${operationCount} operation(s)`));
      }
    } catch (error) {
      handleError(error as Error);
      process.exit(1);
    }
  });
