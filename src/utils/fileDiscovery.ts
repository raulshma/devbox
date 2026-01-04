/**
 * File Discovery Utility
 *
 * Fast file discovery using fast-glob with advanced filtering and pattern matching
 */

import fg from 'fast-glob';
import * as path from 'path';
import { promises as fs } from 'fs';

export interface FileDiscoveryOptions {
  /** Glob patterns to match files */
  patterns: string | string[];

  /** Root directory to search from (default: current directory) */
  cwd?: string;

  /** Maximum directory depth to traverse (default: infinite) */
  deep?: number;

  /** Case insensitive matching (default: false) */
  caseSensitiveMatch?: boolean;

  /** Only return files (default: true) */
  onlyFiles?: boolean;

  /** Only return directories (default: false) */
  onlyDirectories?: boolean;

  /** Follow symbolic links (default: false) */
  followSymlinkedDirectories?: boolean;

  /** Exclude patterns */
  ignore?: string[];

  /** Absolute paths (default: false - returns relative paths) */
  absolute?: boolean;

  /** File extension filter (e.g., ['.ts', '.js']) */
  extension?: string[];

  /** Minimum file size in bytes */
  minSize?: number;

  /** Maximum file size in bytes */
  maxSize?: number;

  /** Include hidden files (default: false) */
  dot?: boolean;

  /** Custom filter function */
  filter?(filepath: string, stats?: { size: number }): boolean | Promise<boolean>;
}

export interface FileDiscoveryResult {
  /** Array of discovered file paths */
  files: string[];

  /** Number of files found */
  count: number;

  /** Total size in bytes */
  totalSize: number;

  /** Breakdown by file extension */
  byExtension: Record<string, number>;

  /** Execution time in milliseconds */
  executionTime: number;
}

export interface DirectoryInfo {
  path: string;
  fileCount: number;
  totalSize: number;
}

/**
 * Discover files matching the given patterns and options
 */
export async function discoverFiles(options: FileDiscoveryOptions): Promise<FileDiscoveryResult> {
  const startTime = Date.now();

  // Normalize patterns to array
  const patterns = Array.isArray(options.patterns) ? options.patterns : [options.patterns];

  // Configure fast-glob options
  const fgOptions: fg.Options = {
    cwd: options.cwd || process.cwd(),
    deep: options.deep,
    caseSensitiveMatch: options.caseSensitiveMatch ?? true,
    onlyFiles: options.onlyFiles ?? true,
    onlyDirectories: options.onlyDirectories ?? false,
    followSymbolicLinks: options.followSymlinkedDirectories ?? false,
    absolute: options.absolute ?? false,
    dot: options.dot ?? false,
    ignore: options.ignore,
  };

  // Perform the glob search
  let files: string[] = await fg(patterns, fgOptions);

  // Apply extension filter if specified
  if (options.extension && options.extension.length > 0) {
    const extSet = new Set(options.extension.map((e) => e.toLowerCase()));
    files = files.filter((file: string) => {
      const ext = path.extname(file).toLowerCase();
      return extSet.has(ext);
    });
  }

  // Apply custom filter if provided
  if (options.filter) {
    const cwd = fgOptions.cwd as string;
    const filteredFiles: string[] = [];
    for (const file of files) {
      const fullPath = path.join(cwd, file);
      try {
        const stats = await fs.stat(fullPath);
        const shouldInclude = await options.filter(file, { size: stats.size });
        if (shouldInclude) {
          filteredFiles.push(file);
        }
      } catch {
        // If we can't stat the file, skip it
        continue;
      }
    }
    files = filteredFiles;
  }

  // Apply size filters if specified
  if (options.minSize !== undefined || options.maxSize !== undefined) {
    const cwd = fgOptions.cwd as string;
    const sizedFiles: string[] = [];
    for (const file of files) {
      const fullPath = path.join(cwd, file);
      try {
        const stats = await fs.stat(fullPath);
        const size = stats.size;

        if (options.minSize !== undefined && size < options.minSize) {
          continue;
        }
        if (options.maxSize !== undefined && size > options.maxSize) {
          continue;
        }

        sizedFiles.push(file);
      } catch {
        continue;
      }
    }
    files = sizedFiles;
  }

  // Calculate statistics
  const byExtension: Record<string, number> = {};
  let totalSize = 0;
  const cwd = fgOptions.cwd as string;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase() || '(no extension)';
    byExtension[ext] = (byExtension[ext] || 0) + 1;

    const fullPath = path.join(cwd, file);
    try {
      const stats = await fs.stat(fullPath);
      totalSize += stats.size;
    } catch {
      // Ignore stat errors
    }
  }

  const executionTime = Date.now() - startTime;

  return {
    files,
    count: files.length,
    totalSize,
    byExtension,
    executionTime,
  };
}

