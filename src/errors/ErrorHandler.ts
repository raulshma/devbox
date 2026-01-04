/**
 * Error Handler
 *
 * Central error handling system with logging, formatting, and recovery mechanisms
 */

import chalk from 'chalk';
import { AppError, ErrorCategory, ErrorSeverity, RecoveryStrategy } from './types.js';
import { logger } from '../utils/logger.js';

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Show detailed error information */
  verbose?: boolean;

  /** Log errors to file */
  logErrors?: boolean;

  /** Show stack traces */
  showStackTraces?: boolean;

  /** Enable error recovery prompts */
  enableRecovery?: boolean;

  /** Custom error formatter */
  formatter?: (error: AppError) => string;
}

/**
 * Default error handler configuration
 */
const defaultConfig: ErrorHandlerConfig = {
  verbose: false,
  logErrors: true,
  showStackTraces: false,
  enableRecovery: true,
};

/**
 * Error Handler Class
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Handle an error with appropriate formatting and logging
   */
  public handle(error: Error | AppError): void {
    // Convert to AppError if it's a generic error
    const appError = this.isAppError(error)
      ? error
      : this.wrapError(error);

    // Log the error
    if (this.config.logErrors) {
      this.logError(appError);
    }

    // Display error to user
    this.displayError(appError);
  }

  /**
   * Handle an error and return a formatted string
   */
  public format(error: Error | AppError): string {
    const appError = this.isAppError(error)
      ? error
      : this.wrapError(error);

    // Use custom formatter if provided
    if (this.config.formatter) {
      return this.config.formatter(appError);
    }

    return this.formatError(appError);
  }

  /**
   * Log error to winston logger
   */
  private logError(error: AppError): void {
    const logData = {
      code: error.code,
      category: error.category,
      severity: error.severity,
      context: error.context,
      timestamp: error.timestamp,
      originalError: error.originalError?.message,
    };

    // Log at appropriate level based on severity
    switch (error.severity) {
      case 'critical':
      case 'high':
        logger.error(error.message, logData);
        break;
      case 'medium':
        logger.warn(error.message, logData);
        break;
      default:
        logger.info(error.message, logData);
    }
  }

  /**
   * Display error to user with formatting
   */
  private displayError(error: AppError): void {
    console.error('\n');

    // Error header with icon
    const icon = this.getErrorIcon(error.severity);
    console.error(chalk.red.bold(`${icon} Error`));

    // User-friendly message
    console.error(chalk.white(error.userMessage));
    console.error('');

    // Error code and category
    if (this.config.verbose) {
      console.error(chalk.gray(`Code: ${error.code}`));
      console.error(chalk.gray(`Category: ${error.category}`));
      console.error(chalk.gray(`Severity: ${error.severity}`));
      console.error('');
    }

    // Technical details
    if (error.technical && this.config.verbose) {
      console.error(chalk.yellow('Technical Details:'));
      console.error(chalk.gray(error.technical));
      console.error('');
    }

    // Suggestions
    if (error.suggestions.length > 0) {
      console.error(chalk.cyan('💡 Suggestions:'));
      error.suggestions.forEach((suggestion, index) => {
        console.error(chalk.gray(`  ${index + 1}. ${suggestion}`));
      });
      console.error('');
    }

    // Documentation links
    if (error.documentation && error.documentation.length > 0) {
      console.error(chalk.blue('📚 Documentation:'));
      error.documentation.forEach((link) => {
        console.error(chalk.gray(`  • ${link}`));
      });
      console.error('');
    }

    // Related resources
    if (error.relatedResources && error.relatedResources.length > 0) {
      console.error(chalk.magenta('📎 Related Resources:'));
      error.relatedResources.forEach((resource) => {
        console.error(chalk.gray(`  • ${resource}`));
      });
      console.error('');
    }

    // Stack trace in verbose mode
    if (this.config.showStackTraces && error.stack) {
      console.error(chalk.gray('Stack Trace:'));
      console.error(chalk.gray(error.stack));
      console.error('');
    }

    // Recovery information
    if (error.isRecoverable()) {
      console.error(chalk.green(`🔄 This error can be recovered. Strategy: ${error.recoveryStrategy}`));
    } else {
      console.error(chalk.red('⛔ This error cannot be recovered automatically.'));
    }

    console.error('');
  }

  /**
   * Format error as string
   */
  private formatError(error: AppError): string {
    const parts: string[] = [];

    parts.push(`[${error.code}] ${error.userMessage}`);

    if (error.suggestions.length > 0) {
      parts.push('\nSuggestions:');
      error.suggestions.forEach((s, i) => {
        parts.push(`  ${i + 1}. ${s}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Get error icon based on severity
   */
  private getErrorIcon(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'high':
        return '❌';
      case 'medium':
        return '⚠️';
      default:
        return '⚡';
    }
  }

  /**
   * Check if error is an AppError
   */
  private isAppError(error: Error): error is AppError {
    return error instanceof AppError;
  }

  /**
   * Wrap a generic error in an AppError
   */
  public wrapError(error: Error): AppError {
    // Create a basic AppError without importing CustomErrors to avoid circular dependency
    return new AppError({
      code: 'RUNTIME_ERROR',
      message: error.message,
      userMessage: error.message,
      category: ErrorCategory.RUNTIME,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.RETRY,
      technical: error.stack,
      suggestions: [
        'Check the logs for more details',
        'Try the operation again',
        'Report this issue if it persists',
      ],
      context: {
        originalError: error.name,
      },
      cause: error,
    });
  }

  /**
   * Update configuration
   */
  public configure(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }
}

/**
 * Global error handler instance
 */
export const errorHandler = new ErrorHandler();

/**
 * Convenience function to handle errors
 */
export function handleError(error: Error | AppError): void {
  errorHandler.handle(error);
}

/**
 * Convenience function to format errors
 */
export function formatError(error: Error | AppError): string {
  return errorHandler.format(error);
}

/**
 * Wrap a function with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => ReturnType<T>>(
  fn: T,
  options?: ErrorHandlerConfig
): T {
  return ((...args: unknown[]) => {
    try {
      const result = fn(...args);

      // Handle promises
      if (result instanceof Promise) {
        return result.catch((error) => {
          const handler = options ? new ErrorHandler(options) : errorHandler;
          handler.handle(error);
          throw error; // Re-throw for caller to handle
        });
      }

      return result;
    } catch (error) {
      const handler = options ? new ErrorHandler(options) : errorHandler;
      handler.handle(error as Error);
      throw error; // Re-throw for caller to handle
    }
  }) as T;
}

/**
 * Create a result type for operations that can fail
 */
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Wrap an async function that returns a Result
 */
export async function safeAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const appError = error instanceof AppError
      ? error
      : errorHandler.wrapError(error as Error);
    return { success: false, error: appError };
  }
}

/**
 * Wrap a sync function that returns a Result
 */
export function safe<T>(fn: () => T): Result<T> {
  try {
    const data = fn();
    return { success: true, data };
  } catch (error) {
    const appError = error instanceof AppError
      ? error
      : errorHandler.wrapError(error as Error);
    return { success: false, error: appError };
  }
}
