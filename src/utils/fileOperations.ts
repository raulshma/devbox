/**
 * File Operations Utility
 *
 * Provides copy, move, and delete operations with basic error handling
 * and smart conflict resolution strategies
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import {
  FileNotFoundError,
  FileAccessError,
  ValidationError,
} from '../errors/CustomErrors.js';
import { FileOps } from '../config/helpers.js';
import { moveToTrash, isTrashSupported } from './trashOperations.js';
import {
  ConflictResolver,
  ConflictStrategy,
  ConflictResolutionOptions,
  ConflictResult,
  createConflictResolver,
  parseConflictStrategy,
  getAvailableStrategies,
} from './conflictResolver.js';

/**
 * Options for preserving file metadata during operations
 */
export interface MetadataPreservationOptions {
  /** Preserve file permissions (mode) */
  permissions?: boolean;
  /** Preserve access and modification timestamps */
  timestamps?: boolean;
  /** Preserve file ownership (uid/gid) - requires elevated privileges on Unix */
  ownership?: boolean;
}

/**
 * Detailed file metadata captured from source files
 */
export interface FileMetadata {
  /** File permissions mode */
  mode: number;
  /** User ID (Unix only) */
  uid: number;
  /** Group ID (Unix only) */
  gid: number;
  /** Access time */
  atime: Date;
  /** Modification time */
  mtime: Date;
  /** Birth/creation time (if available) */
  birthtime: Date;
  /** Is a directory */
  isDirectory: boolean;
  /** Is a symbolic link */
  isSymbolicLink: boolean;
}

/**
 * Capture metadata from a file
 */
export async function captureMetadata(filePath: string): Promise<FileMetadata> {
  const stats = await fs.stat(filePath);
  let isSymlink = false;
  try {
    const lstats = await fs.lstat(filePath);
    isSymlink = lstats.isSymbolicLink();
  } catch {
    // Ignore lstat errors
  }

  return {
    mode: stats.mode,
    uid: stats.uid,
    gid: stats.gid,
    atime: stats.atime,
    mtime: stats.mtime,
    birthtime: stats.birthtime,
    isDirectory: stats.isDirectory(),
    isSymbolicLink: isSymlink,
  };
}

/**
 * Apply metadata to a file
 */
export async function applyMetadata(
  filePath: string,
  metadata: FileMetadata,
  options: MetadataPreservationOptions = {}
): Promise<void> {
  const { permissions = true, timestamps = true, ownership = false } = options;

  try {
    // Apply permissions
    if (permissions) {
      await fs.chmod(filePath, metadata.mode);
    }

    // Apply timestamps
    if (timestamps) {
      await fs.utimes(filePath, metadata.atime, metadata.mtime);
    }

    // Apply ownership (Unix only, requires elevated privileges)
    if (ownership && process.platform !== 'win32') {
      try {
        await fs.chown(filePath, metadata.uid, metadata.gid);
      } catch (error: any) {
        // Silently ignore permission errors for ownership changes
        // This typically requires root/admin privileges
        if (error.code !== 'EPERM' && error.code !== 'ENOTSUP') {
          throw error;
        }
      }
    }
  } catch (error: any) {
    // Silently ignore errors on filesystems that don't support these operations
    if (error.code !== 'ENOTSUP' && error.code !== 'EPERM') {
      throw error;
    }
  }
}

export interface CopyOptions {
  /** Preserve file permissions and timestamps */
  preserve?: boolean;
  /** Overwrite existing files */
  overwrite?: boolean;
  /** Recursive copy for directories */
  recursive?: boolean;
  /** Maximum depth for recursive copy (0 = unlimited) */
  maxDepth?: number;
  /** Filter files by glob pattern (e.g., '*.ts', 'test/*.js') */
  filter?: string | string[];
  /** Filter files by regex pattern */
  filterRegex?: RegExp;
  /** Callback function to filter files dynamically */
  filterCallback?: (sourcePath: string, stats: any) => boolean;
  /** Conflict resolution strategy */
  conflictStrategy?: ConflictStrategy;
  /** Conflict resolver instance (overrides conflictStrategy) */
  conflictResolver?: ConflictResolver;
}

