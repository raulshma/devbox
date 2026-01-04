/**
 * Conflict Resolution Module
 *
 * Provides smart conflict resolution strategies for file operations
 * (copy, move, delete) when destination files already exist.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, statSync } from 'fs';
import { createHash } from 'crypto';

/**
 * Conflict resolution strategies
 */
export enum ConflictStrategy {
  /** Skip the file and don't overwrite */
  SKIP = 'skip',
  /** Overwrite the existing file */
  OVERWRITE = 'overwrite',
  /** Rename the new file with a suffix (e.g., file_1.txt, file_2.txt) */
  RENAME = 'rename',
  /** Keep the newer file based on modification time */
  KEEP_NEWER = 'keep-newer',
  /** Keep the older file based on modification time */
  KEEP_OLDER = 'keep-older',
  /** Keep the larger file based on size */
  KEEP_LARGER = 'keep-larger',
  /** Keep the smaller file based on size */
  KEEP_SMALLER = 'keep-smaller',
  /** Create a backup of existing file before overwriting */
  BACKUP = 'backup',
  /** Compare checksums and skip if identical */
  SKIP_IDENTICAL = 'skip-identical',
  /** Merge directories (for directory operations) */
  MERGE = 'merge',
}

/**
 * Options for conflict resolution
 */
export interface ConflictResolutionOptions {
  /** Primary strategy to use for conflicts */
  strategy: ConflictStrategy;
  /** Suffix pattern for rename strategy (default: '_$n' where $n is number) */
  renameSuffix?: string;
  /** Maximum rename attempts (default: 100) */
  maxRenameAttempts?: number;
  /** Backup suffix for backup strategy (default: '.bak') */
  backupSuffix?: string;
  /** Whether to preserve backup timestamps */
  preserveBackupTimestamp?: boolean;
  /** Callback for custom conflict handling */
  onConflict?: (conflict: FileConflict) => Promise<ConflictResolution>;
}

/**
 * Information about a file conflict
 */
export interface FileConflict {
  /** Type of operation that caused the conflict */
  operation: 'copy' | 'move';
  /** Source file path */
  source: string;
  /** Destination file path (existing) */
  destination: string;
  /** Source file stats */
  sourceStats: FileStats;
  /** Destination file stats */
  destStats: FileStats;
  /** Whether files are identical (by checksum) */
  isIdentical?: boolean;
}

/**
 * File statistics for conflict comparison
 */
export interface FileStats {
  size: number;
  mtime: Date;
  isDirectory: boolean;
  checksum?: string;
}

/**
 * Result of conflict resolution
 */
export interface ConflictResolution {
  /** Action to take */
  action: 'skip' | 'proceed' | 'rename' | 'backup';
  /** New destination path (for rename action) */
  newDestination?: string;
  /** Backup path (for backup action) */
  backupPath?: string;
  /** Reason for the decision */
  reason: string;
}

/**
 * Result of processing a conflict
 */
export interface ConflictResult {
  /** Whether the conflict was handled successfully */
  success: boolean;
  /** Original source path */
  source: string;
  /** Original destination path */
  originalDestination: string;
  /** Final destination path (may be different if renamed) */
  finalDestination?: string;
  /** Action taken */
  action: 'skipped' | 'overwritten' | 'renamed' | 'backed-up';
  /** Human-readable reason */
  reason: string;
  /** Backup path if backup was created */
  backupPath?: string;
}

/**
 * Default options for conflict resolution
 */
const DEFAULT_OPTIONS: Required<ConflictResolutionOptions> = {
  strategy: ConflictStrategy.SKIP,
  renameSuffix: '_$n',
  maxRenameAttempts: 100,
  backupSuffix: '.bak',
  preserveBackupTimestamp: true,
  onConflict: async () => ({ action: 'skip', reason: 'Default handler' }),
};

/**
 * Calculate MD5 checksum of a file
 */
async function calculateChecksum(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return createHash('md5').update(content).digest('hex');
}

/**
 * Get file statistics for comparison
 */
async function getFileStats(filePath: string, includeChecksum: boolean = false): Promise<FileStats> {
  const stats = await fs.stat(filePath);
  const result: FileStats = {
    size: stats.size,
    mtime: stats.mtime,
    isDirectory: stats.isDirectory(),
  };

  if (includeChecksum && !stats.isDirectory()) {
    result.checksum = await calculateChecksum(filePath);
  }

  return result;
}

/**
 * Generate a unique filename with suffix
 */
function generateUniqueName(
  filePath: string,
  suffix: string,
  attempt: number
): string {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);

  const resolvedSuffix = suffix.replace('$n', attempt.toString());
  return path.join(dir, `${baseName}${resolvedSuffix}${ext}`);
}

