/**
 * Cleanup Node Modules Command
 *
 * Intelligent removal of node_modules directories with dependency analysis
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { validateInput, schemas } from '../validation/index.js';
import { withSpinner, SpinnerPresets } from '../utils/spinner.js';
import {
  detectNodeModules,
  removeNodeModules,
  formatBytes,
  type NodeDetectionOptions,
  type NodeDetectionResult,
  type CleanupResult,
} from '../utils/nodeDetector.js';
import {
  analyzePackages,
  formatAnalysisResult,
  getDependencySummary,
  type PackageAnalysisResult,
} from '../utils/packageAnalyzer.js';

export const cleanupNodeCommand = new Command('cleanup:node')
  .description('Clean up node_modules directories intelligently')
  .alias('cn')
  .option('-d, --directory <path>', 'Root directory to scan (default: current)')
  .option('--deep', 'Deep cleanup including unused dependencies')
  .option('--analyze', 'Analyze dependencies before cleanup')
  .option('--dry-run', 'Preview cleanup without applying')
  .option('--force', 'Skip safety checks (dangerous!)')
  .option('--allow-warnings', 'Allow deletion of modules with warning severity')
  .option('--max-depth <number>', 'Maximum scan depth', parseNumber)
  .option('--only-projects', 'Only clean node_modules with package.json in parent')
  .option('--json', 'Output results as JSON')
  .action(async (options) => {
    // Validate inputs
    const validation = validateInput(schemas.cleanupNode, options, 'Cleanup node command');

    if (!validation.success) {
      console.error(chalk.red.bold('❌ Validation Error'));
      validation.errors.forEach((error) => {
        console.error(chalk.red(`  • ${error}`));
      });
      console.error(chalk.yellow('\nPlease fix these issues and try again.\n'));
      process.exit(1);
    }

    console.log(chalk.blue.bold('🧹 Cleanup Node Modules'));
    console.log(chalk.gray('Intelligent node_modules cleanup with automatic detection\n'));

    if (options.dryRun) {
      console.log(chalk.yellow('⚠️  Dry-run mode: No changes will be applied'));
    }

    if (options.force) {
      console.log(chalk.red('⚠️  Force mode: Safety checks disabled'));
    }

    // Build detection options
    const detectionOptions: NodeDetectionOptions = {
      rootDir: options.directory || process.cwd(),
      maxDepth: options.maxDepth,
      calculateSize: true,
      countItems: false,
      onlyWithPackageJson: options.onlyProjects,
    };

    // Detect node_modules directories
    const result: NodeDetectionResult = await withSpinner(
      () => detectNodeModules(detectionOptions),
      'Scanning for node_modules directories...',
      `Found ${chalk.bold('0')} node_modules directories`,
      'Failed to scan for node_modules',
      { color: 'cyan' }
    );

    // Display results (only if not doing cleanup)
    const willPerformCleanup = !options.dryRun && !options.analyze;
    if (options.json && !willPerformCleanup) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.gray('\nScan Results:'));
    console.log(chalk.gray('  Root directory:'), chalk.cyan(detectionOptions.rootDir));
    console.log(chalk.gray('  Total found:'), chalk.green.bold(result.totalCount.toString()));
    console.log(chalk.gray('  Projects:'), chalk.green(result.projectCount.toString()));
    console.log(chalk.gray('  Orphaned:'), chalk.yellow(result.orphanedCount.toString()));
    console.log(chalk.gray('  Total size:'), chalk.magenta(formatBytes(result.totalSize)));
    console.log(chalk.gray('  Execution time:'), chalk.gray(`${result.executionTime}ms`));

    if (result.totalCount === 0) {
      console.log(chalk.yellow('\n  No node_modules directories found'));
      return;
    }

    // Show breakdown by depth
    if (Object.keys(result.byDepth).length > 0) {
      console.log(chalk.gray('\n  By depth:'));
      const sortedDepths = Object.entries(result.byDepth).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
      for (const [depth, count] of sortedDepths) {
        console.log(`    ${chalk.cyan(`Depth ${depth}:`.padEnd(12))} ${chalk.green(count.toString())}`);
      }
    }

    // Display space estimation section
    console.log(chalk.gray('\n  💾 Space Estimation:'));
    console.log(chalk.gray('    Space to be reclaimed:'));
    console.log(chalk.green.bold(`      ${formatBytes(result.totalSize)}`));
    console.log(chalk.gray(`      (${result.totalSize.toLocaleString()} bytes)`));
    console.log(chalk.gray('\n    Breakdown:'));
    console.log(chalk.gray('      • Project node_modules:'), chalk.cyan(`${result.projectCount} directories`));
    console.log(chalk.gray('      • Orphaned node_modules:'), chalk.yellow(`${result.orphanedCount} directories`));

    // Show detected directories
    console.log(chalk.gray('\n  📁 Detected directories:'));
    for (const dir of result.directories) {
      const status = dir.hasPackageJson ? chalk.green('✓') : chalk.yellow('○');
      const relPath = dir.path.replace(detectionOptions.rootDir || process.cwd(), '').replace(/^\/+/, '') || '.';
      const sizeStr = formatBytes(dir.size);
      console.log(`    ${status} ${chalk.cyan(relPath.padEnd(40))} ${chalk.magenta(sizeStr)}`);
    }

    // Analyze package.json files if --analyze flag is set
    let packageAnalyses: PackageAnalysisResult[] = [];
    if (options.analyze) {
      const projectPaths = result.directories
        .filter((dir) => dir.hasPackageJson)
        .map((dir) => dir.projectPath);

      if (projectPaths.length > 0) {
        packageAnalyses = await withSpinner(
          () => analyzePackages(projectPaths),
          'Analyzing package.json files...',
          `Analyzed ${chalk.bold('0')} projects`,
          'Failed to analyze packages',
          { color: 'cyan' }
        );

        // Display individual project analyses
        console.log(chalk.gray('\n📊 Dependency Analysis:'));
        for (const analysis of packageAnalyses) {
          console.log(chalk.gray('\n  ' + formatAnalysisResult(analysis).replace(/\n/g, '\n  ')));
        }

        // Display summary
        const summary = getDependencySummary(packageAnalyses);
        console.log(chalk.gray('\n  Summary:'));
        console.log(`    Projects analyzed: ${chalk.green(summary.totalProjects.toString())}`);
        console.log(`    Total dependencies: ${chalk.cyan(summary.totalDependencies.toString())}`);
        console.log(`    Production deps: ${chalk.cyan(summary.totalProdDeps.toString())}`);
        console.log(`    Dev deps: ${chalk.cyan(summary.totalDevDeps.toString())}`);
        console.log(`    With lock files: ${chalk.green(summary.projectsWithLockFiles.toString())}`);
        console.log(`    With suspicious versions: ${chalk.yellow(summary.projectsWithSuspiciousVersions.toString())}`);

        if (Object.keys(summary.lockFileTypes).length > 0) {
          console.log(chalk.gray('\n  Lock file types:'));
          for (const [type, count] of Object.entries(summary.lockFileTypes)) {
            console.log(`    ${chalk.cyan(type)}: ${chalk.green(count.toString())}`);
          }
        }
      } else {
        console.log(chalk.yellow('\n  No projects with package.json found to analyze'));
      }
    }

    // Handle cleanup
    if (!options.dryRun && !options.analyze) {
      // Confirm before cleanup unless force is enabled
      if (!options.force) {
        console.log(chalk.yellow('\n⚠️  This will permanently delete the above directories.'));
        console.log(chalk.gray('Press Ctrl+C to cancel, or wait 5 seconds to continue...'));

        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Build safety options
      const safetyOptions = {
        bypassSafetyChecks: options.force,
        allowWarningLevel: options.allowWarnings,
        verbose: options.json,
      };

      // Perform cleanup with safety checks
      const cleanupResult: CleanupResult = await withSpinner(
        () => removeNodeModules(result.directories, safetyOptions),
        'Removing node_modules directories...',
        `Removed ${chalk.bold('0')} directories`,
        'Cleanup operation failed',
        { color: 'green' }
      );

      // Output cleanup results
      if (options.json) {
        console.log(JSON.stringify(cleanupResult, null, 2));
      } else {
        console.log(chalk.gray('\n  📊 Cleanup Results:'));
        console.log(chalk.gray('    Removed:'), chalk.green.bold(cleanupResult.removedCount.toString()));
        console.log(chalk.gray('    Failed:'), chalk.red.bold(cleanupResult.failedCount.toString()));

        // Display space reclamation reporting
        console.log(chalk.gray('\n  💾 Space Reclamation:'));
        console.log(chalk.gray('    Space freed:'));
        console.log(chalk.green.bold(`      ${formatBytes(cleanupResult.sizeFreed)}`));
        console.log(chalk.gray(`      (${cleanupResult.sizeFreed.toLocaleString()} bytes)`));

        // Calculate reclamation percentage
        const reclamationPercentage = result.totalSize > 0
          ? ((cleanupResult.sizeFreed / result.totalSize) * 100).toFixed(2)
          : '0.00';
        console.log(chalk.gray('\n    Reclamation efficiency:'));
        console.log(chalk.cyan(`      ${reclamationPercentage}% of estimated space`));

        console.log(chalk.gray('\n  ⏱️  Execution time:'), chalk.gray(`${cleanupResult.executionTime}ms`));

        if (cleanupResult.failed.length > 0) {
          console.log(chalk.red('\n  ❌ Failed to remove:'));
          for (const failure of cleanupResult.failed) {
            console.log(`    ${chalk.red('✗')} ${chalk.cyan(failure.path)}`);
            console.log(`      ${chalk.gray(failure.error)}`);
          }
        }
      }
    } else if (options.dryRun) {
      console.log(chalk.yellow('\n⚠️  Dry-run complete: No changes were applied'));
      console.log(chalk.gray('To remove these directories, run without --dry-run'));
    } else if (options.analyze) {
      console.log(chalk.blue('\n📊 Analysis complete'));
      console.log(chalk.gray('Use without --analyze to perform cleanup'));
    }

    console.log(chalk.green('\n✓ Node modules cleanup command completed'));
  });

/**
 * Parse number string to number
 */
function parseNumber(value: string): number | undefined {
  if (!value) return undefined;
  const num = parseInt(value, 10);
  return isNaN(num) ? undefined : num;
}
