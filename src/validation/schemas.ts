/**
 * Zod Validation Schemas for Command Inputs
 *
 * Provides clear, descriptive error messages for all command input validation
 */

import { z } from 'zod';

/**
 * Common reusable schemas
 */
export const nonEmptyStringSchema = z.string().min(1, { message: 'This field cannot be empty' });

export const positiveIntegerSchema = z
  .number()
  .int()
  .positive();

export const nonNegativeIntegerSchema = z
  .number()
  .int()
  .nonnegative();

export const filePathSchema = z.string().min(1, { message: 'File path cannot be empty' });

export const directoryPathSchema = z.string().min(1, { message: 'Directory path cannot be empty' });

/**
 * Rename Command Schemas
 */
export const caseConversionTypes = ['lower', 'upper', 'camel', 'kebab', 'snake'] as const;
export const caseConversionSchema = z.enum(caseConversionTypes);

export const numberingFormatSchema = z.string().regex(/^(\w+)?-?\d+,-?\d+(?:,\d+)?$/);

/**
 * Conflict Strategy Types (moved here for use in rename schema)
 */
export const conflictStrategyTypes = [
  'skip',
  'overwrite',
  'rename',
  'keep-newer',
  'keep-older',
  'keep-larger',
  'keep-smaller',
  'backup',
  'skip-identical',
  'merge',
] as const;

export const conflictStrategySchema = z.enum(conflictStrategyTypes);

export const renameOptionsSchema = z.object({
  pattern: z.string().optional().describe('Regex pattern to match files'),
  replacement: z.string().optional().describe('Replacement string (supports groups)'),
  case: caseConversionSchema.optional().describe('Case conversion type'),
  number: numberingFormatSchema.optional().describe('Sequential numbering format'),
  template: z.string().optional().describe('Template for renaming (supports placeholders like {name}, {ext}, {date}, {counter})'),
  filter: z.string().optional().describe('Filter by file type (e.g., "*.ts", "*.js")'),
  dryRun: z.boolean().optional().default(false).describe('Preview changes without applying'),
  undo: z.boolean().optional().default(false).describe('Undo the last rename operation'),
  directory: directoryPathSchema.optional().describe('Target directory (default: current)'),
  depth: z.union([
    nonNegativeIntegerSchema,
    z.string().transform(s => parseInt(s, 10))
  ]).optional().describe('Maximum depth for recursive operations'),
  flags: z.string().optional().describe('Regex flags (e.g., "i", "m", "s", "im")'),
  caseInsensitive: z.boolean().optional().describe('Case insensitive matching'),
  multiline: z.boolean().optional().describe('Multiline mode'),
  dotAll: z.boolean().optional().describe('Dot matches newline'),
  sortByName: z.boolean().optional().describe('Sort files by name before numbering'),
  // Conflict resolution options
  conflictStrategy: z.union([
    conflictStrategySchema,
    z.string() // Allow string that will be parsed by the command
  ]).optional().describe('Conflict resolution strategy when target file exists'),
  renameSuffix: z.string().optional().describe('Suffix pattern for rename strategy (default: "_$n")'),
  maxRenameAttempts: z.union([
    positiveIntegerSchema,
    z.string().transform(s => parseInt(s, 10))
  ]).optional().describe('Maximum rename attempts for conflict resolution'),
  backupSuffix: z.string().optional().describe('Backup suffix for backup strategy (default: ".bak")'),
  listStrategies: z.boolean().optional().default(false).describe('List all available conflict resolution strategies'),
  // Advanced filtering options
  minSize: z.union([
    nonNegativeIntegerSchema,
    z.string().transform(s => parseFileSize(s))
  ]).optional().describe('Minimum file size (e.g., "100B", "1KB", "1MB")'),
  maxSize: z.union([
    nonNegativeIntegerSchema,
    z.string().transform(s => parseFileSize(s))
  ]).optional().describe('Maximum file size (e.g., "100B", "1KB", "1MB")'),
  newer: z.string().optional().describe('Only files newer than this date (e.g., "2024-01-01", "2d", "1w")'),
  older: z.string().optional().describe('Only files older than this date (e.g., "2024-01-01", "2d", "1w")'),
  include: z.array(z.string()).optional().describe('Include files matching these glob patterns'),
  exclude: z.array(z.string()).optional().describe('Exclude files matching these glob patterns'),
}).refine(data => {
  // Validate regex flags format
  if (data.flags) {
    const validFlags = ['g', 'i', 'm', 's', 'u', 'y'];
    const invalidFlags = data.flags.split('').filter(f => !validFlags.includes(f));
    if (invalidFlags.length > 0) {
      return false;
    }
  }
  return true;
}, {
  message: 'Invalid regex flags. Valid flags are: g, i, m, s, u, y',
  path: ['flags'],
}).refine(data => {
  // Validate that newer/older dates are not both specified
  if (data.newer && data.older) {
    const newerTime = parseDateFilter(data.newer);
    const olderTime = parseDateFilter(data.older);
    if (newerTime !== null && olderTime !== null && newerTime > olderTime) {
      return false;
    }
  }
  return true;
}, {
  message: 'Invalid date range: newer date must be before older date',
  path: ['newer', 'older'],
});

