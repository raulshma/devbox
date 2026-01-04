/**
 * .NET Directory Detector Utility
 *
 * Detects bin and obj directories in .NET projects for cleanup operations
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import {
  validateDotnetSafety,
  SafetyCheckOptions,
  SafetyValidationResult,
} from './safetyConfig.js';

/**
 * Represents a detected .NET output directory
 */
export interface DotnetDirectory {
  /** Full path to the directory */
  path: string;

  /** Type of directory ('bin' or 'obj') */
  type: 'bin' | 'obj';

  /** Parent project directory */
  projectPath: string;

  /** Size in bytes */
  size: number;

  /** Number of files in directory */
  fileCount: number;

  /** Whether directory contains .NET-specific artifacts */
  hasArtifacts: boolean;
}

/**
 * Result of directory detection scan
 */
export interface DotnetDetectionResult {
  /** All detected bin/obj directories */
  directories: DotnetDirectory[];

  /** Total number of directories found */
  totalCount: number;

  /** Total size in bytes */
  totalSize: number;

  /** Breakdown by type */
  byType: {
    bin: number;
    obj: number;
  };

  /** Number of .NET projects detected */
  projectCount: number;

  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Supported .NET project types
 */
export type DotnetProjectType = 'csproj' | 'fsproj' | 'vbproj' | 'all';

/**
 * Filter options for .NET directory detection
 */
export interface DotnetFilterOptions {
  /** Filter by project type */
  projectType?: DotnetProjectType;

  /** Path to .sln solution file - only clean projects in this solution */
  solutionFile?: string;

  /** Custom glob patterns to include projects */
  includePatterns?: string[];

  /** Custom glob patterns to exclude projects */
  excludePatterns?: string[];

  /** Only clean projects matching these names */
  projectNames?: string[];
}

/**
 * Options for .NET directory detection
 */
export interface DotnetDetectionOptions {
  /** Root directory to scan (default: current directory) */
  rootDir?: string;

  /** Maximum scan depth (default: 10) */
  maxDepth?: number;

  /** Whether to calculate directory sizes (default: true) */
  calculateSize?: boolean;

  /** Whether to count files (default: true) */
  countFiles?: boolean;

  /** Exclude patterns */
  exclude?: string[];

  /** Include hidden directories (default: false) */
  includeHidden?: boolean;

