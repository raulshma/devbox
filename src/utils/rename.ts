/**
 * Rename Utility
 *
 * Core rename operations with pattern matching, case conversion, and numbering
 * Enhanced with advanced regex features including capture groups, lookaheads, lookbehinds, and backreferences
 * Supports parallel execution of batch operations using worker threads
 * Enhanced with persistent history and improved undo/rollback capabilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { discoverFiles } from './fileDiscovery.js';
import {
  FileNotFoundError,
  FileAccessError,
  ValidationError,
} from '../errors/CustomErrors.js';
import {
  executeParallel,
  type ParallelTask,
  type TaskProcessor,
} from './parallelProcessor.js';
import {
  ConflictResolver,
  ConflictStrategy,
  parseConflictStrategy,
  getAvailableStrategies,
  type ConflictResolutionOptions,
} from './conflictResolver.js';
import * as os from 'os';

/**
 * Case conversion types
 */
export type CaseConversionType = 'lower' | 'upper' | 'camel' | 'kebab' | 'snake';

/**
 * Regex match detail for preview functionality
 */
export interface RegexMatchDetail {
  originalName: string;
  matched: boolean;
  groups: Record<string, string>;
  newFilename: string;
  matchPattern?: string;
}

/**
 * Enhanced regex options with flags
 */
export interface RegexOptions {
  pattern: string;
  replacement?: string;
  flags?: string;
  caseInsensitive?: boolean;
  global?: boolean;
  multiline?: boolean;
  dotAll?: boolean;
}

/**
 * Rename operation interface
 */
export interface RenameOperation {
  sourcePath: string;
  originalName: string;
  newName: string;
}

/**
 * Rename result interface
 */
export interface RenameResult {
  success: boolean;
  sourcePath: string;
  targetPath: string;
  error?: string;
  /** Action taken for conflict resolution */
  conflictAction?: 'skipped' | 'overwritten' | 'renamed' | 'backed-up';
  /** Original destination path before renaming (if conflict was resolved by renaming) */
  originalDestination?: string;
  /** Backup path if backup was created */
  backupPath?: string;
  /** Reason for the conflict resolution action */
  conflictReason?: string;
}

/**
 * Template format options for placeholder values
 */
export type TemplateFormat =
  | 'lower'       // lowercase
  | 'upper'       // UPPERCASE
  | 'camel'       // camelCase
  | 'pascal'      // PascalCase
  | 'snake'       // snake_case
  | 'kebab'       // kebab-case
  | 'title';      // Title Case

/**
 * Template variable interface
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Variable value */
  value: string;
  /** Format to apply */
  format?: TemplateFormat;
}

/**
 * Rename options interface
 */
export interface RenameOptions {
  /** Regex pattern to match filenames */
  pattern?: string;
  /** Replacement string (supports regex groups) */
  replacement?: string;
  /** Case conversion type */
  case?: CaseConversionType;
  /** Sequential numbering format (e.g., "1,100" or "prefix-1,100" or "1,100,2") */
  number?: string;
  /** Template string for renaming (supports placeholders like {name}, {ext}, {date}, {counter}, etc.) */
  template?: string;
  /** Filter by file extension (e.g., "*.ts", "*.js") */
  filter?: string;
  /** Preview changes without applying */
  dryRun?: boolean;
  /** Target directory (default: current) */
  directory?: string;
  /** Maximum depth for recursive operations */
  depth?: number;
  /** Sort files by name before numbering (default: true) */
  sortByName?: boolean;
  /** Regex flags (e.g., "i", "m", "s") */
  flags?: string;
  /** Case insensitive matching */
  caseInsensitive?: boolean;
  /** Multiline mode */
  multiline?: boolean;
  /** Dot matches newline */
  dotAll?: boolean;
  /** Enable parallel processing for batch operations */
  parallel?: boolean;
  /** Maximum number of worker threads for parallel processing */
  maxWorkers?: number;
  /** Conflict resolution strategy when target file exists */
  conflictStrategy?: ConflictStrategy;
  /** Rename suffix pattern for conflict resolution (default: '_$n') */
  renameSuffix?: string;
  /** Maximum rename attempts for conflict resolution (default: 100) */
  maxRenameAttempts?: number;
  /** Backup suffix for backup strategy (default: '.bak') */
  backupSuffix?: string;
  /** Minimum file size in bytes */
  minSize?: number;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Only files newer than this date (timestamp in ms) */
  newer?: string;
  /** Only files older than this date (timestamp in ms) */
  older?: string;
  /** Include files matching these glob patterns */
  include?: string[];
  /** Exclude files matching these glob patterns */
  exclude?: string[];
}

/**
 * Operation history for undo functionality
 */
interface RenameHistoryEntry {
  timestamp: number;
  operations: RenameOperation[];
  directory: string;
  /** Rollback information for each operation */
  rollbackInfo?: RollbackInfo[];
}