/**
 * Parse file size string (e.g., "100B", "1KB", "1MB", "1GB") to bytes
 */
function parseFileSize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) {
    throw new Error(`Invalid file size format: ${sizeStr}`);
  }
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 ** 2,
    'GB': 1024 ** 3,
    'TB': 1024 ** 4,
  };
  if (!multipliers[unit]) {
    throw new Error(`Unknown file size unit: ${unit}`);
  }
  return value * multipliers[unit];
}

/**
 * Parse date filter string to timestamp
 * Supports: "2024-01-01", "2d" (2 days ago), "1w" (1 week ago), "1m" (1 month ago)
 */
function parseDateFilter(dateStr: string): number | null {
  const now = Date.now();

  // Check for relative date patterns (e.g., "2d", "1w", "1m")
  const relativeMatch = dateStr.match(/^(\d+)([dwmy])$/i);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    const multipliers: Record<string, number> = {
      'd': 24 * 60 * 60 * 1000, // days
      'w': 7 * 24 * 60 * 60 * 1000, // weeks
      'm': 30 * 24 * 60 * 60 * 1000, // months (approximate)
      'y': 365 * 24 * 60 * 60 * 1000, // years (approximate)
    };
    return now - value * multipliers[unit];
  }

  // Try parsing as ISO date or common date formats
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.getTime();
  }

  return null;
}

/**
 * Encryption Command Schemas
 */
export const passwordSchema = z.string()
  .min(8, { message: 'Password must be at least 8 characters long' })
  .max(128, { message: 'Password cannot exceed 128 characters' })
  .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  .regex(/[0-9]/, { message: 'Password must contain at least one digit' })
  .regex(/[^a-zA-Z0-9]/, { message: 'Password must contain at least one special character (!@#$%^&*)' })
  .refine((password) => {
    // Check for common weak passwords
    const lowerPassword = password.toLowerCase();
    const commonPasswords = [
      'password', 'password1', 'password123', 'admin123', 'welcome1',
      '12345678', 'abcdefg1', 'qwerty1', 'letmein1', 'monkey1',
    ];
    return !commonPasswords.some((common) => common === lowerPassword);
  }, { message: 'Password is too common and easy to guess' })
  .refine((password) => {
    // Check for repeated characters (3+ same characters in a row)
    return !/(.)\1{2,}/.test(password);
  }, { message: 'Password should not contain repeated characters' })
  .refine((password) => {
    // Check for sequential characters
    return !/(?:abc|bcd|cde|def|012|123|234|345|456|567|678|789)/i.test(password);
  }, { message: 'Password should not contain sequential characters' })
  .refine((password) => {
    // Check for keyboard patterns
    return !/(?:qwerty|asdf|zxcv|qaz|wsx)/i.test(password);
  }, { message: 'Password should not contain keyboard patterns' });

export const encryptionOptionsSchema = z.object({
  files: z.array(z.string()).optional().describe('Files to encrypt'),
  directory: directoryPathSchema.optional().describe('Encrypt all files in directory'),
  password: passwordSchema.optional().describe('Encryption password (will prompt if not provided)'),
  output: directoryPathSchema.optional().describe('Output directory for encrypted files'),
  filter: z.string().optional().describe('Filter by file type (e.g., "*.txt")'),
  dryRun: z.boolean().optional().default(false).describe('Preview encryption without applying'),
  backup: z.boolean().optional().describe('Create backup of original files (overrides config)'),
  parallel: z.string().transform(Number).pipe(positiveIntegerSchema).optional().describe('Number of parallel workers'),
  stream: z.boolean().optional().describe('Force streaming mode for large file support'),
  chunkSize: z.string().transform(Number).pipe(positiveIntegerSchema).optional().describe('Chunk size for streaming in bytes'),
  streamThreshold: z.string().transform(Number).pipe(positiveIntegerSchema).optional().describe('File size threshold for auto-streaming in bytes'),
});

/**
 * Decryption Command Schemas
 */
