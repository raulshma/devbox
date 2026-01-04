/**
 * Safety Configuration Module
 *
 * Defines protected modules and safety mechanisms to prevent deletion
 * of essential dependencies and critical project files.
 */

import * as path from 'path';

/**
 * Protection rules for node_modules cleanup
 */
export interface NodeProtectionRule {
  /** Pattern to match package.json name */
  packageName?: string | RegExp;

  /** Pattern to match directory path */
  pathPattern?: RegExp;

  /** Reason for protection */
  reason: string;

  /** Severity level */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Protection rules for .NET cleanup
 */
export interface DotnetProtectionRule {
  /** Pattern to match project file name */
  projectName?: string | RegExp;

  /** Pattern to match directory path */
  pathPattern?: RegExp;

  /** Reason for protection */
  reason: string;

  /** Severity level */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Safety configuration options
 */
export interface SafetyCheckOptions {
  /** Skip safety checks (dangerous!) */
  bypassSafetyChecks?: boolean;

  /** Allow deletion of protected modules with warning severity */
  allowWarningLevel?: boolean;

  /** Output detailed safety check results */
  verbose?: boolean;

  /** Custom protected packages (node_modules) */
  customProtectedPackages?: string[];

  /** Custom protected projects (.NET) */
  customProtectedProjects?: string[];
}

/**
 * Result of safety validation
 */
export interface SafetyValidationResult {
  /** Whether validation passed */
  passed: boolean;

  /** Protected items that would be deleted */
  protectedItems: ProtectedItem[];

  /** Warnings about potentially important items */
  warnings: ProtectedItem[];

  /** Can proceed with deletion (with warnings allowed) */
  canProceed: boolean;
}

/**
 * A protected item detected during safety check
 */
export interface ProtectedItem {
  /** Path to the protected item */
  path: string;

  /** Type of protection */
  type: 'package' | 'project' | 'path';

  /** Name of the protected item */
  name: string;

  /** Reason for protection */
  reason: string;