/**
 * Rollback information for tracking original states
 */
interface RollbackInfo {
  sourcePath: string;
  targetPath: string;
  success: boolean;
  conflictAction?: 'skipped' | 'overwritten' | 'renamed' | 'backed-up';
  backupPath?: string;
}

/** In-memory history cache */
const renameHistory: RenameHistoryEntry[] = [];
const MAX_HISTORY_SIZE = 50;

/** History file path */
const HISTORY_DIR = path.join(os.homedir(), '.devtoolbox');
const HISTORY_FILE = path.join(HISTORY_DIR, 'rename-history.json');

/**
 * Load history from persistent storage
 */
async function loadHistory(): Promise<void> {
  try {
    if (existsSync(HISTORY_FILE)) {
      const data = readFileSync(HISTORY_FILE, 'utf-8');
      const loaded = JSON.parse(data) as RenameHistoryEntry[];
      renameHistory.length = 0;
      renameHistory.push(...loaded);
    }
  } catch (error) {
    // If history file is corrupted, start fresh
    console.warn('Warning: Could not load rename history, starting fresh');
    renameHistory.length = 0;
  }
}

/**
 * Save history to persistent storage
 */
function saveHistoryToDisk(): void {
  try {
    // Ensure history directory exists
    if (!existsSync(HISTORY_DIR)) {
      mkdirSync(HISTORY_DIR, { recursive: true });
    }
    writeFileSync(HISTORY_FILE, JSON.stringify(renameHistory, null, 2), 'utf-8');
  } catch (error) {
    // Log but don't fail if we can't save history
    console.warn('Warning: Could not save rename history to disk');
  }
}

/**
 * Initialize history (load from disk)
 */
let historyInitialized = false;
async function ensureHistoryInitialized(): Promise<void> {
  if (!historyInitialized) {
    await loadHistory();
    historyInitialized = true;
  }
}

/**
 * Convert a string to different cases
 */
export function convertCase(text: string, conversionType: CaseConversionType): string {
  switch (conversionType) {
    case 'lower':
      return text.toLowerCase();

    case 'upper':
      return text.toUpperCase();

    case 'camel':
      return toCamelCase(text);

    case 'kebab':
      return toKebabCase(text);

    case 'snake':
      return toSnakeCase(text);

    default:
      return text;
  }
}

/**
 * Convert string to camelCase
 */
function toCamelCase(text: string): string {
  return text
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

/**
 * Convert string to kebab-case
 */
function toKebabCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert string to snake_case
 */
function toSnakeCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(text: string): string {
  return text
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^[a-z]/, (char) => char.toUpperCase());
}

/**
 * Convert string to Title Case
 */
function toTitleCase(text: string): string {
  return text
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}

/**
 * Apply formatting to a value based on the format type
 */
export function applyFormat(value: string, format: TemplateFormat): string {
  switch (format) {
    case 'lower':
      return value.toLowerCase();
    case 'upper':
      return value.toUpperCase();
    case 'camel':
      return toCamelCase(value);
    case 'pascal':
      return toPascalCase(value);
    case 'snake':
      return toSnakeCase(value);
    case 'kebab':
      return toKebabCase(value);
    case 'title':
      return toTitleCase(value);
    default:
      return value;
  }
}

/**
 * Parse template placeholder with optional format
 * Supports: {placeholder}, {placeholder:format}
 */
function parsePlaceholder(placeholder: string): { name: string; format?: TemplateFormat } {
  // Check for format specifier: {name:format}
  const formatMatch = placeholder.match(/^([^:]+):(.+)$/);
  if (formatMatch) {
    const name = formatMatch[1];
    const format = formatMatch[2] as TemplateFormat;
    return { name, format };
  }
  return { name: placeholder };
}

/**
 * Extract available template variables from a filename
 */
