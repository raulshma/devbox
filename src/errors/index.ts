/**
 * Errors Module
 *
 * Comprehensive error handling system with structured error types,
 * user-friendly messages, and recovery mechanisms
 */

export * from './types.js';
export * from './CustomErrors.js';
export * from './ErrorHandler.js';

// Re-export commonly used items
export {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  type ErrorContext,
  type ErrorDetails,
} from './types.js';

export {
  ValidationError,
  FileNotFoundError,
  FileAccessError,
  ConfigurationError,
  PluginError,
  NetworkError,
  EncryptionError,
  DecryptionError,
  PermissionError,
  ResourceError,
  RuntimeError,
} from './CustomErrors.js';

export {
  ErrorHandler,
  errorHandler,
  handleError,
  formatError,
  withErrorHandling,
  safeAsync,
  safe,
  type Result,
  type ErrorHandlerConfig,
} from './ErrorHandler.js';
