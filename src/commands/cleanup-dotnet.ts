/**
 * Cleanup .NET Command
 *
 * Automated removal of compiled output directories (bin/obj) in .NET projects
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { validateInput, schemas } from '../validation/index.js';
import { withSpinner } from '../utils/spinner.js';
import {
  detectDotnetDirectories,
  formatBytes,
  removeDotnetDirectories,
  type DotnetDirectory,
  type DotnetDetectionResult,
  type CleanupResult,
} from '../utils/dotnetDetector.js';

export const cleanupDotnetCommand = new Command('cleanup:dotnet')
  .description('Clean up .NET bin and obj directories')
  .alias('cdn')
  .option('-d, --directory <path>', 'Root directory to scan (default: current)')
  .option('--solution <path>', 'Path to .sln file for solution-wide cleanup')
  .option('--dry-run', 'Preview cleanup without applying')
  .option('--force', 'Skip safety checks (dangerous!)')
  .option('--allow-warnings', 'Allow deletion of projects with warning severity')
  .option('--type <type>', 'Filter by project type (csproj, fsproj, vbproj, all)')
  .option('--include <patterns...>', 'Include projects matching glob patterns')
  .option('--exclude <patterns...>', 'Exclude projects matching glob patterns')
  .option('--projects <names...>', 'Only clean specific project names')
  .action(async (options) => {
    // Validate inputs
    const validation = validateInput(schemas.cleanupDotnet, options, 'Cleanup .NET command');

    if (!validation.success) {
      console.error(chalk.red.bold('❌ Validation Error'));
      validation.errors.forEach((error) => {
        console.error(chalk.red(`  • ${error}`));
      });
      console.error(chalk.yellow('\nPlease fix these issues and try again.\n'));
      process.exit(1);
    }

    console.log(chalk.blue.bold('🧹 Cleanup .NET'));
    console.log(chalk.gray('Remove bin and obj directories from .NET projects\n'));

    if (options.dryRun) {
      console.log(chalk.yellow('⚠️  Dry-run mode: No changes will be applied'));
    }

    // Determine root directory
    const rootDir = options.directory
      ? path.resolve(options.directory)
      : process.cwd();

    console.log(chalk.gray('Scanning directory:'), chalk.cyan(rootDir));

    // Build filter options from command line arguments
    const filters: any = {};

    if (options.type) {
      filters.projectType = options.type;
    }

    if (options.solution) {
      filters.solutionFile = options.solution;
    }

    if (options.include) {
      filters.includePatterns = Array.isArray(options.include)
        ? options.include
        : [options.include];
    }

    if (options.exclude) {
      filters.excludePatterns = Array.isArray(options.exclude)
        ? options.exclude
        : [options.exclude];
    }

    if (options.projects) {
      filters.projectNames = Array.isArray(options.projects)
        ? options.projects
        : [options.projects];
    }

    // Detect .NET bin and obj directories
    const result: DotnetDetectionResult = await withSpinner(
      async () => {
        return await detectDotnetDirectories({
          rootDir,
          maxDepth: 10,
          calculateSize: true,
          countFiles: true,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        });
      },
      'Scanning for bin/obj directories...',
      'Scan completed',
      'Scan failed',
      { color: 'cyan' }
    );

    // Display results
    console.log(chalk.blue.bold('\n📊 Scan Results'));
    console.log(chalk.gray('─'.repeat(50)));

    if (result.totalCount === 0) {
      console.log(chalk.yellow('\n✓ No .NET bin/obj directories found'));
      return;
    }

    console.log(chalk.gray('\nProjects found:'), chalk.cyan(result.projectCount));
    console.log(
      chalk.gray('Directories found:'),
      chalk.cyan(result.totalCount)
    );
    console.log(
      chalk.gray('  • bin directories:'),
      chalk.cyan(result.byType.bin)
    );
    console.log(
      chalk.gray('  • obj directories:'),
      chalk.cyan(result.byType.obj)
    );
    console.log(
      chalk.gray('Total size:'),
      chalk.cyan(formatBytes(result.totalSize))
    );
    console.log(
      chalk.gray('Total files:'),
      chalk.cyan(
        result.directories.reduce((sum, dir) => sum + dir.fileCount, 0)
      )
    );
    console.log(
      chalk.gray('Scan time:'),
      chalk.cyan(`${result.executionTime}ms`)
    );

    // Display space estimation section
    console.log(chalk.blue.bold('\n💾 Space Estimation'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray('\nSpace to be reclaimed:'));
    console.log(chalk.green.bold(`   ${formatBytes(result.totalSize)}`));
    console.log(chalk.gray(`   (${result.totalSize.toLocaleString()} bytes)`));
    console.log(chalk.gray('\nBreakdown by directory type:'));
    console.log(
      chalk.gray('  • bin directories:'),
      chalk.cyan(`${result.byType.bin} directories`)
    );
    console.log(
      chalk.gray('  • obj directories:'),
      chalk.cyan(`${result.byType.obj} directories`)
    );
    console.log(chalk.gray('\nEstimated file count:'));
    const totalFiles = result.directories.reduce((sum, dir) => sum + dir.fileCount, 0);
    console.log(chalk.cyan(`   ${totalFiles.toLocaleString()} files`));

    // Display found directories
    console.log(chalk.blue.bold('\n📁 Found Directories:'));
    console.log(chalk.gray('─'.repeat(50)));

    for (const dir of result.directories) {
      const relativePath = path.relative(rootDir, dir.path);
      const typeLabel = dir.type === 'bin' ? 'bin' : 'obj';
      const typeColor = dir.type === 'bin' ? chalk.yellow : chalk.magenta;

      console.log(
        `\n${chalk.gray('•')} ${typeColor(typeLabel.padEnd(3))} ${chalk.cyan(relativePath)}`
      );
      console.log(
        chalk.gray(
          `  └─ Size: ${formatBytes(dir.size)}, Files: ${dir.fileCount}, Artifacts: ${
            dir.hasArtifacts ? '✓' : '✗'
          }`
        )
      );
    }

    // Cleanup operation (if not dry-run)
    if (!options.dryRun && result.totalCount > 0) {
      console.log(chalk.blue.bold('\n🗑️  Cleanup'));
      console.log(chalk.gray('─'.repeat(50)));

      if (!options.force) {
        console.log(
          chalk.yellow(
            `\n⚠️  About to delete ${result.totalCount} directories (${formatBytes(
              result.totalSize
            )})`
          )
        );
        console.log(chalk.gray('Run with --force to skip this confirmation\n'));
      }

      // Build safety options
      const safetyOptions = {
        bypassSafetyChecks: options.force,
        allowWarningLevel: options.allowWarnings,
        verbose: false,
      };

      // Perform the cleanup operation with safety checks
      const cleanupResult: CleanupResult = await withSpinner(
        async () => {
          return await removeDotnetDirectories(result.directories, safetyOptions);
        },
        'Removing directories...',
        'Directories removed successfully',
        'Failed to remove directories',
        { color: 'yellow' }
      );

      // Display cleanup results
      console.log(chalk.blue.bold('\n📊 Cleanup Results'));
      console.log(chalk.gray('─'.repeat(50)));

      console.log(
        chalk.gray('\nRemoved:'),
        chalk.green(`${cleanupResult.removedCount} directories`)
      );
      console.log(
        chalk.gray('Size freed:'),
        chalk.green(formatBytes(cleanupResult.sizeFreed))
      );
      console.log(
        chalk.gray('Time:'),
        chalk.cyan(`${cleanupResult.executionTime}ms`)
      );

      if (cleanupResult.failedCount > 0) {
        console.log(
          chalk.red('\nFailed to remove:'),
          chalk.red(`${cleanupResult.failedCount} directories`)
        );
        console.log(chalk.yellow('\nFailed directories:'));
        for (const failure of cleanupResult.failed) {
          const relativePath = path.relative(rootDir, failure.path);
          console.log(chalk.red(`  ✗ ${relativePath}`));
          console.log(chalk.gray(`    Error: ${failure.error}`));
        }
      }

      if (cleanupResult.removedCount > 0) {
        console.log(chalk.yellow('\n✓ Removed directories:'));
        for (const removedPath of cleanupResult.removed) {
          const relativePath = path.relative(rootDir, removedPath);
          console.log(chalk.green(`  ✓ ${relativePath}`));
        }
      }
    } else if (options.dryRun && result.totalCount > 0) {
      console.log(
        chalk.yellow(
          `\n🔍 Dry-run complete: Would remove ${result.totalCount} directories (${formatBytes(
            result.totalSize
          )})`
        )
      );
    }

    console.log(chalk.green('\n✓ .NET cleanup command executed'));
  });