async function extractTemplateVariables(filePath: string, index: number, totalFiles: number): Promise<Record<string, string>> {
  const parsed = path.parse(filePath);
  let stats = null;
  try {
    stats = await fs.stat(filePath);
  } catch {
    // File might not exist, use current time
  }
  const now = new Date();

  return {
    // File information
    'name': parsed.name,              // Filename without extension
    'ext': parsed.ext.replace('.', ''), // Extension without dot
    'full': parsed.base,              // Full filename with extension
    'dir': path.basename(path.dirname(filePath)), // Parent directory name

    // Numbering
    'counter': String(index + 1),
    'counter:pad': String(index + 1).padStart(String(totalFiles).length, '0'),
    'index': String(index),

    // Date/time (file modification time or current time)
    'date': stats ? stats.mtime.toISOString().split('T')[0] : now.toISOString().split('T')[0],
    'time': stats ? stats.mtime.toTimeString().split(' ')[0] : now.toTimeString().split(' ')[0],
    'datetime': stats ? stats.mtime.toISOString().replace(/[:.]/g, '').split('T')[0] : now.toISOString().replace(/[:.]/g, '').split('T')[0],
    'year': stats ? String(stats.mtime.getFullYear()) : String(now.getFullYear()),
    'month': stats ? String(stats.mtime.getMonth() + 1).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0'),
    'day': stats ? String(stats.mtime.getDate()).padStart(2, '0') : String(now.getDate()).padStart(2, '0'),
    'hour': stats ? String(stats.mtime.getHours()).padStart(2, '0') : String(now.getHours()).padStart(2, '0'),
    'minute': stats ? String(stats.mtime.getMinutes()).padStart(2, '0') : String(now.getMinutes()).padStart(2, '0'),
    'second': stats ? String(stats.mtime.getSeconds()).padStart(2, '0') : String(now.getSeconds()).padStart(2, '0'),

    // Timestamp
    'timestamp': String(stats ? Math.floor(stats.mtime.getTime() / 1000) : Math.floor(Date.now() / 1000)),
    'timestamp:ms': String(stats ? stats.mtime.getTime() : Date.now()),
  };
}

/**
 * Process template string with variables
 */
export async function processTemplate(
  template: string,
  filePath: string,
  index: number,
  totalFiles: number
): Promise<string> {
  // Extract all variables from the file
  const variables = await extractTemplateVariables(filePath, index, totalFiles);

  // Replace all placeholders in the template
  let result = template;

  // Match {placeholder} or {placeholder:format}
  const placeholderRegex = /\{([^}]+)\}/g;
  let match;

  // Use exec in a loop to find all matches
  const matches = [];
  while ((match = placeholderRegex.exec(template)) !== null) {
    matches.push({
      fullMatch: match[0],
      placeholderContent: match[1],
    });
  }

  // Process each match
  for (const { fullMatch, placeholderContent } of matches) {
    const { name, format } = parsePlaceholder(placeholderContent);

    // Get the value
    let value = variables[name];

    // If value not found directly, try to parse as counter:N where N is padding
    if (!value && name.startsWith('counter:')) {
      const padding = parseInt(name.split(':')[1], 10);
      if (!isNaN(padding)) {
        value = String(index + 1).padStart(padding, '0');
      }
    }

    if (value !== undefined) {
      // Apply format if specified
      if (format) {
        value = applyFormat(value, format);
      }

      // Replace the placeholder with the value
      result = result.replace(fullMatch, value);
    }
  }

  return result;
}

/**
 * Validate template syntax
 */
export function validateTemplate(template: string): { valid: boolean; error?: string } {
  try {
    // Check for balanced braces
    let openBraces = 0;
    for (let i = 0; i < template.length; i++) {
      if (template[i] === '{') openBraces++;
      if (template[i] === '}') openBraces--;
      if (openBraces < 0) {
        return { valid: false, error: 'Unmatched closing brace }' };
      }
    }
    if (openBraces > 0) {
      return { valid: false, error: 'Unmatched opening brace {' };
    }

    // Check for empty placeholders
    const emptyPlaceholder = template.match(/\{\s*\}/);
    if (emptyPlaceholder) {
      return { valid: false, error: 'Empty placeholder {}' };
    }

    // Check for valid placeholder names (alphanumeric, underscore, colon)
    const invalidPlaceholder = template.match(/\{([^a-zA-Z_][^}]*\}|[^}]*[^a-zA-Z0-9_:])\}/);
    if (invalidPlaceholder) {
      return { valid: false, error: `Invalid placeholder syntax: ${invalidPlaceholder[0]}` };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid template syntax',
    };
  }
}

/**
 * Parse numbering format
 * Format: "prefix-start,end" or "start,end" or "start,end,step"
 * Examples: "1,100" or "file-1,100" or "1,100,2"
 */
export interface NumberingFormat {
  prefix?: string;
  start: number;
  end: number;
  step?: number;
  padding?: number;
  sortByName?: boolean;
}

export function parseNumberingFormat(format: string): NumberingFormat {
  // Match format: prefix-start,end or start,end or start,end,step
  const match = format.match(/^(.+)?(-)?(\d+),(\d+)(?:,(\d+))?$/);

  if (!match) {
    throw new ValidationError({
      code: 'INVALID_FORMAT',
      message: `Invalid numbering format: ${format}`,
      userMessage: 'Format must be "prefix-start,end" or "start,end" or "start,end,step"',
    });
  }

  const prefix = match[1] ? match[1].replace(/-$/, '') : undefined;
  const start = parseInt(match[3], 10);
  const end = parseInt(match[4], 10);
  const step = match[5] ? parseInt(match[5], 10) : 1;

  if (start < 0 || end < 0) {
    throw new ValidationError({
      code: 'INVALID_RANGE',
      message: `Start and end must be non-negative: ${format}`,
      userMessage: 'Start and end numbers must be 0 or greater',
    });
  }

  if (step <= 0) {
    throw new ValidationError({
      code: 'INVALID_STEP',
      message: `Step must be positive: ${step}`,
      userMessage: 'Step must be a positive number',
    });
  }

  // Calculate padding based on the END value to ensure consistency
  // This ensures that if more files are added later, the numbering remains consistent
  const padding = String(end).length;

  return { prefix, start, end, step, padding };
}