/**
 * Discover files and group them by directory
 */
export async function discoverByDirectory(
  options: FileDiscoveryOptions
): Promise<Map<string, DirectoryInfo>> {
  const result = await discoverFiles(options);
  const dirMap = new Map<string, DirectoryInfo>();
  const cwd = options.cwd || process.cwd();

  for (const file of result.files) {
    const dir = path.dirname(file) || '.';
    const fullPath = path.join(cwd, file);

    if (!dirMap.has(dir)) {
      dirMap.set(dir, {
        path: dir,
        fileCount: 0,
        totalSize: 0,
      });
    }

    const info = dirMap.get(dir)!;
    info.fileCount++;

    try {
      const stats = await fs.stat(fullPath);
      info.totalSize += stats.size;
    } catch {
      // Ignore stat errors
    }
  }

  return dirMap;
}

/**
 * Search for files containing specific text (simple grep-like functionality)
 */
export async function searchInFiles(
  options: FileDiscoveryOptions,
  searchText: string,
  searchOptions: {
    caseSensitive?: boolean;
    maxResults?: number;
    contextLines?: number;
  } = {}
): Promise<Array<{ file: string; matches: number; lines: string[] }>> {
  const result = await discoverFiles(options);
  const results: Array<{ file: string; matches: number; lines: string[] }> = [];
  const { caseSensitive = false, maxResults = Infinity, contextLines = 0 } = searchOptions;
  const cwd = options.cwd || process.cwd();

  const searchRegex = new RegExp(
    searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    caseSensitive ? 'g' : 'gi'
  );

  for (const file of result.files) {
    if (results.length >= maxResults) break;

    const fullPath = path.join(cwd, file);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      const matches: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (searchRegex.test(lines[i])) {
          // Add context lines if requested
          const start = Math.max(0, i - contextLines);
          const end = Math.min(lines.length, i + contextLines + 1);

          for (let j = start; j < end; j++) {
            if (!matches.includes(lines[j])) {
              matches.push(lines[j]);
            }
          }
        }
      }

      if (matches.length > 0) {
        results.push({
          file,
          matches: matches.length,
          lines: matches,
        });
      }
    } catch {
      // Skip files that can't be read as text
      continue;
    }
  }

  return results;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
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
 * Get common glob patterns for file types
 */
export const CommonPatterns = {
  // Code files
  typescript: '**/*.ts',
  javascript: '**/*.js',
  jsx: '**/*.jsx',
  tsx: '**/*.tsx',
  python: '**/*.py',
  java: '**/*.java',
  csharp: '**/*.cs',
  cpp: '**/*.cpp',
  c: '**/*.c',

  // Config files
  json: '**/*.json',
  yaml: '**/*.{yml,yaml}',
  xml: '**/*.xml',
  toml: '**/*.toml',
  ini: '**/*.ini',

  // Style files
  css: '**/*.css',
  scss: '**/*.scss',
  less: '**/*.less',

  // Documentation
  markdown: '**/*.md',
  txt: '**/*.txt',

  // Combined
  allCode: '**/*.{ts,tsx,js,jsx,py,java,cs,cpp,c}',
  allConfig: '**/*.{json,yml,yaml,xml,toml,ini}',
  allStyle: '**/*.{css,scss,less}',

  // Special
  allFiles: '**/*',
  allDotfiles: '**/.*',
};