  /** Severity level */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Default protected node packages
 * These are essential development tools that should not be deleted
 */
export const DEFAULT_PROTECTED_NODE_PACKAGES: NodeProtectionRule[] = [
  {
    packageName: /^@types\//,
    reason: 'TypeScript type definitions - required for type checking',
    severity: 'warning',
  },
  {
    packageName: 'typescript',
    reason: 'TypeScript compiler - required for building',
    severity: 'error',
  },
  {
    packageName: '@typescript-eslint',
    reason: 'TypeScript ESLint parser - required for linting',
    severity: 'warning',
  },
  {
    packageName: 'eslint',
    reason: 'ESLint linter - required for code quality',
    severity: 'warning',
  },
  {
    packageName: 'prettier',
    reason: 'Prettier formatter - required for code formatting',
    severity: 'warning',
  },
  {
    packageName: 'jest',
    reason: 'Jest testing framework - required for tests',
    severity: 'warning',
  },
  {
    packageName: '@playwright/test',
    reason: 'Playwright testing framework - required for E2E tests',
    severity: 'warning',
  },
  {
    packageName: 'vite',
    reason: 'Vite build tool - required for development',
    severity: 'warning',
  },
  {
    packageName: 'webpack',
    reason: 'Webpack bundler - required for building',
    severity: 'warning',
  },
  {
    packageName: 'rollup',
    reason: 'Rollup bundler - required for building',
    severity: 'warning',
  },
  {
    packageName: '@babel',
    reason: 'Babel transpiler - required for building',
    severity: 'warning',
  },
  {
    packageName: 'ts-node',
    reason: 'TypeScript execution - required for development',
    severity: 'warning',
  },
  {
    packageName: 'nodemon',
    reason: 'Auto-restart tool - required for development',
    severity: 'info',
  },
  {
    pathPattern: /node_modules\/\.prisma/,
    reason: 'Prisma client - required for database operations',
    severity: 'error',
  },
  {
    pathPattern: /node_modules\/@prisma/,
    reason: 'Prisma ORM - required for database operations',
    severity: 'error',
  },
];

/**
 * Default protected .NET projects
 * These are critical project types that should not be deleted
 */
export const DEFAULT_PROTECTED_DOTNET_PROJECTS: DotnetProtectionRule[] = [
  {
    projectName: /\.Tests\.csproj$/,
    reason: 'Test project - removing tests is not recommended',
    severity: 'warning',
  },
  {
    projectName: /\.Test\.csproj$/,
    reason: 'Test project - removing tests is not recommended',
    severity: 'warning',
  },
  {
    projectName: /Testing\.csproj$/,
    reason: 'Testing infrastructure project',
    severity: 'warning',
  },
  {
    pathPattern: /\/tests\//,
    reason: 'Test directory - removing tests is not recommended',
    severity: 'warning',
  },
  {
    pathPattern: /\/test\//,
    reason: 'Test directory - removing tests is not recommended',
    severity: 'warning',
  },
];

/**
 * Read package.json from a directory
 */
async function readPackageJson(dirPath: string): Promise<any | null> {
  try {
    const fs = await import('fs/promises');
    const packagePath = path.join(dirPath, 'package.json');
    const content = await fs.readFile(packagePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Check if a node_modules directory is protected
 */
export async function checkProtectedNodeModules(
  nodeModulesPath: string,
  customProtected?: string[]
): Promise<ProtectedItem | null> {
  const projectPath = path.dirname(nodeModulesPath);
  const packageJson = await readPackageJson(projectPath);

  if (!packageJson) {
    return null;
  }

  const packageName = packageJson.name;
  const allRules = [...DEFAULT_PROTECTED_NODE_PACKAGES];

  // Add custom protected packages
  if (customProtected) {
    for (const custom of customProtected) {
      allRules.push({
        packageName: custom,
        reason: 'User-defined protected package',
        severity: 'error',
      });
    }
  }

  // Check all protection rules
  for (const rule of allRules) {
    if (rule.packageName) {
      const pattern = typeof rule.packageName === 'string'
        ? new RegExp(`^${rule.packageName}$`)
        : rule.packageName;

      if (pattern.test(packageName)) {
        return {
          path: nodeModulesPath,
          type: 'package',
          name: packageName,
          reason: rule.reason,
          severity: rule.severity,
        };
      }
    }

    if (rule.pathPattern) {
      const relativePath = nodeModulesPath.replace(/\\/g, '/');
      if (rule.pathPattern.test(relativePath)) {
        return {
          path: nodeModulesPath,
          type: 'path',
          name: path.basename(nodeModulesPath),
          reason: rule.reason,
          severity: rule.severity,
        };
      }
    }
  }

  return null;
}

/**
 * Read .csproj file from a directory
 */
async function readCsproj(dirPath: string): Promise<{ name: string; content: string } | null> {
  try {
    const fs = await import('fs/promises');
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.csproj') ||
          entry.name.endsWith('.fsproj') ||
          entry.name.endsWith('.vbproj'))) {
        const projectPath = path.join(dirPath, entry.name);
        const content = await fs.readFile(projectPath, 'utf-8');
        return { name: entry.name, content };
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Check if a .NET bin/obj directory is protected
 */
export async function checkProtectedDotnetDirectory(
  projectPath: string,
  customProtected?: string[]
): Promise<ProtectedItem | null> {
  const project = await readCsproj(projectPath);

  if (!project) {
    return null;
  }

  const projectName = project.name;
  const allRules = [...DEFAULT_PROTECTED_DOTNET_PROJECTS];

  // Add custom protected projects
  if (customProtected) {
    for (const custom of customProtected) {
      allRules.push({
        projectName: custom,
        reason: 'User-defined protected project',
        severity: 'error',
      });
    }
  }

  // Check all protection rules
  for (const rule of allRules) {
    if (rule.projectName) {
      const pattern = typeof rule.projectName === 'string'
        ? new RegExp(`^${rule.projectName}$`)
        : rule.projectName;

      if (pattern.test(projectName)) {
        return {
          path: projectPath,
          type: 'project',
          name: projectName,
          reason: rule.reason,
          severity: rule.severity,
        };
      }
    }

    if (rule.pathPattern) {
      const relativePath = projectPath.replace(/\\/g, '/');
      if (rule.pathPattern.test(relativePath)) {
        return {
          path: projectPath,
          type: 'path',
          name: path.basename(projectPath),
          reason: rule.reason,
          severity: rule.severity,
        };
      }
    }
  }

  return null;
}

/**
 * Validate node_modules directories for safety
 */
export async function validateNodeModulesSafety(
  directories: string[],
  options: SafetyCheckOptions = {}
): Promise<SafetyValidationResult> {
  const protectedItems: ProtectedItem[] = [];
  const warnings: ProtectedItem[] = [];

  for (const dirPath of directories) {
    const protectedItemResult = await checkProtectedNodeModules(
      dirPath,
      options.customProtectedPackages
    );

    if (protectedItemResult) {
      if (protectedItemResult.severity === 'error') {
        protectedItems.push(protectedItemResult);
      } else if (protectedItemResult.severity === 'warning') {
        warnings.push(protectedItemResult);
      } else if (protectedItemResult.severity === 'info' && options.verbose) {
        warnings.push(protectedItemResult);
      }
    }
  }

  const hasErrors = protectedItems.some(p => p.severity === 'error');
  const canProceed = options.bypassSafetyChecks ||
    (!hasErrors && (options.allowWarningLevel || warnings.length === 0));

  return {
    passed: protectedItems.length === 0,
    protectedItems,
    warnings,
    canProceed,
  };
}

/**
 * Validate .NET directories for safety
 */
export async function validateDotnetSafety(
  projectPaths: string[],
  options: SafetyCheckOptions = {}
): Promise<SafetyValidationResult> {
  const protectedItems: ProtectedItem[] = [];
  const warnings: ProtectedItem[] = [];

  for (const projectPath of projectPaths) {
    const protectedItemResult = await checkProtectedDotnetDirectory(
      projectPath,
      options.customProtectedProjects
    );

    if (protectedItemResult) {
      if (protectedItemResult.severity === 'error') {
        protectedItems.push(protectedItemResult);
      } else if (protectedItemResult.severity === 'warning') {
        warnings.push(protectedItemResult);
      } else if (protectedItemResult.severity === 'info' && options.verbose) {
        warnings.push(protectedItemResult);
      }
    }
  }

  const hasErrors = protectedItems.some(p => p.severity === 'error');
  const canProceed = options.bypassSafetyChecks ||
    (!hasErrors && (options.allowWarningLevel || warnings.length === 0));

  return {
    passed: protectedItems.length === 0,
    protectedItems,
    warnings,
    canProceed,
  };
}