/**
 * Apply sequential numbering to a list of files
 */
export function applyNumbering(files: string[], format: NumberingFormat): string[] {
  const { prefix = '', start, end, step = 1, padding, sortByName = true } = format;

  // Sort files by name if requested (default: true)
  const sortedFiles = sortByName
    ? [...files].sort((a, b) => path.basename(a).localeCompare(path.basename(b)))
    : files;

  return sortedFiles.map((file, index) => {
    const ext = path.extname(file);
    const number = start + index * step;

    if (number > end) {
      throw new ValidationError({
        code: 'NUMBERING_EXCEEDED',
        message: `Numbering range exceeded: ${number} > ${end}`,
        userMessage: `Too many files for numbering range ${start}-${end} with step ${step}`,
      });
    }

    const paddedNumber = String(number).padStart(padding || 0, '0');
    const newBaseName = prefix ? `${prefix}-${paddedNumber}` : paddedNumber;
    return newBaseName + ext;
  });
}

/**
 * Generate new filename based on pattern and replacement
 */
export function generateNewName(
  originalName: string,
  pattern?: string,
  replacement?: string,
  flags?: string
): string {
  if (!pattern) {
    return originalName;
  }

  try {
    const regexFlags = flags || 'g';
    const regex = new RegExp(pattern, regexFlags);
    return originalName.replace(regex, replacement || '');
  } catch (error) {
    throw new ValidationError({
      code: 'INVALID_PATTERN',
      message: `Invalid regex pattern: ${pattern}`,
      userMessage: 'Check your regex pattern syntax',
      cause: error as Error,
    });
  }
}

/**
 * Validate and test a regex pattern before applying it
 */
export function validateRegexPattern(pattern: string, flags: string = ''): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern, flags);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid regex pattern',
    };
  }
}

/**
 * Build regex flags from options
 */
export function buildRegexFlags(options: RegexOptions): string {
  const flags: string[] = [];

  if (options.flags) {
    flags.push(...options.flags.split(''));
  }

  // Add automatic flags based on boolean options
  if (options.caseInsensitive && !flags.includes('i')) {
    flags.push('i');
  }
  if (options.global && !flags.includes('g')) {
    flags.push('g');
  }
  if (options.multiline && !flags.includes('m')) {
    flags.push('m');
  }
  if (options.dotAll && !flags.includes('s')) {
    flags.push('s');
  }

  // Ensure 'g' flag is always present for replacements
  if (!flags.includes('g')) {
    flags.push('g');
  }

  return [...new Set(flags)].join(''); // Remove duplicates
}

/**
 * Apply advanced regex replacement with capture group support
 */
export function applyAdvancedRegexReplacement(
  text: string,
  pattern: string,
  replacement: string,
  flags: string = 'g'
): string {
  try {
    const regex = new RegExp(pattern, flags);
    return text.replace(regex, replacement);
  } catch (error) {
    throw new ValidationError({
      code: 'INVALID_PATTERN',
      message: `Invalid regex pattern: ${pattern}`,
      userMessage: 'Check your regex pattern syntax',
      cause: error as Error,
    });
  }
}

/**
 * Preview regex matches and replacements for a list of filenames
 */
export function previewRegexMatches(
  filenames: string[],
  pattern: string,
  replacement: string,
  flags: string = 'g'
): RegexMatchDetail[] {
  const details: RegexMatchDetail[] = [];

  try {
    const regex = new RegExp(pattern, flags);

    for (const filename of filenames) {
      const match = regex.exec(filename);

      if (match) {
        const groups: Record<string, string> = {};

        // Add numbered groups
        for (let i = 0; i < match.length; i++) {
          groups[`$${i}`] = match[i] || '';
        }

        // Add named groups if present
        if (match.groups) {
          Object.assign(groups, match.groups);
        }

        const newFilename = filename.replace(regex, replacement);

        details.push({
          originalName: filename,
          matched: true,
          groups,
          newFilename,
          matchPattern: match[0],
        });
      } else {
        details.push({
          originalName: filename,
          matched: false,
          groups: {},
          newFilename: filename,
        });
      }

      // Reset regex for next iteration
      regex.lastIndex = 0;
    }
  } catch (error) {
    throw new ValidationError({
      code: 'INVALID_PATTERN',
      message: `Invalid regex pattern: ${pattern}`,
      userMessage: 'Check your regex pattern syntax',
      cause: error as Error,
    });
  }

  return details;
}