/**
 * Find a unique filename that doesn't exist
 */
async function findUniqueName(
  filePath: string,
  options: Required<ConflictResolutionOptions>
): Promise<string | null> {
  for (let i = 1; i <= options.maxRenameAttempts; i++) {
    const newPath = generateUniqueName(filePath, options.renameSuffix, i);
    if (!existsSync(newPath)) {
      return newPath;
    }
  }
  return null;
}

/**
 * Create a backup of a file
 */
async function createBackup(
  filePath: string,
  options: Required<ConflictResolutionOptions>
): Promise<string> {
  const backupPath = `${filePath}${options.backupSuffix}`;

  // If backup already exists, find a unique name
  let finalBackupPath = backupPath;
  let attempt = 1;
  while (existsSync(finalBackupPath) && attempt <= options.maxRenameAttempts) {
    finalBackupPath = `${filePath}${options.backupSuffix}.${attempt}`;
    attempt++;
  }

  // Copy the existing file to backup location
  await fs.copyFile(filePath, finalBackupPath);

  // Preserve timestamp if requested
  if (options.preserveBackupTimestamp) {
    const stats = await fs.stat(filePath);
    await fs.utimes(finalBackupPath, stats.atime, stats.mtime);
  }

  return finalBackupPath;
}

/**
 * ConflictResolver class for handling file conflicts
 */
export class ConflictResolver {
  private options: Required<ConflictResolutionOptions>;