export interface MoveOptions {
  /** Preserve file permissions, timestamps, and attributes */
  preserve?: boolean;
  /** Overwrite existing files */
  overwrite?: boolean;
  /** Conflict resolution strategy */
  conflictStrategy?: ConflictStrategy;
  /** Conflict resolver instance (overrides conflictStrategy) */
  conflictResolver?: ConflictResolver;
}

export interface DeleteOptions {
  /** Recursive delete for directories */
  recursive?: boolean;
  /** Force deletion without confirmation */
  force?: boolean;
  /** Move to trash instead of permanent deletion */
  useTrash?: boolean;
}

export interface OperationResult {
  success: boolean;
  source?: string;
  destination?: string;
  error?: string;
  filesProcessed?: number;
  /** Number of files skipped due to conflict resolution */
  filesSkipped?: number;
  /** Number of files renamed due to conflict resolution */
  filesRenamed?: number;
  /** Number of backups created */
  backupsCreated?: number;
  /** Conflict resolution details */
  conflictResults?: ConflictResult[];
}

// Re-export conflict resolution types for external use
export {
  ConflictResolver,
  ConflictStrategy,
  ConflictResolutionOptions,
  ConflictResult,
  createConflictResolver,
  parseConflictStrategy,
  getAvailableStrategies,
} from './conflictResolver.js';

/**
 * Convert glob pattern to regex for filtering
 */