/**
 * Extract capture groups from a regex match
 */
export function extractCaptureGroups(
  text: string,
  pattern: string,
  flags: string = ''
): Record<string, string> | null {
  try {
    const regex = new RegExp(pattern, flags);
    const match = regex.exec(text);

    if (!match) {
      return null;
    }

    const groups: Record<string, string> = {};

    // Add numbered groups
    for (let i = 0; i < match.length; i++) {
      groups[`$${i}`] = match[i] || '';
    }

    // Add named groups if present
    if (match.groups) {
      Object.assign(groups, match.groups);
    }

    return groups;
  } catch (error) {
    throw new ValidationError({
      code: 'INVALID_PATTERN',
      message: `Invalid regex pattern: ${pattern}`,
      userMessage: 'Check your regex pattern syntax',
      cause: error as Error,
    });
  }
}

/**
 * Test if a pattern matches any text
 */
export function testRegexPattern(text: string, pattern: string, flags: string = ''): boolean {
  try {
    const regex = new RegExp(pattern, flags);
    return regex.test(text);
  } catch {
    return false;
  }
}

/**
 * Find all matches of a pattern in text
 */
export function findAllRegexMatches(
  text: string,
  pattern: string,
  flags: string = 'g'
): string[] {
  try {
    const regex = new RegExp(pattern, flags);
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push(match[0] || '');

      // Prevent infinite loops with zero-length matches
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }

    return matches;
  } catch (error) {
    throw new ValidationError({
      code: 'INVALID_PATTERN',
      message: `Invalid regex pattern: ${pattern}`,
      userMessage: 'Check your regex pattern syntax',
      cause: error as Error,
    });
  }
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
 * Get all files matching the criteria
 */
async function getFilesToRename(options: RenameOptions): Promise<string[]> {
  const targetDir = options.directory || process.cwd();
  const filter = options.filter || '*';

  // Build ignore patterns from exclude option
  const ignorePatterns = options.exclude || [];

  // Use file discovery to find matching files
  const result = await discoverFiles({
    patterns: filter,
    cwd: targetDir,
    deep: options.depth,
    onlyFiles: true,
    ignore: ignorePatterns.length > 0 ? ignorePatterns : undefined,
    minSize: options.minSize,
    maxSize: options.maxSize,
    filter: async (filepath, stats) => {
      // Apply include pattern filtering
      if (options.include && options.include.length > 0) {
        const { minimatch } = await import('minimatch');
        const isIncluded = options.include.some(pattern => minimatch(filepath, pattern));
        if (!isIncluded) {
          return false;
        }
      }

      // Apply date filtering
      if (options.newer || options.older) {
        const fullPath = path.join(targetDir, filepath);
        try {
          const fileStats = await fs.stat(fullPath);
          const mtime = fileStats.mtime.getTime();

          if (options.newer) {
            const newerTime = parseDateFilter(options.newer);
            if (newerTime !== null && mtime < newerTime) {
              return false;
            }
          }

          if (options.older) {
            const olderTime = parseDateFilter(options.older);
            if (olderTime !== null && mtime > olderTime) {
              return false;
            }
          }
        } catch {
          // If we can't stat the file, exclude it
          return false;
        }
      }

      return true;
    },
  });

  return result.files.map((file) => path.join(targetDir, file));
}

/**
 * Calculate all rename operations
 */
export async function calculateRenameOperations(
  options: RenameOptions
): Promise<RenameOperation[]> {
  const files = await getFilesToRename(options);
  const operations: RenameOperation[] = [];

  // Check if we're doing template-based renaming
  if (options.template) {
    // Validate template first
    const validation = validateTemplate(options.template);
    if (!validation.valid) {
      throw new ValidationError({
        code: 'INVALID_TEMPLATE',
        message: `Invalid template: ${validation.error}`,
        userMessage: validation.error,
      });
    }

    // Sort files if needed (for consistent counter values)
    const sortedFiles = options.sortByName !== false
      ? [...files].sort((a, b) => path.basename(a).localeCompare(path.basename(b)))
      : files;

    for (let i = 0; i < sortedFiles.length; i++) {
      const filePath = sortedFiles[i];
      const originalName = path.basename(filePath);
      const newName = await processTemplate(options.template, filePath, i, sortedFiles.length);

      operations.push({
        sourcePath: filePath,
        originalName,
        newName,
      });
    }
  } else if (options.number) {
    const numberingFormat = parseNumberingFormat(options.number);
    // Pass sortByName option from RenameOptions to NumberingFormat
    numberingFormat.sortByName = options.sortByName !== false;
    const newNames = applyNumbering(files, numberingFormat);

    for (let i = 0; i < files.length; i++) {
      const originalName = path.basename(files[i]);
      const newName = newNames[i];
      operations.push({
        sourcePath: files[i],
        originalName,
        newName,
      });
    }
  } else {
    // Pattern-based renaming or case conversion
    for (const filePath of files) {
      const originalName = path.basename(filePath);
      let newName = originalName;

      // Apply pattern replacement if specified
      if (options.pattern) {
        // Build flags from options
        const regexFlags = buildRegexFlags({
          pattern: options.pattern,
          replacement: options.replacement,
          flags: options.flags,
          caseInsensitive: options.caseInsensitive,
          global: true,
          multiline: options.multiline,
          dotAll: options.dotAll,
        });

        newName = generateNewName(originalName, options.pattern, options.replacement, regexFlags);
      }

      // Apply case conversion if specified
      if (options.case) {
        const nameWithoutExt = path.parse(newName).name;
        const ext = path.parse(newName).ext;
        const convertedName = convertCase(nameWithoutExt, options.case);
        newName = convertedName + ext;
      }

      operations.push({
        sourcePath: filePath,
        originalName,
        newName,
      });
    }
  }

  return operations;
}