  constructor(options: Partial<ConflictResolutionOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Check if there's a conflict at the destination
   */
  hasConflict(destination: string): boolean {
    return existsSync(destination);
  }

  /**
   * Detect and analyze a file conflict
   */
  async detectConflict(
    source: string,
    destination: string,
    operation: 'copy' | 'move'
  ): Promise<FileConflict | null> {
    if (!this.hasConflict(destination)) {
      return null;
    }

    const needsChecksum = this.options.strategy === ConflictStrategy.SKIP_IDENTICAL;

    const [sourceStats, destStats] = await Promise.all([
      getFileStats(source, needsChecksum),
      getFileStats(destination, needsChecksum),
    ]);

    const conflict: FileConflict = {
      operation,
      source,
      destination,
      sourceStats,
      destStats,
    };

    if (needsChecksum && sourceStats.checksum && destStats.checksum) {
      conflict.isIdentical = sourceStats.checksum === destStats.checksum;
    }

    return conflict;
  }

  /**
   * Resolve a conflict based on the configured strategy
   */
  async resolveConflict(conflict: FileConflict): Promise<ConflictResolution> {
    switch (this.options.strategy) {
      case ConflictStrategy.SKIP:
        return {
          action: 'skip',
          reason: 'Destination exists, skipping',
        };

      case ConflictStrategy.OVERWRITE:
        return {
          action: 'proceed',
          reason: 'Overwriting existing file',
        };

      case ConflictStrategy.RENAME:
        const newPath = await findUniqueName(conflict.destination, this.options);
        if (newPath) {
          return {
            action: 'rename',
            newDestination: newPath,
            reason: `Renamed to avoid conflict: ${path.basename(newPath)}`,
          };
        }
        return {
          action: 'skip',
          reason: 'Could not find unique name after max attempts',
        };

      case ConflictStrategy.KEEP_NEWER:
        if (conflict.sourceStats.mtime > conflict.destStats.mtime) {
          return {
            action: 'proceed',
            reason: 'Source is newer, overwriting',
          };
        }
        return {
          action: 'skip',
          reason: 'Destination is newer, skipping',
        };

      case ConflictStrategy.KEEP_OLDER:
        if (conflict.sourceStats.mtime < conflict.destStats.mtime) {
          return {
            action: 'proceed',
            reason: 'Source is older, overwriting',
          };
        }
        return {
          action: 'skip',
          reason: 'Destination is older, skipping',
        };

      case ConflictStrategy.KEEP_LARGER:
        if (conflict.sourceStats.size > conflict.destStats.size) {
          return {
            action: 'proceed',
            reason: 'Source is larger, overwriting',
          };
        }
        return {
          action: 'skip',
          reason: 'Destination is larger, skipping',
        };

      case ConflictStrategy.KEEP_SMALLER:
        if (conflict.sourceStats.size < conflict.destStats.size) {
          return {
            action: 'proceed',
            reason: 'Source is smaller, overwriting',
          };
        }
        return {
          action: 'skip',
          reason: 'Destination is smaller, skipping',
        };

      case ConflictStrategy.BACKUP:
        return {
          action: 'backup',
          reason: 'Creating backup before overwriting',
        };

      case ConflictStrategy.SKIP_IDENTICAL:
        if (conflict.isIdentical) {
          return {
            action: 'skip',
            reason: 'Files are identical (same checksum), skipping',
          };
        }
        return {
          action: 'proceed',
          reason: 'Files are different, overwriting',
        };

      case ConflictStrategy.MERGE:
        if (conflict.sourceStats.isDirectory && conflict.destStats.isDirectory) {
          return {
            action: 'proceed',
            reason: 'Merging directories',
          };
        }
        return {
          action: 'skip',
          reason: 'Cannot merge non-directories',
        };

      default:
        // Use custom handler if provided
        if (this.options.onConflict) {
          return this.options.onConflict(conflict);
        }
        return {
          action: 'skip',
          reason: 'Unknown strategy, skipping',
        };
    }
  }

  /**
   * Handle a conflict with the full workflow
   */
  async handleConflict(
    source: string,
    destination: string,
    operation: 'copy' | 'move'
  ): Promise<ConflictResult> {
    const conflict = await this.detectConflict(source, destination, operation);

    // No conflict - proceed normally
    if (!conflict) {
      return {
        success: true,
        source,
        originalDestination: destination,
        finalDestination: destination,
        action: 'overwritten',
        reason: 'No conflict, proceeding',
      };
    }

    const resolution = await this.resolveConflict(conflict);

    switch (resolution.action) {
      case 'skip':
        return {
          success: true,
          source,
          originalDestination: destination,
          action: 'skipped',
          reason: resolution.reason,
        };

      case 'proceed':
        return {
          success: true,
          source,
          originalDestination: destination,
          finalDestination: destination,
          action: 'overwritten',
          reason: resolution.reason,
        };

      case 'rename':
        return {
          success: true,
          source,
          originalDestination: destination,
          finalDestination: resolution.newDestination,
          action: 'renamed',
          reason: resolution.reason,
        };

      case 'backup':
        try {
          const backupPath = await createBackup(destination, this.options);
          return {
            success: true,
            source,
            originalDestination: destination,
            finalDestination: destination,
            action: 'backed-up',
            reason: resolution.reason,
            backupPath,
          };
        } catch (error) {
          return {
            success: false,
            source,
            originalDestination: destination,
            action: 'skipped',
            reason: `Failed to create backup: ${(error as Error).message}`,
          };
        }

      default:
        return {
          success: false,
          source,
          originalDestination: destination,
          action: 'skipped',
          reason: 'Unknown resolution action',
        };
    }
  }

  /**
   * Get the current strategy
   */
  getStrategy(): ConflictStrategy {
    return this.options.strategy;
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<ConflictResolutionOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Create a conflict resolver with the specified strategy
 */
export function createConflictResolver(
  strategy: ConflictStrategy,
  options: Partial<ConflictResolutionOptions> = {}
): ConflictResolver {
  return new ConflictResolver({ ...options, strategy });
}

/**
 * Parse conflict strategy from string
 */
export function parseConflictStrategy(value: string): ConflictStrategy | null {
  const normalized = value.toLowerCase().replace(/_/g, '-');
  const strategies: Record<string, ConflictStrategy> = {
    'skip': ConflictStrategy.SKIP,
    'overwrite': ConflictStrategy.OVERWRITE,
    'rename': ConflictStrategy.RENAME,
    'keep-newer': ConflictStrategy.KEEP_NEWER,
    'keep-older': ConflictStrategy.KEEP_OLDER,
    'keep-larger': ConflictStrategy.KEEP_LARGER,
    'keep-smaller': ConflictStrategy.KEEP_SMALLER,
    'backup': ConflictStrategy.BACKUP,
    'skip-identical': ConflictStrategy.SKIP_IDENTICAL,
    'merge': ConflictStrategy.MERGE,
  };
  return strategies[normalized] || null;
}

/**
 * Get list of available conflict strategies
 */
export function getAvailableStrategies(): { name: string; description: string }[] {
  return [
    { name: 'skip', description: 'Skip the file and don\'t overwrite' },
    { name: 'overwrite', description: 'Overwrite the existing file' },
    { name: 'rename', description: 'Rename the new file with a suffix (e.g., file_1.txt)' },
    { name: 'keep-newer', description: 'Keep the newer file based on modification time' },
    { name: 'keep-older', description: 'Keep the older file based on modification time' },
    { name: 'keep-larger', description: 'Keep the larger file based on size' },
    { name: 'keep-smaller', description: 'Keep the smaller file based on size' },
    { name: 'backup', description: 'Create a backup of existing file before overwriting' },
    { name: 'skip-identical', description: 'Compare checksums and skip if identical' },
    { name: 'merge', description: 'Merge directories (for directory operations)' },
  ];
}
