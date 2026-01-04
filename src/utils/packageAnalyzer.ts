/**
 * Package Analyzer Utility
 *
 * Analyzes package.json and lock files for dependency insights
 */

import * as path from 'path';
import { promises as fs } from 'fs';

/**
 * Dependency information from package.json
 */
export interface DependencyInfo {
  /** Dependency name */
  name: string;

  /** Version string */
  version: string;

  /** Whether it's a dev dependency */
  isDev: boolean;

  /** Whether it's an optional dependency */
  isOptional: boolean;

  /** Whether it's a peer dependency */
  isPeer: boolean;
}

/**
 * Package.json structure
 */
export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Lock file analysis result
 */
export interface LockFileAnalysis {
  /** Lock file type */
  type: 'npm' | 'yarn' | 'pnpm' | 'unknown';

  /** Lock file path */
  path: string;

  /** Whether lock file exists */
  exists: boolean;

  /** Number of locked dependencies */
  dependencyCount?: number;

  /** Lock file version format */
  lockFileVersion?: string;
}

/**
 * Complete analysis result for a project
 */
export interface PackageAnalysisResult {
  /** Project directory path */
  projectPath: string;

  /** Package.json path */
  packageJsonPath: string;

  /** Whether package.json exists */
  hasPackageJson: boolean;

  /** Package name */
  packageName?: string;

  /** Package version */
  packageVersion?: string;

  /** All dependencies */
  dependencies: DependencyInfo[];

  /** Total number of dependencies */
  totalDependencies: number;

  /** Number of production dependencies */
  productionCount: number;

  /** Number of dev dependencies */
  devCount: number;

  /** Number of optional dependencies */
  optionalCount: number;

  /** Number of peer dependencies */
  peerCount: number;

  /** Lock file analysis */
  lockFile: LockFileAnalysis;

  /** Whether the project has dependencies that could be outdated */
  hasPotentialOutdated: boolean;

  /** Dependencies with suspicious versions (e.g., *, latest, etc.) */
  suspiciousVersions: DependencyInfo[];
}

/**
 * Read and parse package.json
 */
export async function readPackageJson(projectPath: string): Promise<PackageJson | null> {
  const packageJsonPath = path.join(projectPath, 'package.json');

  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Analyze lock file
 */
export async function analyzeLockFile(projectPath: string): Promise<LockFileAnalysis> {
  // Check for npm lock file
  const npmLockPath = path.join(projectPath, 'package-lock.json');
  try {
    await fs.access(npmLockPath);
    const content = await fs.readFile(npmLockPath, 'utf-8');
    const lockData = JSON.parse(content);

    // Count dependencies in lock file
    let dependencyCount = 0;
    if (lockData.dependencies) {
      dependencyCount = Object.keys(lockData.dependencies).length;
    } else if (lockData.packages) {
      // npm v7+ format
      dependencyCount = Object.keys(lockData.packages).filter(
        (p) => p !== '' && !p.startsWith('node_modules/')
      ).length;
    }

    return {
      type: 'npm',
      path: npmLockPath,
      exists: true,
      dependencyCount,
      lockFileVersion: lockData.lockfileVersion,
    };
  } catch {
    // Continue to next lock file type
  }

  // Check for yarn lock file
  const yarnLockPath = path.join(projectPath, 'yarn.lock');
  try {
    await fs.access(yarnLockPath);
    const content = await fs.readFile(yarnLockPath, 'utf-8');
    // Count unique dependency entries
    const lines = content.split('\n');
    const dependencyEntries = lines.filter((line) =>
      line.match(/^[a-zA-Z0-9@_-]+@/)
    ).length;

    return {
      type: 'yarn',
      path: yarnLockPath,
      exists: true,
      dependencyCount: dependencyEntries,
    };
  } catch {
    // Continue to next lock file type
  }

  // Check for pnpm lock file
  const pnpmLockPath = path.join(projectPath, 'pnpm-lock.yaml');
  try {
    await fs.access(pnpmLockPath);
    const content = await fs.readFile(pnpmLockPath, 'utf-8');
    // Rough estimate of dependency count
    const dependencyMatches = content.match(/^[a-zA-Z0-9@_-]+:/gm);
    const dependencyCount = dependencyMatches ? dependencyMatches.length : 0;

    return {
      type: 'pnpm',
      path: pnpmLockPath,
      exists: true,
      dependencyCount,
    };
  } catch {
    // No lock file found
  }

  return {
    type: 'unknown',
    path: '',
    exists: false,
  };
}

/**
 * Extract dependencies from package.json
 */
function extractDependencies(
  packageJson: PackageJson,
  type: 'prod' | 'dev' | 'optional' | 'peer'
): DependencyInfo[] {
  const depsMap =
    type === 'prod'
      ? packageJson.dependencies
      : type === 'dev'
        ? packageJson.devDependencies
        : type === 'optional'
          ? packageJson.optionalDependencies
          : packageJson.peerDependencies;

  if (!depsMap) {
    return [];
  }

  return Object.entries(depsMap).map(([name, version]) => ({
    name,
    version,
    isDev: type === 'dev',
    isOptional: type === 'optional',
    isPeer: type === 'peer',
  }));
}

/**
 * Check for suspicious version patterns
 */
function hasSuspiciousVersion(version: string): boolean {
  const suspiciousPatterns = ['*', 'latest', '>', '>=', '<', '<=', '~', '^x', 'x.', '.x'];
  const lowerVersion = version.toLowerCase();

  return suspiciousPatterns.some((pattern) => lowerVersion.includes(pattern));
}

/**
 * Analyze a project's package.json and lock files
 */
export async function analyzePackage(projectPath: string): Promise<PackageAnalysisResult> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const packageJson = await readPackageJson(projectPath);

  if (!packageJson) {
    return {
      projectPath,
      packageJsonPath,
      hasPackageJson: false,
      dependencies: [],
      totalDependencies: 0,
      productionCount: 0,
      devCount: 0,
      optionalCount: 0,
      peerCount: 0,
      lockFile: await analyzeLockFile(projectPath),
      hasPotentialOutdated: false,
      suspiciousVersions: [],
    };
  }

  // Extract all dependencies
  const prodDeps = extractDependencies(packageJson, 'prod');
  const devDeps = extractDependencies(packageJson, 'dev');
  const optionalDeps = extractDependencies(packageJson, 'optional');
  const peerDeps = extractDependencies(packageJson, 'peer');

  const allDependencies = [...prodDeps, ...devDeps, ...optionalDeps, ...peerDeps];

  // Find suspicious versions
  const suspiciousVersions = allDependencies.filter((dep) =>
    hasSuspiciousVersion(dep.version)
  );

  // Check for potential outdated (heuristic: dependencies with caret or tilde)
  const hasPotentialOutdated = allDependencies.some(
    (dep) => dep.version.startsWith('^') || dep.version.startsWith('~')
  );

  return {
    projectPath,
    packageJsonPath,
    hasPackageJson: true,
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    dependencies: allDependencies,
    totalDependencies: allDependencies.length,
    productionCount: prodDeps.length,
    devCount: devDeps.length,
    optionalCount: optionalDeps.length,
    peerCount: peerDeps.length,
    lockFile: await analyzeLockFile(projectPath),
    hasPotentialOutdated,
    suspiciousVersions,
  };
}