/**
 * Options for performing rename operations
 */
export interface PerformRenameOptions {
  /** Preview changes without applying */
  dryRun?: boolean;
  /** Enable parallel processing */
  parallel?: boolean;
  /** Conflict resolution strategy */
  conflictStrategy?: ConflictStrategy;
  /** Rename suffix pattern for conflict resolution (default: '_$n') */
  renameSuffix?: string;
  /** Maximum rename attempts for conflict resolution (default: 100) */
  maxRenameAttempts?: number;
  /** Backup suffix for backup strategy (default: '.bak') */
  backupSuffix?: string;
}

/**
 * Perform rename operations
 */
export async function performRenameOperations(
  operations: RenameOperation[],
  options: PerformRenameOptions = {}
): Promise<RenameResult[]> {
  const {
    dryRun = false,
    parallel = false,
    conflictStrategy,
    renameSuffix = '_$n',
    maxRenameAttempts = 100,
    backupSuffix = '.bak',
  } = options;

  if (parallel && operations.length > 10) {
    return performRenameOperationsParallel(operations, options);
  }

  // Create conflict resolver if strategy is specified
  const conflictResolver = conflictStrategy
    ? new ConflictResolver({
        strategy: conflictStrategy,
        renameSuffix,
        maxRenameAttempts,
        backupSuffix,
      })
    : null;

  const results: RenameResult[] = [];

  for (const operation of operations) {
    try {
      const sourcePath = operation.sourcePath;
      const dir = path.dirname(sourcePath);
      let targetPath = path.join(dir, operation.newName);

      // Check if source exists
      if (!existsSync(sourcePath)) {
        results.push({
          success: false,
          sourcePath,
          targetPath,
          error: 'Source file not found',
        });
        continue;
      }

      // Check if target already exists (case-sensitive check)
      const targetExists = existsSync(targetPath);
      const isCaseOnlyChange = sourcePath.toLowerCase() === targetPath.toLowerCase() && sourcePath !== targetPath;

      if (targetExists && !isCaseOnlyChange && targetPath !== sourcePath) {
        // Handle conflict with strategy if provided
        if (conflictResolver) {
          const conflictResult = await conflictResolver.handleConflict(
            sourcePath,
            targetPath,
            'move' // Rename is essentially a move operation
          );

          if (conflictResult.action === 'skipped') {
            results.push({
              success: true, // Successfully skipped
              sourcePath,
              targetPath,
              conflictAction: 'skipped',
              conflictReason: conflictResult.reason,
            });
            continue;
          }

          if (conflictResult.action === 'renamed' && conflictResult.finalDestination) {
            // Update target path to the new unique name
            targetPath = conflictResult.finalDestination;
            operation.newName = path.basename(targetPath);
          }

          if (conflictResult.action === 'backed-up') {
            // Proceed with rename after backup was created
            if (!dryRun) {
              await fs.rename(sourcePath, targetPath);
            }
            results.push({
              success: true,
              sourcePath,
              targetPath,
              conflictAction: 'backed-up',
              backupPath: conflictResult.backupPath,
              conflictReason: conflictResult.reason,
            });
            continue;
          }

          if (conflictResult.action === 'overwritten') {
            // Delete existing file first, then rename
            if (!dryRun) {
              await fs.unlink(targetPath);
              await fs.rename(sourcePath, targetPath);
            }
            results.push({
              success: true,
              sourcePath,
              targetPath,
              conflictAction: 'overwritten',
              conflictReason: conflictResult.reason,
            });
            continue;
          }
        } else {
          // No conflict strategy - fail with error (original behavior)
          results.push({
            success: false,
            sourcePath,
            targetPath,
            error: 'Target file already exists',
          });
          continue;
        }
      }

      // Skip if name hasn't changed
      if (targetPath === sourcePath) {
        results.push({
          success: true,
          sourcePath,
          targetPath,
        });
        continue;
      }

      if (dryRun) {
        // In dry run mode, just record what would happen
        results.push({
          success: true,
          sourcePath,
          targetPath,
        });
      } else {
        // Actually rename the file
        await fs.rename(sourcePath, targetPath);
        results.push({
          success: true,
          sourcePath,
          targetPath,
        });
      }
    } catch (error) {
      results.push({
        success: false,
        sourcePath: operation.sourcePath,
        targetPath: path.join(path.dirname(operation.sourcePath), operation.newName),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Perform rename operations in parallel using worker threads
 * Note: Conflict resolution with strategies is not supported in parallel mode due to race conditions.
 * Parallel mode will fall back to skipping conflicts.
 */
async function performRenameOperationsParallel(
  operations: RenameOperation[],
  options: PerformRenameOptions = {}
): Promise<RenameResult[]> {
  const { dryRun = false, conflictStrategy } = options;

  // Convert operations to parallel tasks
  const tasks: ParallelTask<RenameOperation & { dryRun: boolean; conflictStrategy?: ConflictStrategy }, RenameResult>[] =
    operations.map((op, index) => ({
      id: `rename-op-${index}`,
      input: { ...op, dryRun, conflictStrategy },
      metadata: { index },
    }));

  // Define processor for rename operations
  const processor: TaskProcessor<RenameOperation & { dryRun: boolean; conflictStrategy?: ConflictStrategy }, RenameResult> =
    async (operation) => {
      const sourcePath = operation.sourcePath;
      const dir = path.dirname(sourcePath);
      const targetPath = path.join(dir, operation.newName);

      // Check if source exists
      if (!existsSync(sourcePath)) {
        return {
          success: false,
          sourcePath,
          targetPath,
          error: 'Source file not found',
        };
      }

      // Check if target already exists (case-sensitive check)
      const targetExists = existsSync(targetPath);
      const isCaseOnlyChange =
        sourcePath.toLowerCase() === targetPath.toLowerCase() && sourcePath !== targetPath;

      if (targetExists && !isCaseOnlyChange && targetPath !== sourcePath) {
        // In parallel mode, we can only safely skip conflicts
        // More complex strategies like rename/backup have race conditions
        if (operation.conflictStrategy === ConflictStrategy.SKIP) {
          return {
            success: true,
            sourcePath,
            targetPath,
            conflictAction: 'skipped',
            conflictReason: 'Destination exists, skipping',
          };
        }
        if (operation.conflictStrategy === ConflictStrategy.OVERWRITE) {
          if (!operation.dryRun) {
            await fs.unlink(targetPath);
            await fs.rename(sourcePath, targetPath);
          }
          return {
            success: true,
            sourcePath,
            targetPath,
            conflictAction: 'overwritten',
            conflictReason: 'Overwriting existing file',
          };
        }
        // For other strategies, fall back to error (safer in parallel mode)
        return {
          success: false,
          sourcePath,
          targetPath,
          error: 'Target file already exists (complex conflict strategies not supported in parallel mode)',
        };
      }

      // Skip if name hasn't changed
      if (targetPath === sourcePath) {
        return {
          success: true,
          sourcePath,
          targetPath,
        };
      }

      if (operation.dryRun) {
        // In dry run mode, just record what would happen
        return {
          success: true,
          sourcePath,
          targetPath,
        };
      } else {
        // Actually rename the file
        await fs.rename(sourcePath, targetPath);
        return {
          success: true,
          sourcePath,
          targetPath,
        };
      }
    };

  // Execute in parallel
  const taskResults = await executeParallel(tasks, processor, {
    taskTimeout: 60000, // 60 second timeout per file operation
  });

  // Map task results back to RenameResult
  return taskResults.map((result) => {
    if (result.success && result.output) {
      return result.output;
    }
    // Return error result
    const index = parseInt(result.id.split('-')[2]);
    const op = operations[index];
    return {
      success: false,
      sourcePath: op.sourcePath,
      targetPath: path.join(path.dirname(op.sourcePath), op.newName),
      error: result.error || 'Unknown error',
    };
  });
}

/**
 * Execute rename with options
 */
export async function executeRename(
  options: RenameOptions
): Promise<{ operations: RenameOperation[]; results: RenameResult[] }> {
  // Calculate all operations first
  const operations = await calculateRenameOperations(options);

  // Perform the renames with conflict resolution options
  const results = await performRenameOperations(operations, {
    dryRun: options.dryRun || false,
    parallel: options.parallel || false,
    conflictStrategy: options.conflictStrategy,
    renameSuffix: options.renameSuffix,
    maxRenameAttempts: options.maxRenameAttempts,
    backupSuffix: options.backupSuffix,
  });

  // Save to history if not a dry run
  if (!options.dryRun) {
    await saveToHistory(operations, options.directory || process.cwd(), results);
  }

  return { operations, results };
}

/**
 * Save rename operations to history
 */
async function saveToHistory(
  operations: RenameOperation[],
  directory: string,
  results: RenameResult[]
): Promise<void> {
  await ensureHistoryInitialized();

  const entry: RenameHistoryEntry = {
    timestamp: Date.now(),
    operations,
    directory,
    rollbackInfo: results.map(r => ({
      sourcePath: r.sourcePath,
      targetPath: r.targetPath,
      success: r.success,
      conflictAction: r.conflictAction,
      backupPath: r.backupPath,
    })),
  };

  renameHistory.push(entry);

  // Keep only the last MAX_HISTORY_SIZE entries
  while (renameHistory.length > MAX_HISTORY_SIZE) {
    renameHistory.shift();
  }

  // Persist to disk
  saveHistoryToDisk();
}

/**
 * Undo the last rename operation with enhanced rollback support
 */
export async function undoRename(): Promise<RenameResult[]> {
  await ensureHistoryInitialized();

  if (renameHistory.length === 0) {
    throw new ValidationError({
      code: 'NO_HISTORY',
      message: 'No rename operations to undo',
      userMessage: 'No rename history available',
    });
  }

  const lastEntry = renameHistory.pop()!;

  // Build reverse operations based on rollback info if available
  const reverseOperations: RenameOperation[] = lastEntry.operations.map((op, index) => {
    // Use rollback info to determine the actual current state
    const rollback = lastEntry.rollbackInfo?.[index];

    if (rollback && rollback.success) {
      // The operation was successful, so we need to reverse it
      // Source is where the file is now, target is where it should go back to
      return {
        sourcePath: rollback.targetPath,
        originalName: path.basename(rollback.targetPath),
        newName: path.basename(rollback.sourcePath),
      };
    } else {
      // The operation failed or was skipped, no need to reverse
      return {
        sourcePath: op.sourcePath,
        originalName: op.originalName,
        newName: op.originalName, // No change
      };
    }
  });

  // Perform the rollback with special handling for backed-up files
  const results: RenameResult[] = [];

  for (const operation of reverseOperations) {
    try {
      const sourcePath = operation.sourcePath;
      const targetPath = path.join(path.dirname(sourcePath), operation.newName);

      // Skip if source doesn't exist (may have been deleted or moved)
      if (!existsSync(sourcePath)) {
        results.push({
          success: false,
          sourcePath,
          targetPath,
          error: 'Source file not found (may have been moved or deleted)',
        });
        continue;
      }

      // Skip if source and target are the same (no-op)
      if (sourcePath === targetPath) {
        results.push({
          success: true,
          sourcePath,
          targetPath,
        });
        continue;
      }

      // Check if we need to restore a backup
      const rollbackInfo = lastEntry.rollbackInfo?.find(
        r => r.targetPath === sourcePath
      );

      if (rollbackInfo?.backupPath && existsSync(rollbackInfo.backupPath)) {
        // Restore from backup
        await fs.rename(rollbackInfo.backupPath, targetPath);
        await fs.unlink(sourcePath); // Remove the current file

        results.push({
          success: true,
          sourcePath,
          targetPath,
          conflictAction: 'backed-up',
          backupPath: rollbackInfo.backupPath,
          conflictReason: 'Restored from backup',
        });
      } else {
        // Standard rename
        await fs.rename(sourcePath, targetPath);
        results.push({
          success: true,
          sourcePath,
          targetPath,
        });
      }
    } catch (error) {
      results.push({
        success: false,
        sourcePath: operation.sourcePath,
        targetPath: path.join(path.dirname(operation.sourcePath), operation.newName),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Save updated history (with the entry removed)
  saveHistoryToDisk();

  return results;
}

/**
 * Get rename history size
 */
export async function getHistorySize(): Promise<number> {
  await ensureHistoryInitialized();
  return renameHistory.length;
}

/**
 * Get rename history entries
 */
export async function getHistoryEntries(): Promise<RenameHistoryEntry[]> {
  await ensureHistoryInitialized();
  return [...renameHistory]; // Return a copy
}

/**
 * Clear rename history
 */
export async function clearHistory(): Promise<void> {
  await ensureHistoryInitialized();
  renameHistory.length = 0;
  saveHistoryToDisk();
}

// Re-export conflict resolution utilities for convenience
export {
  ConflictStrategy,
  parseConflictStrategy,
  getAvailableStrategies,
} from './conflictResolver.js';

// Export history-related types
export type { RenameHistoryEntry, RollbackInfo };
