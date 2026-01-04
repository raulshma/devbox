/**
 * Discover Command
 *
 * Fast file discovery with pattern matching and filtering
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import {
  discoverFiles,
  discoverByDirectory,
  searchInFiles,
  formatFileSize,
  CommonPatterns,
  type FileDiscoveryOptions,
} from '../utils/fileDiscovery.js';
import { withSpinner, SpinnerPresets } from '../utils/spinner.js';

export const discoverCommand = new Command('discover')
  .description('Fast file discovery with pattern matching and filtering')
  .alias('find')
  .argument('[patterns...]', 'Glob patterns to match files (default: **)')
  .option('-p, --pattern <pattern>', 'Glob pattern (same as argument)')
  .option('-d, --directory <path>', 'Root directory to search from (default: current)')
  .option('--ext <extensions>', 'Filter by extension(s), comma-separated (e.g., ts,js,tsx)')
  .option('--ignore <patterns>', 'Ignore patterns, comma-separated')
  .option('--min-size <bytes>', 'Minimum file size in bytes', parseNumber)
  .option('--max-size <bytes>', 'Maximum file size in bytes', parseNumber)
  .option('--depth <number>', 'Maximum directory depth', parseNumber)
  .option('--dot', 'Include hidden files/directories')
  .option('--case-insensitive', 'Case insensitive pattern matching')
  .option('--absolute', 'Return absolute paths instead of relative')
  .option('--group-by-dir', 'Group results by directory')
  .option('--search <text>', 'Search for text within files')
  .option('--context <lines>', 'Number of context lines for search results', '0')
  .option('--max-results <number>', 'Maximum number of search results', '100')
  .option('--stats', 'Show detailed statistics')
  .option('--json', 'Output results as JSON')
  .option('--limit <number>', 'Limit number of results', parseNumber)
  .action(async (patterns: string[] = [], options) => {
    console.log(chalk.blue.bold('🔍 File Discovery'));
    console.log(chalk.gray('Fast pattern-based file discovery\n'));

    // Determine patterns to use
    const searchPatterns = patterns.length > 0 ? patterns : options.pattern || ['**/*'];

    // Build discovery options
    const discoveryOptions: FileDiscoveryOptions = {
      patterns: searchPatterns,
      cwd: options.directory || process.cwd(),
      extension: options.ext ? options.ext.split(',').map((e: string) => e.trim()) : undefined,
      ignore: options.ignore ? options.ignore.split(',').map((e: string) => e.trim()) : undefined,
      minSize: options.minSize,
      maxSize: options.maxSize,
      deep: options.depth,
      dot: options.dot,
      caseSensitiveMatch: !options.caseInsensitive,
      absolute: options.absolute,
    };

    try {
      // Handle search mode
      if (options.search) {
        await handleSearchMode(discoveryOptions, options);
        return;
      }

      // Handle directory grouping mode
      if (options.groupByDir) {
        await handleGroupByDirMode(discoveryOptions, options);
        return;
      }

      // Standard discovery mode
      await handleStandardMode(discoveryOptions, options);
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red('Error:'), error.message);
      } else {
        console.error(chalk.red('Error:'), error);
      }
      process.exit(1);
    }
  });

/**
 * Handle standard file discovery mode
 */
