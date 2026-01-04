/**
 * Validation Error Formatter
 *
 * Formats validation errors for user-friendly display
 */

import chalk from 'chalk';
import type { ValidationResult } from './schemas.js';

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.success) {
    return '';
  }

  const lines = [
    chalk.red.bold('\n❌ Validation Error'),
    chalk.red('The following issues were found:\n'),
  ];

  result.errors.forEach((error, index) => {
    lines.push(chalk.red(`  ${index + 1}. ${error}`));
  });

  lines.push('\n' + chalk.yellow('Please fix these issues and try again.\n'));

  return lines.join('\n');
}

/**
 * Print validation errors to console
 */
export function printValidationErrors(result: ValidationResult): void {
  if (result.success) {
    return;
  }

  console.log(formatValidationErrors(result));
}

/**
 * Throw validation error if validation fails
 */
export function assertValid(result: ValidationResult): void {
  if (!result.success) {
    const errorMessage = result.errors.join('; ');
    throw new Error(`Validation failed: ${errorMessage}`);
  }
}