  /** Filtering options */
  filters?: DotnetFilterOptions;
}

/**
 * Minimal glob implementation for pattern matching
 */
function globMatch(pattern: string, text: string): boolean {
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(text);
}

/**
 * Check if a path matches any of the provided glob patterns
 */
function matchesAnyPattern(text: string, patterns: string[]): boolean {
  return patterns.some(pattern => globMatch(pattern, text));
}

/**
 * Parse .sln file and extract project paths
 */
async function parseSolutionFile(solutionPath: string): Promise<Set<string>> {
  const projectPaths = new Set<string>();

  try {
    const content = await fs.readFile(solutionPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      // Match project declaration lines in .sln files
      // Format: Project("{GUID}") = "ProjectName", "ProjectPath", "{GUID}"
      const match = line.match(/Project\s*\([^)]+\)\s*=\s*"[^"]*"\s*,\s*"([^"]+)"\s*,/i);
      if (match && match[1]) {
        // Resolve relative path from solution file directory
        const solutionDir = path.dirname(solutionPath);
        let projectPath = match[1];

        // Convert backslashes and resolve relative paths
        projectPath = projectPath.replace(/\\/g, path.sep);
        if (!path.isAbsolute(projectPath)) {
          projectPath = path.resolve(solutionDir, projectPath);
        }

        // The project path in solution points to the .csproj/.fsproj/.vbproj file
        // We need to get the directory containing it
        const projectDir = path.dirname(projectPath);

        // Normalize the path for consistent comparison
        projectPaths.add(path.normalize(projectDir));
      }
    }
  } catch (error) {
    // If we can't parse the solution file, return empty set
    console.warn(`Warning: Could not parse solution file: ${solutionPath}`);
  }

  return projectPaths;
}

/**
 * Check if a project should be included based on filter options
 */
async function shouldIncludeProject(
  projectPath: string,
  filters: DotnetFilterOptions,
  solutionProjects: Set<string> | null
): Promise<boolean> {
  // If no filters, include all projects
  if (!filters) {
    return true;
  }

  // Check project type filter
  if (filters.projectType && filters.projectType !== 'all') {
    const projectExt = `.${filters.projectType}`;

    // Check if the directory contains a project file of the specified type
    const hasMatchingProjectFile = await fs.readdir(projectPath)
      .then(entries => entries.some(entry =>
        entry.endsWith(projectExt)
      ))
      .catch(() => false);

    if (!hasMatchingProjectFile) {
      return false;
    }
  }

  // Check solution file filter
  if (filters.solutionFile && solutionProjects) {
    const normalizedProjectPath = path.normalize(projectPath);
    if (!solutionProjects.has(normalizedProjectPath)) {
      return false;
    }
  }

  // Check include patterns
  if (filters.includePatterns && filters.includePatterns.length > 0) {
    const relativePath = path.relative(process.cwd(), projectPath);
    const projectName = path.basename(projectPath);

    if (!matchesAnyPattern(relativePath, filters.includePatterns) &&
        !matchesAnyPattern(projectName, filters.includePatterns)) {
      return false;
    }
  }

  // Check exclude patterns
  if (filters.excludePatterns && filters.excludePatterns.length > 0) {
    const relativePath = path.relative(process.cwd(), projectPath);
    const projectName = path.basename(projectPath);

    if (matchesAnyPattern(relativePath, filters.excludePatterns) ||
        matchesAnyPattern(projectName, filters.excludePatterns)) {
      return false;
    }
  }

  // Check project names
  if (filters.projectNames && filters.projectNames.length > 0) {
    // Get all project files in the directory
    const projectFiles = await fs.readdir(projectPath)
      .then(entries => entries.filter(entry =>
        entry.endsWith('.csproj') || entry.endsWith('.fsproj') || entry.endsWith('.vbproj')
      ))
      .catch(() => []);

    // Check if any of the project files match the filter
    const matches = projectFiles.some(projFile =>
      filters.projectNames!.some(name => {
        // Support both exact match and glob pattern
        return name === projFile || globMatch(name, projFile);
      })
    );

    if (!matches) {
      return false;
    }
  }

  return true;
}

/**
 * Recursively scan directory for .NET projects
 */
async function findDotnetProjects(
  dirPath: string,
  currentDepth: number,
  maxDepth: number,
  exclude: string[] = [],
  includeHidden: boolean = false,
  filters?: DotnetFilterOptions
): Promise<string[]> {
  const projects: string[] = [];

  // Check depth limit
  if (currentDepth > maxDepth) {
    return projects;
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Check if this is a .NET project directory
    const hasCsproj = entries.some(
      (entry) => entry.isFile() && entry.name.endsWith('.csproj')
    );
    const hasFsproj = entries.some(
      (entry) => entry.isFile() && entry.name.endsWith('.fsproj')
    );
    const hasVbproj = entries.some(
      (entry) => entry.isFile() && entry.name.endsWith('.vbproj')
    );
    const hasProjectFile = hasCsproj || hasFsproj || hasVbproj;

    if (hasProjectFile) {
      projects.push(dirPath);
    }

    // Recursively scan subdirectories
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      // Skip hidden directories unless requested
      if (!includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      // Skip excluded directories
      if (exclude.some((pattern) => entry.name.match(pattern))) {
        continue;
      }

      // Skip node_modules and other common non-project directories
      // Only skip if we're not at the root level (depth > 0)
      if (
        currentDepth > 0 &&
        ['node_modules', 'dist', 'build', 'out', '.git', 'bin', 'obj'].includes(
          entry.name
        )
      ) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const subProjects = await findDotnetProjects(
        fullPath,
        currentDepth + 1,
        maxDepth,
        exclude,
        includeHidden,
        filters
      );
      projects.push(...subProjects);
    }
  } catch (error) {
    // Ignore directories we can't read
  }

  return projects;
}

/**
 * Check if a directory contains .NET artifacts
 */
async function checkForArtifacts(dirPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Look for common .NET build artifacts
    const artifactPatterns = [
      /\.dll$/i,
      /\.exe$/i,
      /\.pdb$/i,
      /\.config$/i,
      /^\.NETCore/,
      /^Ref/,
      /^Debug/,
      /^Release/,
    ];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check for common build configuration directories
        if (['Debug', 'Release', 'net', 'ref'].includes(entry.name)) {
          return true;
        }
      } else if (entry.isFile()) {
        // Check file patterns
        if (artifactPatterns.some((pattern) => pattern.test(entry.name))) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Calculate directory size and file count
 */
async function getDirectoryStats(dirPath: string): Promise<{
  size: number;
  fileCount: number;
}> {
  let size = 0;
  let fileCount = 0;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isFile()) {
        try {
          const stats = await fs.stat(fullPath);
          size += stats.size;
          fileCount++;
        } catch {
          // Skip files we can't stat
        }
      } else if (entry.isDirectory()) {
        const subStats = await getDirectoryStats(fullPath);
        size += subStats.size;
        fileCount += subStats.fileCount;
      }
    }
  } catch {
    // Ignore errors
  }

  return { size, fileCount };
}