async function handleStandardMode(options: FileDiscoveryOptions, cliOptions: any) {
  const result = await withSpinner(
    () => discoverFiles(options),
    `Discovering files in ${options.cwd || process.cwd()}...`,
    `Found ${chalk.bold('0')} files`, // Will be updated below
    'Failed to discover files',
    { color: 'cyan' }
  );

  if (cliOptions.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Display results
  console.log(chalk.gray('Search directory:'), chalk.cyan(options.cwd || process.cwd()));
  console.log(chalk.gray('Patterns:'), chalk.yellow(Array.isArray(options.patterns) ? options.patterns.join(', ') : options.patterns));
  console.log(chalk.gray('Files found:'), chalk.green.bold(result.count));
  console.log(chalk.gray('Total size:'), chalk.magenta(formatFileSize(result.totalSize)));
  console.log(chalk.gray('Execution time:'), chalk.gray(`${result.executionTime}ms`));

  if (cliOptions.stats && result.byExtension) {
    console.log(chalk.gray('\nBy extension:'));
    const sortedExts = Object.entries(result.byExtension).sort((a, b) => b[1] - a[1]);
    for (const [ext, count] of sortedExts) {
      const percentage = ((count / result.count) * 100).toFixed(1);
      console.log(`  ${chalk.cyan(ext.padEnd(15))} ${chalk.green(count.toString().padStart(6))}  ${chalk.gray(percentage + '%')}`);
    }
  }

  // Display files
  const displayFiles = cliOptions.limit ? result.files.slice(0, cliOptions.limit) : result.files;

  console.log(chalk.gray('\nFiles:'));
  if (displayFiles.length === 0) {
    console.log(chalk.yellow('  No files found'));
  } else {
    for (const file of displayFiles) {
      const fullPath = path.join(options.cwd || process.cwd(), file);
      try {
        const stats = await import('fs').then((fs) => fs.promises.stat(fullPath));
        const size = formatFileSize(stats.size);
        console.log(`  ${chalk.cyan(size.padStart(10))}  ${file}`);
      } catch {
        console.log(`  ${chalk.gray('         -')}  ${file}`);
      }
    }

    if (cliOptions.limit && result.files.length > cliOptions.limit) {
      console.log(chalk.gray(`\n... and ${result.files.length - cliOptions.limit} more files (use --limit to see more)`));
    }
  }
}

/**
 * Handle group-by-directory mode
 */
async function handleGroupByDirMode(options: FileDiscoveryOptions, cliOptions: any) {
  const dirMap = await withSpinner(
    () => discoverByDirectory(options),
    'Scanning directories...',
    `Scanned ${chalk.bold('0')} directories`,
    'Failed to scan directories',
    { color: 'cyan' }
  );

  if (cliOptions.json) {
    console.log(JSON.stringify(Array.from(dirMap.values()), null, 2));
    return;
  }

  console.log(chalk.gray('Search directory:'), chalk.cyan(options.cwd || process.cwd()));
  console.log(chalk.gray('Directories found:'), chalk.green.bold(dirMap.size));

  const dirs = Array.from(dirMap.values()).sort((a, b) => b.fileCount - a.fileCount);

  for (const dir of dirs) {
    console.log(`\n${chalk.cyan(dir.path)}`);
    console.log(`  ${chalk.gray('Files:')} ${chalk.green(dir.fileCount.toString())}  ${chalk.gray('Size:')} ${chalk.magenta(formatFileSize(dir.totalSize))}`);
  }
}

/**
 * Handle search-in-files mode
 */
async function handleSearchMode(options: FileDiscoveryOptions, cliOptions: any) {
  const results = await withSpinner(
    () => searchInFiles(options, cliOptions.search, {
      caseSensitive: options.caseSensitiveMatch ?? true,
      maxResults: cliOptions.maxResults,
      contextLines: parseInt(cliOptions.context, 10),
    }),
    `Searching for "${cliOptions.search}"...`,
    `Search completed`,
    'Search failed',
    { color: 'blue' }
  );

  if (cliOptions.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log(chalk.gray('Search directory:'), chalk.cyan(options.cwd || process.cwd()));
  console.log(chalk.gray('Search term:'), chalk.yellow(cliOptions.search));
  console.log(chalk.gray('Files with matches:'), chalk.green.bold(results.length));

  if (results.length === 0) {
    console.log(chalk.yellow('\n  No matches found'));
    return;
  }

  for (const result of results) {
    console.log(`\n${chalk.cyan(result.file)}`);
    console.log(chalk.gray(`  Matches: ${result.matches}`));

    if (result.lines.length > 0) {
      const maxLines = 10;
      const displayLines = result.lines.slice(0, maxLines);

      for (const line of displayLines) {
        const trimmed = line.trim();
        if (trimmed) {
          // Highlight the search term if present
          const highlighted = trimmed.replace(
            new RegExp(cliOptions.search, 'gi'),
            (match) => chalk.red.bold(match)
          );
          console.log(`    ${chalk.gray('│')} ${highlighted}`);
        }
      }

      if (result.lines.length > maxLines) {
        console.log(`    ${chalk.gray('│')} ... ${result.lines.length - maxLines} more matches`);
      }
    }
  }
}

/**
 * Parse number string to number
 */
function parseNumber(value: string): number | undefined {
  if (!value) return undefined;
  const num = parseInt(value, 10);
  return isNaN(num) ? undefined : num;
}

/**
 * Show common pattern examples
 */
export function showPatternExamples(): void {
  console.log(chalk.gray('\nCommon pattern examples:'));
  console.log(chalk.gray('  Code files:       ') + chalk.cyan('**/*.ts'));
  console.log(chalk.gray('  Config files:     ') + chalk.cyan('**/*.{json,yml,yaml}'));
  console.log(chalk.gray('  Test files:       ') + chalk.cyan('**/*.test.ts'));
  console.log(chalk.gray('  In specific dir:  ') + chalk.cyan('src/**/*.ts'));
  console.log(chalk.gray('  Multiple exts:    ') + chalk.cyan('**/*.{ts,tsx,js,jsx}'));
  console.log(chalk.gray('  Ignore node_modules: ') + chalk.cyan('--ignore "**/node_modules/**"'));
}