function globToRegex(globPattern: string): RegExp {
  // First escape special regex characters except * and ?
  let regexString = globPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&');  // Escape special chars except * and ?
  // Then convert glob wildcards to regex
  regexString = regexString
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexString}$`);
}

/**
 * Check if a file path matches the filter criteria
 */
function matchesFilter(
  filePath: string,
  options: CopyOptions,
  basePath: string
): boolean {
  // Get relative path from base path
  const relativePath = path.relative(basePath, filePath);
  const fileName = path.basename(filePath);

  // Check regex filter
  if (options.filterRegex) {
    if (options.filterRegex.test(relativePath) || options.filterRegex.test(fileName)) {
      return true;
    }
    // If regex filter is set and doesn't match, return false
    return false;
  }

  // Check glob filter
  if (options.filter) {
    const filters = Array.isArray(options.filter) ? options.filter : [options.filter];
    for (const pattern of filters) {
      const regex = globToRegex(pattern);
      // Match against filename and relative path
      if (regex.test(fileName) || regex.test(relativePath)) {
        return true;
      }
    }
    return false; // Must match at least one pattern
  }

  // Check callback filter
  if (options.filterCallback) {
    return options.filterCallback(filePath, null);
  }

  // No filter means match everything
  return true;
}

/**
 * Internal copy context for tracking conflict resolution across recursive calls
 */
interface CopyContext {
  conflictResults: ConflictResult[];
  filesSkipped: number;
  filesRenamed: number;
  backupsCreated: number;
}

/**
 * Copy a file or directory with smart conflict resolution
 */
export async function copy(
  source: string,
  destination: string,
  options: CopyOptions = {},
  currentDepth: number = 0,
  basePath?: string,
  context?: CopyContext
): Promise<OperationResult> {
  const { preserve = false, overwrite = false, recursive = true, maxDepth = 0 } = options;

  // Initialize context on first call
  const ctx = context || {
    conflictResults: [],
    filesSkipped: 0,
    filesRenamed: 0,
    backupsCreated: 0,
  };

  // Get or create conflict resolver
  const conflictResolver = options.conflictResolver
    || (options.conflictStrategy
      ? createConflictResolver(options.conflictStrategy)
      : (overwrite ? createConflictResolver(ConflictStrategy.OVERWRITE) : null));

  // Set base path on initial call
  const effectiveBasePath = basePath || source;

  // Validate source exists
  if (!existsSync(source)) {
    throw new FileNotFoundError({
      code: 'FILE_NOT_FOUND',
      message: `Source file not found: ${source}`,
      path: source,
    });
  }

  try {
    const sourceStats = await fs.stat(source);
    let filesProcessed = 0;

    if (sourceStats.isDirectory()) {
      // Handle directory copy
      if (!recursive) {
        throw new ValidationError({
          code: 'INVALID_OPERATION',
          message: 'Cannot copy directory without recursive option',
          userMessage: 'Use --recursive to copy directories',
        });
      }

      // Check depth limit
      if (maxDepth > 0 && currentDepth >= maxDepth) {
        // When at max depth, create the directory but don't copy its contents
        await fs.mkdir(destination, { recursive: true });
        return {
          success: true,
          source,
          destination,
          filesProcessed: 0,
          filesSkipped: ctx.filesSkipped,
          filesRenamed: ctx.filesRenamed,
          backupsCreated: ctx.backupsCreated,
          conflictResults: ctx.conflictResults,
        };
      }

      // Handle directory merge with conflict resolution
      if (existsSync(destination) && conflictResolver) {
        const conflictResult = await conflictResolver.handleConflict(source, destination, 'copy');
        ctx.conflictResults.push(conflictResult);

        if (conflictResult.action === 'skipped') {
          ctx.filesSkipped++;
          return {
            success: true,
            source,
            destination,
            filesProcessed: 0,
            filesSkipped: ctx.filesSkipped,
            filesRenamed: ctx.filesRenamed,
            backupsCreated: ctx.backupsCreated,
            conflictResults: ctx.conflictResults,
          };
        }
      }

      // Create destination directory
      await fs.mkdir(destination, { recursive: true });

      // Copy directory contents
      const entries = await fs.readdir(source, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);

        // Apply filter if specified (only for files, not directories)
        const hasFilter = options.filter || options.filterRegex || options.filterCallback;
        if (hasFilter && !entry.isDirectory()) {
          if (!matchesFilter(srcPath, options, effectiveBasePath)) {
            continue; // Skip files that don't match filter
          }
        }

        const result = await copy(
          srcPath,
          destPath,
          {
            preserve,
            overwrite,
            recursive,
            maxDepth,
            filter: options.filter,
            filterRegex: options.filterRegex,
            filterCallback: options.filterCallback,
            conflictStrategy: options.conflictStrategy,
            conflictResolver: options.conflictResolver,
          },
          currentDepth + 1,
          effectiveBasePath,
          ctx
        );
        if (result.success) {
          filesProcessed += (result.filesProcessed || 0);
        }
      }

      // Preserve directory permissions and timestamps if requested
      if (preserve) {
        const metadata = await captureMetadata(source);
        await applyMetadata(destination, metadata, {
          permissions: true,
          timestamps: true,
          ownership: false,
        });
      }
    } else {
      // Handle file copy with conflict resolution
      let finalDestination = destination;

      if (existsSync(destination)) {
        if (conflictResolver) {
          // Use conflict resolver for smart resolution
          const conflictResult = await conflictResolver.handleConflict(source, destination, 'copy');
          ctx.conflictResults.push(conflictResult);

          switch (conflictResult.action) {
            case 'skipped':
              ctx.filesSkipped++;
              return {
                success: true,
                source,
                destination,
                filesProcessed: 0,
                filesSkipped: ctx.filesSkipped,
                filesRenamed: ctx.filesRenamed,
                backupsCreated: ctx.backupsCreated,
                conflictResults: ctx.conflictResults,
              };

            case 'renamed':
              finalDestination = conflictResult.finalDestination!;
              ctx.filesRenamed++;
              break;

            case 'backed-up':
              ctx.backupsCreated++;
              break;

            case 'overwritten':
              // Proceed with overwrite
              break;
          }
        } else if (!overwrite) {
          // No conflict resolver and overwrite is false
          throw new ValidationError({
            code: 'FILE_EXISTS',
            message: `Destination already exists: ${destination}`,
            userMessage: 'Use --overwrite or --conflict-strategy to handle existing files',
          });
        }
      }

      // Ensure destination directory exists
      const destDir = path.dirname(finalDestination);
      await fs.mkdir(destDir, { recursive: true });

      // Copy file
      await fs.copyFile(source, finalDestination);

      // Preserve permissions and timestamps if requested
      if (preserve) {
        const metadata = await captureMetadata(source);
        await applyMetadata(finalDestination, metadata, {
          permissions: true,
          timestamps: true,
          ownership: false, // Ownership requires elevated privileges
        });
      }

      filesProcessed = 1;
    }

    return {
      success: true,
      source,
      destination,
      filesProcessed,
      filesSkipped: ctx.filesSkipped,
      filesRenamed: ctx.filesRenamed,
      backupsCreated: ctx.backupsCreated,
      conflictResults: ctx.conflictResults,
    };
  } catch (error) {
    // Re-throw our custom errors
    if (
      error instanceof FileNotFoundError ||
      error instanceof FileAccessError ||
      error instanceof ValidationError
    ) {
      throw error;
    }

    // Wrap other errors
    throw new FileAccessError({
      code: 'COPY_FAILED',
      message: `Failed to copy from ${source} to ${destination}`,
      path: source,
      operation: 'copy',
      context: { destination },
      cause: error as Error,
    });
  }
}

/**
 * Move a file or directory with smart conflict resolution
 */
export async function move(
  source: string,
  destination: string,
  options: MoveOptions = {}
): Promise<OperationResult> {
  const { overwrite = false, preserve = false } = options;

  // Get or create conflict resolver
  const conflictResolver = options.conflictResolver
    || (options.conflictStrategy
      ? createConflictResolver(options.conflictStrategy)
      : (overwrite ? createConflictResolver(ConflictStrategy.OVERWRITE) : null));

  // Validate source exists
  if (!existsSync(source)) {
    throw new FileNotFoundError({
      code: 'FILE_NOT_FOUND',
      message: `Source file not found: ${source}`,
      path: source,
    });
  }

  try {
    let finalDestination = destination;
    let filesSkipped = 0;
    let filesRenamed = 0;
    let backupsCreated = 0;
    const conflictResults: ConflictResult[] = [];

    // Capture source stats before any operations (for cross-filesystem moves)
    const sourceStats = await fs.stat(source);

    // Handle conflict if destination exists
    if (existsSync(destination)) {
      if (conflictResolver) {
        const conflictResult = await conflictResolver.handleConflict(source, destination, 'move');
        conflictResults.push(conflictResult);

        switch (conflictResult.action) {
          case 'skipped':
            filesSkipped++;
            return {
              success: true,
              source,
              destination,
              filesProcessed: 0,
              filesSkipped,
              filesRenamed,
              backupsCreated,
              conflictResults,
            };

          case 'renamed':
            finalDestination = conflictResult.finalDestination!;
            filesRenamed++;
            break;

          case 'backed-up':
            backupsCreated++;
            // Remove the existing file after backup is created
            await fs.unlink(destination);
            break;

          case 'overwritten':
            // Remove the existing file/directory before moving
            const destStats = await fs.stat(destination);
            if (destStats.isDirectory()) {
              await fs.rm(destination, { recursive: true, force: true });
            } else {
              await fs.unlink(destination);
            }
            break;
        }
      } else if (!overwrite) {
        throw new ValidationError({
          code: 'FILE_EXISTS',
          message: `Destination already exists: ${destination}`,
          userMessage: 'Use --overwrite or --conflict-strategy to handle existing files',
        });
      } else {
        // Legacy overwrite behavior
        const destStats = await fs.stat(destination);
        if (destStats.isDirectory()) {
          await fs.rm(destination, { recursive: true, force: true });
        } else {
          await fs.unlink(destination);
        }
      }
    }

    // Ensure destination directory exists
    const destDir = path.dirname(finalDestination);
    await fs.mkdir(destDir, { recursive: true });

    // Move file/directory
    // Try fs.rename first (fast, same filesystem)
    try {
      await fs.rename(source, finalDestination);
      // fs.rename on same filesystem preserves all metadata automatically
    } catch (renameError: any) {
      // If cross-device link error (EXDEV), fall back to copy + delete
      if (renameError.code === 'EXDEV') {
        // Copy file with preservation if enabled
        await fs.copyFile(source, finalDestination);

        // Preserve permissions and timestamps for cross-filesystem moves
        if (preserve) {
          await fs.chmod(finalDestination, sourceStats.mode);
          await fs.utimes(finalDestination, sourceStats.atime, sourceStats.mtime);
        }

        // Remove the source after successful copy
        if (sourceStats.isDirectory()) {
          await fs.rm(source, { recursive: true, force: true });
        } else {
          await fs.unlink(source);
        }
      } else {
        throw renameError;
      }
    }

    // For same-filesystem moves, explicitly set timestamps if preserve is enabled
    // (fs.rename preserves mode but we still apply for consistency)
    if (preserve && existsSync(finalDestination)) {
      try {
        await fs.chmod(finalDestination, sourceStats.mode);
        await fs.utimes(finalDestination, sourceStats.atime, sourceStats.mtime);
      } catch {
        // Silently ignore preservation errors on filesystems that don't support it
      }
    }

    return {
      success: true,
      source,
      destination: finalDestination,
      filesProcessed: 1,
      filesSkipped,
      filesRenamed,
      backupsCreated,
      conflictResults,
    };
  } catch (error) {
    // Re-throw our custom errors
    if (
      error instanceof FileNotFoundError ||
      error instanceof FileAccessError ||
      error instanceof ValidationError
    ) {
      throw error;
    }

    // Wrap other errors
    throw new FileAccessError({
      code: 'MOVE_FAILED',
      message: `Failed to move from ${source} to ${destination}`,
      path: source,
      operation: 'move',
      context: { destination },
      cause: error as Error,
    });
  }
}

/**
 * Delete a file or directory
 */
export async function deletePath(
  targetPath: string,
  options: DeleteOptions = {}
): Promise<OperationResult> {
  const { recursive = false } = options;

  // Determine if we should use trash - check explicit option first, then config
  const shouldUseTrash = options.useTrash !== undefined
    ? options.useTrash
    : FileOps.shouldUseTrash();

  // Validate path exists
  if (!existsSync(targetPath)) {
    throw new FileNotFoundError({
      code: 'FILE_NOT_FOUND',
      message: `Path not found: ${targetPath}`,
      path: targetPath,
    });
  }

  try {
    const stats = await fs.stat(targetPath);

    // Check if directory needs recursive flag (unless using trash, which handles it)
    if (stats.isDirectory() && !recursive && !shouldUseTrash) {
      throw new ValidationError({
        code: 'INVALID_OPERATION',
        message: 'Cannot delete directory without recursive option',
        userMessage: 'Use --recursive to delete directories',
      });
    }

    // Use trash if configured and available
    if (shouldUseTrash) {
      const trashSupported = await isTrashSupported();
      if (trashSupported) {
        const trashResult = await moveToTrash(targetPath);
        return {
          success: trashResult.success,
          source: targetPath,
          filesProcessed: trashResult.itemsProcessed,
        };
      }
      // Fall back to permanent deletion if trash is not available
      // (This can happen on some systems or in certain environments)
    }

    // Permanent deletion
    let filesProcessed = 0;

    if (stats.isDirectory()) {
      // Handle directory deletion
      if (!recursive) {
        throw new ValidationError({
          code: 'INVALID_OPERATION',
          message: 'Cannot delete directory without recursive option',
          userMessage: 'Use --recursive to delete directories',
        });
      }

      // Recursively delete directory contents
      const entries = await fs.readdir(targetPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(targetPath, entry.name);
        const result = await deletePath(entryPath, { recursive: true, useTrash: false });
        if (result.success) {
          filesProcessed += (result.filesProcessed || 1);
        }
      }

      // Delete the directory itself
      await fs.rmdir(targetPath);
      filesProcessed++;
    } else {
      // Handle file deletion
      await fs.unlink(targetPath);
      filesProcessed = 1;
    }

    return {
      success: true,
      source: targetPath,
      filesProcessed,
    };
  } catch (error) {
    // Re-throw our custom errors
    if (
      error instanceof FileNotFoundError ||
      error instanceof FileAccessError ||
      error instanceof ValidationError
    ) {
      throw error;
    }

    // Wrap other errors
    throw new FileAccessError({
      code: 'DELETE_FAILED',
      message: `Failed to delete: ${targetPath}`,
      path: targetPath,
      operation: 'delete',
      cause: error as Error,
    });
  }
}

/**
 * Delete multiple files or directories
 */
export async function deleteMultiple(
  paths: string[],
  options: DeleteOptions = {}
): Promise<OperationResult[]> {
  const results: OperationResult[] = [];

  for (const targetPath of paths) {
    try {
      const result = await deletePath(targetPath, options);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        source: targetPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Copy multiple files or directories
 */
export async function copyMultiple(
  sources: Array<{ source: string; destination: string }>,
  options: CopyOptions = {}
): Promise<OperationResult[]> {
  const results: OperationResult[] = [];

  for (const { source, destination } of sources) {
    try {
      const result = await copy(source, destination, options);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        source,
        destination,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Move multiple files or directories
 */
export async function moveMultiple(
  sources: Array<{ source: string; destination: string }>,
  options: MoveOptions = {}
): Promise<OperationResult[]> {
  const results: OperationResult[] = [];

  for (const { source, destination } of sources) {
    try {
      const result = await move(source, destination, options);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        source,
        destination,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}
