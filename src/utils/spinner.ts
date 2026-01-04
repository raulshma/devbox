/**
 * Spinner Utility
 *
 * Provides loading indicators for long-running operations using Ora.
 * Offers a consistent interface for showing progress during async operations.
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { getThemeManager } from './theme/index.js';

/**
 * Spinner options
 */
export interface SpinnerOptions {
  /** Initial text to display */
  text?: string;

  /** Spinner color (default: cyan) */
  color?: 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';

  /** Whether to hide the cursor (default: true) */
  hideCursor?: boolean;

  /** Use stderr (default: false) */
  stderr?: boolean;

  /** Spinner indentation */
  indent?: number;
}

/**
 * Default spinner options
 */
const defaultOptions: SpinnerOptions = {
  text: 'Loading...',
  color: 'cyan',
  hideCursor: true,
  stderr: false,
  indent: 0,
};

/**
 * Create a new spinner instance
 */
export function createSpinner(options: SpinnerOptions = {}): Ora {
  const opts = { ...defaultOptions, ...options };
  const themeManager = getThemeManager();

  return ora({
    text: opts.text,
    color: opts.color,
    hideCursor: opts.hideCursor,
    indent: opts.indent,
  });
}

/**
 * Execute an async function with a spinner
 *
 * @example
 * ```ts
 * const result = await withSpinner(
 *   () => discoverFiles(options),
 *   'Discovering files...',
 *   'Files discovered successfully',
 *   'Failed to discover files'
 * );
 * ```
 */
export async function withSpinner<T>(
  fn: () => Promise<T>,
  loadingText: string,
  successText?: string,
  errorText?: string,
  options?: SpinnerOptions
): Promise<T> {
  const spinner = createSpinner({ text: loadingText, ...options });
  const themeManager = getThemeManager();
  spinner.start();

  try {
    const result = await fn();
    if (successText) {
      spinner.succeed(themeManager.success(successText));
    } else {
      spinner.stop();
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (errorText) {
      spinner.fail(themeManager.error(`${errorText}: ${message}`));
    } else {
      spinner.stop();
    }
    throw error;
  }
}

/**
 * Execute an async function with a spinner that updates text based on progress
 *
 * @example
 * ```ts
 * await withProgressSpinner(
 *   async (spinner) => {
 *     spinner.text = 'Processing step 1...';
 *     await step1();
 *     spinner.text = 'Processing step 2...';
 *     await step2();
 *   },
 *   'Starting process...'
 * );
 * ```
 */
export async function withProgressSpinner<T>(
  fn: (spinner: Ora) => Promise<T>,
  initialText: string,
  options?: SpinnerOptions
): Promise<T> {
  const spinner = createSpinner({ text: initialText, ...options });
  const themeManager = getThemeManager();
  spinner.start();

  try {
    const result = await fn(spinner);
    spinner.stop();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail(themeManager.error(`Error: ${message}`));
    throw error;
  }
}

/**
 * Create a spinner that can be manually controlled
 *
 * @example
 * ```ts
 * const spinner = createManualSpinner('Processing...');
 * spinner.start();
 * // Do some work
 * spinner.text = 'Still processing...';
 * // Do more work
 * spinner.succeed('Done!');
 * ```
 */
export function createManualSpinner(text: string, options?: SpinnerOptions): Ora {
  return createSpinner({ text, ...options });
}

/**
 * Preset spinner configurations for common operations
 */
export const SpinnerPresets = {
  /** For file discovery operations */
  discovery: (text: string = 'Discovering files...'): Ora =>
    createSpinner({ text, color: 'cyan' }),

  /** For file operations (copy, move, delete) */
  fileOps: (text: string = 'Processing files...'): Ora =>
    createSpinner({ text, color: 'yellow' }),

  /** For cleanup operations */
  cleanup: (text: string = 'Cleaning up...'): Ora =>
    createSpinner({ text, color: 'green' }),

  /** For encryption/decryption operations */
  crypto: (text: string = 'Processing...'): Ora =>
    createSpinner({ text, color: 'magenta' }),

  /** For search operations */
  search: (text: string = 'Searching...'): Ora =>
    createSpinner({ text, color: 'blue' }),

  /** For loading/saving operations */
  io: (text: string = 'Loading...'): Ora =>
    createSpinner({ text, color: 'white' }),
};

export default createSpinner;
