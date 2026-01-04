/**
 * Node Modules Detector Utility
 *
 * Detects node_modules directories in directory trees for cleanup operations
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import {
  validateNodeModulesSafety,
  SafetyCheckOptions,
  SafetyValidationResult,
} from './safetyConfig.js';

/**
 * Represents a detected node_modules directory
 */
export interface NodeModulesDirectory {
  /** Full path to the node_modules directory */
  path: string;

  /** Parent project directory */
  projectPath: string;

  /** Size in bytes */
  size: number;

  /** Number of files/directories in node_modules */
  itemCount: number;

  /** Whether package.json exists in parent directory */
  hasPackageJson: boolean;

  /** Depth from root directory */
  depth: number;
}

/**
 * Result of node_modules detection scan
 */
export interface NodeDetectionResult {
  /** All detected node_modules directories */
  directories: NodeModulesDirectory[];

  /** Total number of node_modules found */
  totalCount: number;

  /** Total size in bytes */
  totalSize: number;

  /** Number of projects detected (directories with package.json) */
  projectCount: number;

  /** Number of orphaned node_modules (without package.json) */
  orphanedCount: number;

  /** Breakdown by depth */
  byDepth: Record<number, number>;

  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Options for node_modules detection
 */
export interface NodeDetectionOptions {
  /** Root directory to scan (default: current directory) */
  rootDir?: string;

  /** Maximum scan depth (default: unlimited) */
  maxDepth?: number;

  /** Whether to calculate directory sizes (default: true) */
  calculateSize?: boolean;

  /** Whether to count items in node_modules (default: false for performance) */
  countItems?: boolean;

  /** Exclude patterns */
  exclude?: string[];

  /** Include hidden directories (default: false) */
  includeHidden?: boolean;