export const decryptionOptionsSchema = z.object({
  files: z.array(z.string()).optional().describe('Encrypted files to decrypt'),
  directory: directoryPathSchema.optional().describe('Decrypt all files in directory'),
  password: passwordSchema.optional().describe('Decryption password (will prompt if not provided)'),
  output: directoryPathSchema.optional().describe('Output directory for decrypted files'),
  filter: z.string().optional().describe('Filter by file type (e.g., "*.encrypted")'),
  dryRun: z.boolean().optional().default(false).describe('Preview decryption without applying'),
  parallel: z.string().transform(Number).pipe(positiveIntegerSchema).optional().describe('Number of parallel workers'),
  stream: z.boolean().optional().describe('Force streaming mode for large file support'),
  chunkSize: z.string().transform(Number).pipe(positiveIntegerSchema).optional().describe('Chunk size for streaming in bytes'),
  streamThreshold: z.string().transform(Number).pipe(positiveIntegerSchema).optional().describe('File size threshold for auto-streaming in bytes'),
});

/**
 * File Operations Command Schemas
 */
export const fileOperationTypeSchema = z.enum(['copy', 'move', 'delete']);

// Note: conflictStrategyTypes and conflictStrategySchema are defined above for reuse

export const fileOpsOptionsSchema = z.object({
  copy: z.any().optional().describe('Copy files or directories'),
  move: z.any().optional().describe('Move files or directories'),
  delete: z.any().optional().describe('Delete files or directories'),
  filter: z.string().optional().describe('Filter files by glob pattern'),
  regex: z.string().optional().describe('Filter files by regex pattern'),
  recursive: z.boolean().optional().default(false).describe('Process directories recursively'),
  depth: z.union([
    nonNegativeIntegerSchema,
    z.string().transform(s => parseInt(s, 10))
  ]).optional().describe('Maximum depth for recursive operations'),
  dryRun: z.boolean().optional().default(false).describe('Preview operations without applying'),
  preserve: z.boolean().optional().default(false).describe('Preserve permissions and timestamps'),
  overwrite: z.boolean().optional().default(false).describe('Overwrite existing files'),
  conflictStrategy: conflictStrategySchema.optional().describe('Conflict resolution strategy'),
  listStrategies: z.boolean().optional().default(false).describe('List all available conflict resolution strategies'),
});

/**
 * Cleanup Node Command Schemas
 */
export const cleanupNodeOptionsSchema = z.object({
  directory: directoryPathSchema.optional().describe('Root directory to scan (default: current)'),
  deep: z.boolean().optional().default(false).describe('Deep cleanup including unused dependencies'),
  analyze: z.boolean().optional().default(false).describe('Analyze dependencies before cleanup'),
  dryRun: z.boolean().optional().default(false).describe('Preview cleanup without applying'),
  force: z.boolean().optional().default(false).describe('Skip safety checks'),
});

/**
 * Cleanup .NET Command Schemas
 */
export const solutionFileSchema = z.string().regex(/\.sln$/i);

export const dotnetProjectTypeSchema = z.enum(['csproj', 'fsproj', 'vbproj', 'all']);

export const cleanupDotnetOptionsSchema = z.object({
  directory: directoryPathSchema.optional().describe('Root directory to scan (default: current)'),
  solution: solutionFileSchema.optional().describe('Path to .sln file for solution-wide cleanup'),
  dryRun: z.boolean().optional().default(false).describe('Preview cleanup without applying'),
  force: z.boolean().optional().default(false).describe('Skip confirmation prompts'),
  // New filtering options
  projectType: dotnetProjectTypeSchema.optional().describe('Filter by project type (csproj, fsproj, vbproj, all)'),
  include: z.array(z.string()).optional().describe('Include projects matching these glob patterns'),
  exclude: z.array(z.string()).optional().describe('Exclude projects matching these glob patterns'),
  projects: z.array(z.string()).optional().describe('Only clean projects with these names'),
});

/**
 * Validation Result Type
 */
export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors: string[];
}

/**
 * Validate function that wraps Zod parsing with clear error formatting
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string = 'Input'
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
    };
  }

  const errors = result.error.issues.map((err) => {
    const path = err.path.length > 0 ? err.path.join('.') : 'field';
    return `${context}: ${path} - ${err.message}`;
  });

  return {
    success: false,
    errors,
  };
}

/**
 * Schema exports for easy importing
 */
export const schemas = {
  rename: renameOptionsSchema,
  encrypt: encryptionOptionsSchema,
  decrypt: decryptionOptionsSchema,
  fileops: fileOpsOptionsSchema,
  cleanupNode: cleanupNodeOptionsSchema,
  cleanupDotnet: cleanupDotnetOptionsSchema,
};