/**
 * Find bin and obj directories for a given project
 */
async function findOutputDirectories(
  projectPath: string,
  calculateSize: boolean,
  countFiles: boolean
): Promise<DotnetDirectory[]> {
  const outputDirs: DotnetDirectory[] = [];

  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      // Look for bin and obj directories
      if (entry.name === 'bin' || entry.name === 'obj') {
        const dirPath = path.join(projectPath, entry.name);
        const type: 'bin' | 'obj' = entry.name;

        let size = 0;
        let fileCount = 0;
        let hasArtifacts = false;

        // Check for artifacts
        hasArtifacts = await checkForArtifacts(dirPath);

        // Calculate stats if requested
        if (calculateSize || countFiles) {
          const stats = await getDirectoryStats(dirPath);
          size = stats.size;
          fileCount = stats.fileCount;
        }

        outputDirs.push({
          path: dirPath,
          type,
          projectPath,
          size,
          fileCount,
          hasArtifacts,
        });
      }
    }
  } catch {
    // Ignore errors
  }

  return outputDirs;
}

/**
 * Detect bin and obj directories in .NET projects
 *
 * @param options - Detection options
 * @returns Detection result with found directories
 */
export async function detectDotnetDirectories(
  options: DotnetDetectionOptions = {}
): Promise<DotnetDetectionResult> {
  const startTime = Date.now();

  const {
    rootDir = process.cwd(),
    maxDepth = 10,
    calculateSize = true,
    countFiles = true,
    exclude = [],
    includeHidden = false,
    filters,
  } = options;

  // Parse solution file if provided
  let solutionProjects: Set<string> | null = null;
  if (filters?.solutionFile) {
    solutionProjects = await parseSolutionFile(filters.solutionFile);
  }

  // Find all .NET projects
  const allProjects = await findDotnetProjects(
    rootDir,
    0,
    maxDepth,
    exclude,
    includeHidden,
    filters
  );

  // Filter projects based on filter options
  const filteredProjects: string[] = [];
  for (const project of allProjects) {
    const shouldInclude = await shouldIncludeProject(
      project,
      filters || {},
      solutionProjects
    );
    if (shouldInclude) {
      filteredProjects.push(project);
    }
  }

  // Find bin/obj directories for each filtered project
  const allDirectories: DotnetDirectory[] = [];
  for (const project of filteredProjects) {
    const dirs = await findOutputDirectories(
      project,
      calculateSize,
      countFiles
    );
    allDirectories.push(...dirs);
  }

  // Calculate totals
  let totalSize = 0;
  let binCount = 0;
  let objCount = 0;

  for (const dir of allDirectories) {
    totalSize += dir.size;
    if (dir.type === 'bin') {
      binCount++;
    } else {
      objCount++;
    }
  }

  const executionTime = Date.now() - startTime;

  return {
    directories: allDirectories,
    totalCount: allDirectories.length,
    totalSize,
    byType: {
      bin: binCount,
      obj: objCount,
    },
    projectCount: filteredProjects.length,
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
 * Remove detected bin/obj directories
 *
 * @param directories - List of directories to remove
 * @param safetyOptions - Safety check options
 * @returns Cleanup result with statistics
 */
export async function removeDotnetDirectories(
  directories: DotnetDirectory[],
  safetyOptions?: SafetyCheckOptions
): Promise<CleanupResult> {
  const startTime = Date.now();

  // Perform safety checks
  const projectPaths = [...new Set(directories.map(d => d.projectPath))];
  const safetyResult: SafetyValidationResult = await validateDotnetSafety(
    projectPaths,
    safetyOptions
  );

  // If safety check fails and we're not bypassing, throw error
  if (!safetyResult.canProceed) {
    const errorMessages: string[] = [];

    if (safetyResult.protectedItems.length > 0) {
      errorMessages.push('Protected projects detected that would be affected:');
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

  // Filter out protected projects based on safety options
  let directoriesToRemove = directories;

  if (!safetyOptions?.bypassSafetyChecks) {
    const protectedPaths = new Set([
      ...safetyResult.protectedItems.map(p => p.path),
      ...(safetyOptions?.allowWarningLevel ? [] : safetyResult.warnings.map(p => p.path)),
    ]);

    directoriesToRemove = directories.filter(d => !protectedPaths.has(d.projectPath));
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