  /** Only detect node_modules with package.json in parent (default: false) */
  onlyWithPackageJson?: boolean;
}

/**
 * Recursively scan directory for node_modules
 */
async function findNodeModulesDirectories(
  dirPath: string,
  currentDepth: number,
  maxDepth: number | undefined,
  rootDir: string,
  options: NodeDetectionOptions
): Promise<NodeModulesDirectory[]> {
  const results: NodeModulesDirectory[] = [];

  // Check depth limit
  if (maxDepth !== undefined && currentDepth > maxDepth) {
    return results;
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Check for node_modules in current directory
    const hasNodeModules = entries.some(
      (entry) => entry.isDirectory() && entry.name === 'node_modules'
    );

    // Check for package.json to determine if this is a project
    const hasPackageJson = entries.some(
      (entry) => entry.isFile() && entry.name === 'package.json'
    );

    // Skip if onlyWithPackageJson is true and there's no package.json
    if (hasNodeModules) {
      if (!options.onlyWithPackageJson || hasPackageJson) {
        const nodeModulesPath = path.join(dirPath, 'node_modules');
        const depth = path.relative(rootDir, dirPath).split(path.sep).length;

        let size = 0;
        let itemCount = 0;

        // Calculate stats if requested
        if (options.calculateSize || options.countItems) {
          const stats = await getNodeModulesStats(nodeModulesPath, options.calculateSize || false, options.countItems || false);
          size = stats.size;
          itemCount = stats.itemCount;
        }

        results.push({
          path: nodeModulesPath,
          projectPath: dirPath,
          size,
          itemCount,
          hasPackageJson,
          depth,
        });
      }
    }

    // Recursively scan subdirectories
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      // Skip hidden directories unless requested
      if (!options.includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      // Skip excluded directories
      if (options.exclude && options.exclude.some((pattern) => entry.name.match(pattern))) {
        continue;
      }

      // Skip common non-project directories
      const skipDirs = ['node_modules', 'dist', 'build', 'out', '.git', 'bin', 'obj', 'coverage'];
      if (skipDirs.includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const subResults = await findNodeModulesDirectories(
        fullPath,
        currentDepth + 1,
        maxDepth,
        rootDir,
        options
      );
      results.push(...subResults);
    }
  } catch (error) {
    // Ignore directories we can't read
  }

  return results;
}

/**
 * Calculate node_modules directory size and item count
 */
async function getNodeModulesStats(
  dirPath: string,
  calculateSize: boolean,
  countItems: boolean
): Promise<{ size: number; itemCount: number }> {
  let size = 0;
  let itemCount = 0;

  if (!calculateSize && !countItems) {
    return { size, itemCount };
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isFile()) {
        try {
          if (calculateSize) {
            const stats = await fs.stat(fullPath);
            size += stats.size;
          }
          if (countItems) {
            itemCount++;
          }
        } catch {
          // Skip files we can't stat
        }
      } else if (entry.isDirectory()) {
        const subStats = await getNodeModulesStats(fullPath, calculateSize, countItems);
        size += subStats.size;
        itemCount += subStats.itemCount;
        if (countItems) {
          itemCount++; // Count the directory itself
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return { size, itemCount };
}

/**
 * Detect node_modules directories in directory trees
 *
 * @param options - Detection options
 * @returns Detection result with found directories
 */
export async function detectNodeModules(
  options: NodeDetectionOptions = {}
): Promise<NodeDetectionResult> {
  const startTime = Date.now();

  const {
    rootDir = process.cwd(),
    maxDepth,
    calculateSize = true,
    countItems = false,
    exclude = [],
    includeHidden = false,
    onlyWithPackageJson = false,
  } = options;

  // Find all node_modules directories
  const directories = await findNodeModulesDirectories(
    rootDir,
    0,
    maxDepth,
    rootDir,
    { calculateSize, countItems, exclude, includeHidden, onlyWithPackageJson }
  );

  // Calculate totals
  let totalSize = 0;
  let projectCount = 0;
  let orphanedCount = 0;
  const byDepth: Record<number, number> = {};

  for (const dir of directories) {
    totalSize += dir.size;

    if (dir.hasPackageJson) {
      projectCount++;
    } else {
      orphanedCount++;
    }

    byDepth[dir.depth] = (byDepth[dir.depth] || 0) + 1;
  }

  const executionTime = Date.now() - startTime;

  return {
    directories,
    totalCount: directories.length,
    totalSize,
    projectCount,
    orphanedCount,
    byDepth,
    executionTime,
  };
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Number of directories successfully removed */
  removedCount: number;

  /** Number of directories that failed to remove */
  failedCount: number;

  /** Total size freed in bytes */
  sizeFreed: number;

  /** Directories that were successfully removed */
  removed: string[];

  /** Directories that failed to remove with error messages */
  failed: Array<{ path: string; error: string }>;

  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Remove detected node_modules directories
 *
 * @param directories - List of directories to remove
 * @param safetyOptions - Safety check options
 * @returns Cleanup result with statistics
 */
export async function removeNodeModules(
  directories: NodeModulesDirectory[],
  safetyOptions?: SafetyCheckOptions
): Promise<CleanupResult> {
  const startTime = Date.now();

  // Perform safety checks
  const dirPaths = directories.map(d => d.path);
  const safetyResult: SafetyValidationResult = await validateNodeModulesSafety(
    dirPaths,
    safetyOptions
  );

  // If safety check fails and we're not bypassing, throw error
  if (!safetyResult.canProceed) {
    const errorMessages: string[] = [];

    if (safetyResult.protectedItems.length > 0) {
      errorMessages.push('Protected modules detected that would be deleted:');
      for (const item of safetyResult.protectedItems) {
        errorMessages.push(`  - ${item.name}: ${item.reason}`);
      }
    }

    if (safetyResult.warnings.length > 0 && !safetyOptions?.allowWarningLevel) {
      errorMessages.push('Warnings:');
      for (const item of safetyResult.warnings) {
        errorMessages.push(`  - ${item.name}: ${item.reason}`);
      }
    }

    errorMessages.push('');
    errorMessages.push('To bypass safety checks, use --force flag');
    errorMessages.push('To allow deletion with warnings, use --allow-warnings flag');

    throw new Error('\n' + errorMessages.join('\n'));
  }

  // Filter out protected modules based on safety options
  let directoriesToRemove = directories;

  if (!safetyOptions?.bypassSafetyChecks) {
    const protectedPaths = new Set([
      ...safetyResult.protectedItems.map(p => p.path),
      ...(safetyOptions?.allowWarningLevel ? [] : safetyResult.warnings.map(p => p.path)),
    ]);

    directoriesToRemove = directories.filter(d => !protectedPaths.has(d.path));
  }

  const removed: string[] = [];
  const failed: Array<{ path: string; error: string }> = [];
  let sizeFreed = 0;

  for (const dir of directoriesToRemove) {
    try {
      // Remove directory recursively
      await fs.rm(dir.path, { recursive: true, force: true });
      removed.push(dir.path);
      sizeFreed += dir.size;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failed.push({
        path: dir.path,
        error: errorMessage,
      });
    }
  }

  const executionTime = Date.now() - startTime;

  return {
    removedCount: removed.length,
    failedCount: failed.length,
    sizeFreed,
    removed,
    failed,
    executionTime,
  };
}