/**
 * Analyze multiple projects
 */
export async function analyzePackages(projectPaths: string[]): Promise<PackageAnalysisResult[]> {
  const results: PackageAnalysisResult[] = [];

  for (const projectPath of projectPaths) {
    const analysis = await analyzePackage(projectPath);
    results.push(analysis);
  }

  return results;
}

/**
 * Format analysis result for display
 */
export function formatAnalysisResult(analysis: PackageAnalysisResult): string {
  const lines: string[] = [];

  if (!analysis.hasPackageJson) {
    lines.push(`❌ No package.json found in ${analysis.projectPath}`);
    return lines.join('\n');
  }

  lines.push(`📦 ${analysis.packageName || 'Unknown Package'} (${analysis.packageVersion || 'no version'})`);
  lines.push(`   Path: ${analysis.projectPath}`);
  lines.push('');
  lines.push(`   Dependencies:`);
  lines.push(`     Production: ${analysis.productionCount}`);
  lines.push(`     Dev: ${analysis.devCount}`);
  lines.push(`     Optional: ${analysis.optionalCount}`);
  lines.push(`     Peer: ${analysis.peerCount}`);
  lines.push(`     Total: ${analysis.totalDependencies}`);
  lines.push('');

  if (analysis.lockFile.exists) {
    lines.push(`   Lock File:`);
    lines.push(`     Type: ${analysis.lockFile.type}`);
    lines.push(`     Path: ${path.basename(analysis.lockFile.path)}`);
    if (analysis.lockFile.dependencyCount) {
      lines.push(`     Locked dependencies: ${analysis.lockFile.dependencyCount}`);
    }
    if (analysis.lockFile.lockFileVersion) {
      lines.push(`     Lock file version: ${analysis.lockFile.lockFileVersion}`);
    }
    lines.push('');
  }

  if (analysis.suspiciousVersions.length > 0) {
    lines.push(`   ⚠️  Suspicious versions (${analysis.suspiciousVersions.length}):`);
    for (const dep of analysis.suspiciousVersions.slice(0, 5)) {
      lines.push(`     - ${dep.name}@${dep.version}`);
    }
    if (analysis.suspiciousVersions.length > 5) {
      lines.push(`     ... and ${analysis.suspiciousVersions.length - 5} more`);
    }
    lines.push('');
  }

  if (analysis.hasPotentialOutdated) {
    lines.push(`   ℹ️  Project may have outdated dependencies (check with npm outdated)`);
  }

  return lines.join('\n');
}

/**
 * Get dependency summary across all analyzed projects
 */
export function getDependencySummary(analyses: PackageAnalysisResult[]): {
  totalProjects: number;
  totalDependencies: number;
  totalProdDeps: number;
  totalDevDeps: number;
  projectsWithLockFiles: number;
  projectsWithSuspiciousVersions: number;
  lockFileTypes: Record<string, number>;
} {
  return {
    totalProjects: analyses.length,
    totalDependencies: analyses.reduce((sum, a) => sum + a.totalDependencies, 0),
    totalProdDeps: analyses.reduce((sum, a) => sum + a.productionCount, 0),
    totalDevDeps: analyses.reduce((sum, a) => sum + a.devCount, 0),
    projectsWithLockFiles: analyses.filter((a) => a.lockFile.exists).length,
    projectsWithSuspiciousVersions: analyses.filter((a) => a.suspiciousVersions.length > 0).length,
    lockFileTypes: analyses.reduce((acc, a) => {
      if (a.lockFile.exists) {
        acc[a.lockFile.type] = (acc[a.lockFile.type] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>),
  };
}
