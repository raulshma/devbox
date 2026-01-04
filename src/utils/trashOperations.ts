/**
 * Trash Operations Utility
 *
 * Provides safe file deletion by moving files to the system trash/recycle bin
 * instead of permanently deleting them.
 */

import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  FileNotFoundError,
  FileAccessError,
} from '../errors/CustomErrors.js';

/**
 * Options for trash operations
 */
export interface TrashOptions {
  /** Whether to treat paths as glob patterns */
  glob?: boolean;
}

/**
 * Result of a trash operation
 */
export interface TrashResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Path that was moved to trash */
  path: string;
  /** Error message if failed */
  error?: string;
  /** Number of items processed */
  itemsProcessed?: number;
}

/**
 * Result of multiple trash operations
 */
export interface TrashMultipleResult {
  /** Whether all operations succeeded */
  success: boolean;
  /** Paths that were successfully moved to trash */
  trashedPaths: string[];
  /** Errors encountered during operation */
  errors: Array<{ path: string; error: string }>;
  /** Total items processed */
  totalProcessed: number;
}

// Lazy-loaded trash module (ESM dynamic import)
let trashModule: ((path: string | readonly string[], options?: { glob?: boolean }) => Promise<void>) | null = null;

/**
 * Get the trash function, loading it lazily
 */
async function getTrashFunction(): Promise<typeof trashModule> {
  if (!trashModule) {
    try {
      // Dynamic import for ESM module
      const trash = await import('trash');
      trashModule = trash.default;
    } catch (error) {
      throw new FileAccessError({
        code: 'TRASH_UNAVAILABLE',
        message: 'Trash module could not be loaded',
        path: '',
        operation: 'trash',
        cause: error as Error,
      });
    }
  }
  return trashModule;
}

/**
 * Check if trash functionality is available on the current system
 */
export async function isTrashSupported(): Promise<boolean> {
  try {
    await getTrashFunction();
    return true;
  } catch {
    return false;
  }
}

/**
 * Move a file or directory to the system trash/recycle bin
 */
export async function moveToTrash(
  targetPath: string,
  options: TrashOptions = {}
): Promise<TrashResult> {
  // Validate path exists
  if (!existsSync(targetPath)) {
    throw new FileNotFoundError({
      code: 'FILE_NOT_FOUND',
      message: `Path not found: ${targetPath}`,
      path: targetPath,
    });
  }

  try {
    const trash = await getTrashFunction();
    if (!trash) {
      throw new FileAccessError({
        code: 'TRASH_UNAVAILABLE',
        message: 'Trash functionality is not available',
        path: targetPath,
        operation: 'trash',
      });
    }

    // Get item count before trashing (for directories)
    let itemsProcessed = 1;
    const stats = await fs.stat(targetPath);
    if (stats.isDirectory()) {
      try {
        itemsProcessed = await countDirectoryItems(targetPath);
      } catch {
        // If counting fails, just use 1
        itemsProcessed = 1;
      }
    }

    // Move to trash
    await trash(targetPath, { glob: options.glob ?? false });

    return {
      success: true,
      path: targetPath,
      itemsProcessed,
    };
  } catch (error) {
    // Re-throw our custom errors
    if (
      error instanceof FileNotFoundError ||
      error instanceof FileAccessError
    ) {
      throw error;
    }

    // Wrap other errors
    throw new FileAccessError({
      code: 'TRASH_FAILED',
      message: `Failed to move to trash: ${targetPath}`,
      path: targetPath,
      operation: 'trash',
      cause: error as Error,
    });
  }
}

/**
 * Move multiple files or directories to the system trash
 */
export async function moveMultipleToTrash(
  paths: string[],
  options: TrashOptions = {}
): Promise<TrashMultipleResult> {
  const trashedPaths: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  let totalProcessed = 0;

  for (const targetPath of paths) {
    try {
      const result = await moveToTrash(targetPath, options);
      trashedPaths.push(targetPath);
      totalProcessed += result.itemsProcessed || 1;
    } catch (error) {
      errors.push({
        path: targetPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: errors.length === 0,
    trashedPaths,
    errors,
    totalProcessed,
  };
}

/**
 * Count the number of items in a directory (recursively)
 */
async function countDirectoryItems(dirPath: string): Promise<number> {
  let count = 1; // Count the directory itself

  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      count += await countDirectoryItems(entryPath);
    } else {
      count++;
    }
  }

  return count;
}
