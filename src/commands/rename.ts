/**
 * Rename Command
 *
 * Advanced file and folder renaming with regex pattern matching and batch operations
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { validateInput, schemas } from '../validation/index.js';
import {
  executeRename,
  undoRename,
  getHistorySize,
  getHistoryEntries,
  clearHistory,
  getAvailableStrategies,
  parseConflictStrategy,
} from '../utils/rename.js';

export const renameCommand = new Command('rename')
  .description('Advanced file and folder renaming with pattern matching')
  .alias('rn')
  .option('-p, --pattern <pattern>', 'Regex pattern to match files')
  .option('-r, --replacement <replacement>', 'Replacement string (supports groups and backreferences)')
  .option('--case <type>', 'Case conversion: lower, upper, camel, kebab, snake')
  .option('--number <format>', 'Sequential numbering: start,end or prefix-start,end or start,end,step')
  .option('-t, --template <template>', 'Template for renaming (supports placeholders like {name}, {ext}, {date}, {counter}, etc.)')
  .option('--filter <pattern>', 'Filter by file type (e.g., "*.ts", "*.js")')
  .option('--flags <flags>', 'Regex flags (e.g., "i" for case-insensitive, "m" for multiline, "s" for dotall)')
  .option('--case-insensitive', 'Enable case-insensitive matching (same as --flags i)')
  .option('--multiline', 'Enable multiline mode (same as --flags m)')
  .option('--dotall', 'Enable dot matches newline (same as --flags s)')
  .option('--no-sort', 'Disable alphabetical sorting before numbering')
  .option('--dry-run', 'Preview changes without applying them')
  .option('--undo', 'Undo the last rename operation')
  .option('-d, --directory <path>', 'Target directory (default: current)')
  .option('--depth <number>', 'Maximum depth for recursive operations', '10')
  .option('--parallel', 'Enable parallel processing for batch operations (enabled automatically for 10+ files)')
  .option('--max-workers <number>', 'Maximum number of worker threads for parallel processing')
  .option('--conflict-strategy <strategy>', 'Conflict resolution strategy when target file exists')
  .option('--rename-suffix <suffix>', 'Suffix pattern for rename strategy (default: "_$n")')
  .option('--max-rename-attempts <number>', 'Maximum rename attempts for conflict resolution (default: 100)')
  .option('--backup-suffix <suffix>', 'Backup suffix for backup strategy (default: ".bak")')
  .option('--list-strategies', 'List all available conflict resolution strategies')
  .option('--history', 'Show rename history')
  .option('--clear-history', 'Clear all rename history')
  // Advanced filtering options
  .option('--min-size <size>', 'Minimum file size (e.g., "100B", "1KB", "1MB", "1GB")')
  .option('--max-size <size>', 'Maximum file size (e.g., "100B", "1KB", "1MB", "1GB")')
  .option('--newer <date>', 'Only files newer than this date (e.g., "2024-01-01", "2d", "1w", "1m")')
  .option('--older <date>', 'Only files older than this date (e.g., "2024-01-01", "2d", "1w", "1m")')
  .option('--include <patterns>', 'Include files matching these glob patterns (comma-separated)', (value: string, previous: string[] = []) => [...previous, value])
  .option('--exclude <patterns>', 'Exclude files matching these glob patterns (comma-separated)', (value: string, previous: string[] = []) => [...previous, value])
  .action(async (options: any) => {
    // Handle list-strategies option first (before validation)
    if (options.listStrategies) {
      console.log(chalk.blue.bold('📋 Available Conflict Resolution Strategies\n'));
      const strategies = getAvailableStrategies();
      strategies.forEach((strategy) => {
        console.log(`  ${chalk.cyan(strategy.name.padEnd(15))} ${chalk.gray(strategy.description)}`);
      });
      console.log(chalk.gray('\nUsage: dtb rename --pattern "old" --replacement "new" --conflict-strategy <strategy>'));
      return;
    }

    // Handle history option
    if (options.history) {
      console.log(chalk.blue.bold('📜 Rename History\n'));
      const entries = await getHistoryEntries();

      if (entries.length === 0) {
        console.log(chalk.yellow('No rename history available\n'));
        return;
      }

      entries.forEach((entry, index) => {
        const date = new Date(entry.timestamp).toLocaleString();
        console.log(chalk.cyan(`${index + 1}. ${chalk.bold(date)}`));
        console.log(chalk.gray(`   Directory: ${entry.directory}`));
        console.log(chalk.gray(`   Operations: ${entry.operations.length} file(s)`));

        // Show first few operations as preview
        const previewOps = entry.operations.slice(0, 3);
        previewOps.forEach((op) => {
          console.log(chalk.gray(`     • ${op.originalName} → ${op.newName}`));
        });

        if (entry.operations.length > 3) {
          console.log(chalk.gray(`     ... and ${entry.operations.length - 3} more`));
        }

        // Show conflict resolution info if available
        if (entry.rollbackInfo) {
          const conflictCount = entry.rollbackInfo.filter(r => r.conflictAction).length;
          if (conflictCount > 0) {
            console.log(chalk.magenta(`     ⚠️ ${conflictCount} conflict(s) resolved`));
          }
        }

        console.log('');
      });

      console.log(chalk.gray(`💡 Use --undo to reverse the last operation`));
      return;
    }

    // Handle clear-history option
    if (options.clearHistory) {
      await clearHistory();
      console.log(chalk.green('✓ Rename history cleared'));
      return;
    }

    // Validate inputs
    const validation = validateInput(schemas.rename, options, 'Rename command');

    if (!validation.success) {
      console.error(chalk.red.bold('❌ Validation Error'));
      validation.errors.forEach((error) => {
        console.error(chalk.red(`  • ${error}`));
      });
      console.error(chalk.yellow('\nPlease fix these issues and try again.\n'));
      process.exit(1);
    }

    // Use validated and transformed data
    options = validation.data;

    console.log(chalk.blue.bold('🔄 Rename Command'));
    console.log(chalk.gray('Advanced file and folder renaming\n'));

    // Handle undo operation
    if (options.undo) {
      const historySize = await getHistorySize();
      if (historySize === 0) {
        console.log(chalk.yellow('⚠️  No rename operations to undo'));
        return;
      }

      try {
        console.log(chalk.gray('Undoing last rename operation...\n'));
        const results = await undoRename();

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        console.log(chalk.green(`✓ Successfully undone ${successCount} operation(s)`));

        if (failCount > 0) {
          console.log(chalk.red(`✗ Failed to undo ${failCount} operation(s)`));
          results.forEach((result) => {
            if (!result.success) {
              console.log(chalk.red(`  • ${result.error}`));
            }
          });
        }
      } catch (error) {
        console.error(chalk.red('✗ Undo failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }

      return;
    }

    // Validate that we have at least a pattern, case, number, or template option
    if (!options.pattern && !options.number && !options.case && !options.template) {
      console.log(chalk.yellow('⚠️  Please provide either --pattern, --case, --number, or --template option'));
      console.log(chalk.gray('\nExamples:'));
      console.log(chalk.gray('  dtb rename --pattern "test_" --replacement "prod_"'));
      console.log(chalk.gray('  dtb rename --pattern "(\\\\d+)" --replacement "file-$1" --filter "*.txt"'));
      console.log(chalk.gray('  dtb rename --pattern "^[A-Z]" --replacement "" --flags i'));
      console.log(chalk.gray('  dtb rename --number "1,100" --filter "*.txt"'));
      console.log(chalk.gray('  dtb rename --number "photo-1,50,2" --filter "*.jpg"'));
      console.log(chalk.gray('  dtb rename --case camel --filter "*.js"'));
      console.log(chalk.gray('\nTemplate-based renaming examples:'));
      console.log(chalk.gray('  dtb rename --template "{name}-{counter:pad}.{ext}" --filter "*.txt"'));
      console.log(chalk.gray('  dtb rename --template "{year}{month}{day}_{name:upper}.{ext}"'));
      console.log(chalk.gray('  dtb rename --template "file_{counter:03}.{ext}" --filter "*.js"'));
      console.log(chalk.gray('  dtb rename --template "{name:camel}_v{counter}.{ext}" --filter "*.ts"'));
      console.log(chalk.gray('\nAvailable placeholders:'));
      console.log(chalk.gray('  {name}    - Filename without extension'));
      console.log(chalk.gray('  {ext}     - File extension'));
      console.log(chalk.gray('  {counter} - Sequential number'));
      console.log(chalk.gray('  {date}    - Current date (YYYY-MM-DD)'));
      console.log(chalk.gray('  {time}    - Current time (HH:MM:SS)'));
      console.log(chalk.gray('  {timestamp} - Unix timestamp'));
      console.log(chalk.gray('\nFormat modifiers: {placeholder:format}'));
      console.log(chalk.gray('  Formats: lower, upper, camel, pascal, snake, kebab, title'));
      console.log(chalk.gray('  Example: {name:upper} converts filename to UPPERCASE'));
      console.log(chalk.gray('\nAdvanced filtering examples:'));
      console.log(chalk.gray('  dtb rename --pattern "old" --replacement "new" --min-size "1KB" --max-size "10MB"'));
      console.log(chalk.gray('  dtb rename --pattern "test" --replacement "prod" --newer "2024-01-01"'));
      console.log(chalk.gray('  dtb rename --pattern "tmp" --replacement "temp" --newer "7d"'));
      console.log(chalk.gray('  dtb rename --pattern "file" --replacement "doc" --include "*.ts" --include "*.js"'));
      console.log(chalk.gray('  dtb rename --pattern "file" --replacement "doc" --exclude "node_modules/*" --exclude "dist/*"'));
      console.log(chalk.gray('\nConflict resolution examples:'));
      console.log(chalk.gray('  dtb rename --pattern "old" --replacement "new" --conflict-strategy skip'));
      console.log(chalk.gray('  dtb rename --pattern "old" --replacement "new" --conflict-strategy rename'));
      console.log(chalk.gray('  dtb rename --pattern "old" --replacement "new" --conflict-strategy backup\n'));
      return;
    }

    // Parse conflict strategy if provided
    if (options.conflictStrategy) {
      const strategy = parseConflictStrategy(options.conflictStrategy);
      if (!strategy) {
        console.error(chalk.red(`Invalid conflict strategy: ${options.conflictStrategy}`));
        console.log(chalk.gray('Use --list-strategies to see available options'));
        process.exit(1);
      }
      options.conflictStrategy = strategy;
    }

    if (options.dryRun) {
      console.log(chalk.yellow('⚠️  Dry-run mode: No changes will be applied\n'));
    }

    if (options.conflictStrategy) {
      console.log(chalk.cyan(`🛡️  Conflict strategy: ${options.conflictStrategy}\n`));
    }

    try {
      // Execute the rename operation
      const { operations, results } = await executeRename(options);

      // Display results
      if (operations.length === 0) {
        console.log(chalk.yellow('No files found matching the criteria'));
        return;
      }

      console.log(chalk.gray(`Found ${operations.length} file(s) to rename\n`));

      // Track conflict actions
      let skippedCount = 0;
      let overwrittenCount = 0;
      let renamedCount = 0;
      let backedUpCount = 0;

      // Show each rename operation
      operations.forEach((op, index) => {
        const result = results[index];
        const icon = result.success ? '✓' : '✗';
        const color = result.success ? chalk.green : chalk.red;

        // Determine the actual target name (may differ from op.newName if renamed due to conflict)
        const actualNewName = result.targetPath ? result.targetPath.split(/[\\/]/).pop() : op.newName;

        console.log(
          color(
            `${icon} ${index + 1}. ${chalk.bold(op.originalName)} → ${chalk.bold(actualNewName)}`
          )
        );

        // Show conflict resolution information
        if (result.conflictAction) {
          switch (result.conflictAction) {
            case 'skipped':
              skippedCount++;
              console.log(chalk.yellow(`   ⊘ Skipped: ${result.conflictReason}`));
              break;
            case 'overwritten':
              overwrittenCount++;
              console.log(chalk.magenta(`   ⟳ Overwritten: ${result.conflictReason}`));
              break;
            case 'renamed':
              renamedCount++;
              console.log(chalk.cyan(`   ↳ Renamed: ${result.conflictReason}`));
              break;
            case 'backed-up':
              backedUpCount++;
              console.log(chalk.blue(`   💾 Backed up: ${result.backupPath}`));
              break;
          }
        }

        if (result.error && !result.success) {
          console.log(chalk.red(`   Error: ${result.error}`));
        }
      });

      // Summary
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      console.log(chalk.gray(`\n───`));
      console.log(chalk.green(`✓ Success: ${successCount}`));

      // Show conflict resolution summary
      if (skippedCount > 0 || overwrittenCount > 0 || renamedCount > 0 || backedUpCount > 0) {
        console.log(chalk.gray('\nConflict resolution:'));
        if (skippedCount > 0) console.log(chalk.yellow(`  ⊘ Skipped: ${skippedCount}`));
        if (overwrittenCount > 0) console.log(chalk.magenta(`  ⟳ Overwritten: ${overwrittenCount}`));
        if (renamedCount > 0) console.log(chalk.cyan(`  ↳ Auto-renamed: ${renamedCount}`));
        if (backedUpCount > 0) console.log(chalk.blue(`  💾 Backed up: ${backedUpCount}`));
      }

      if (failCount > 0) {
        console.log(chalk.red(`✗ Failed: ${failCount}`));
      }

      if (options.dryRun) {
        console.log(chalk.yellow('\n⚠️  Dry-run completed. No files were actually renamed.'));
        console.log(chalk.gray('Remove --dry-run to apply the changes.'));
      } else if (successCount > 0 && failCount === 0) {
        console.log(chalk.gray('\n💡 Tip: Use --undo to reverse this operation'));
      }
    } catch (error) {
      console.error(chalk.red('\n✗ Rename failed:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      } else {
        console.error(chalk.red(String(error)));
      }
      process.exit(1);
    }

    console.log('');
  });
