/**
 * Custom Error Classes
 *
 * Specific error types for different error scenarios
 */

import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  ErrorContext,
} from './types.js';

/**
 * Validation Error - Input validation failures
 */
export class ValidationError extends AppError {
  constructor(options: {
    code: string;
    message: string;
    userMessage?: string;
    field?: string;
    value?: unknown;
    suggestions?: string[];
    context?: ErrorContext;
    cause?: Error;
  }) {
    super({
      code: options.code,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      message: options.message,
      userMessage: options.userMessage,
      technical: `Validation failed for field${options.field ? ` '${options.field}'` : ''}`,
      suggestions: options.suggestions || [
        'Check the input format and requirements',
        'Review the command help for correct usage',
      ],
      recoveryStrategy: RecoveryStrategy.CORRECT_INPUT,
      context: {
        ...options.context,
        field: options.field,
        value: options.value,
      },
      cause: options.cause,
    });
  }
}

/**
 * File Not Found Error - File or directory doesn't exist
 */
export class FileNotFoundError extends AppError {
  constructor(options: {
    code: string;
    message: string;
    userMessage?: string;
    path: string;
    suggestions?: string[];
    context?: ErrorContext;
    cause?: Error;
  }) {
    super({
      code: options.code,
      category: ErrorCategory.FILE_NOT_FOUND,
      severity: ErrorSeverity.MEDIUM,
      message: options.message,
      userMessage: options.userMessage || `File not found: ${options.path}`,
      technical: `The system cannot find the file or directory specified: ${options.path}`,
      suggestions: options.suggestions || [
        'Check if the file path is correct',
        'Verify the file exists in the specified location',
        'Ensure you have the necessary permissions to access the file',
      ],
      recoveryStrategy: RecoveryStrategy.CORRECT_INPUT,
      context: {
        ...options.context,
        path: options.path,
      },
      cause: options.cause,
    });
  }
}

/**
 * File Access Error - Permission or access issues
 */
export class FileAccessError extends AppError {
  constructor(options: {
    code: string;
    message: string;
    userMessage?: string;
    path: string;
    operation: string;
    suggestions?: string[];
    context?: ErrorContext;
    cause?: Error;
  }) {
    super({
      code: options.code,
      category: ErrorCategory.FILE_ACCESS,
      severity: ErrorSeverity.HIGH,
      message: options.message,
      userMessage: options.userMessage || `Cannot access file: ${options.path}`,
      technical: `Permission denied or access error while trying to ${options.operation}: ${options.path}`,
      suggestions: options.suggestions || [
        'Check if you have the necessary permissions',
        'Ensure the file is not in use by another process',
        'Verify the file is not read-only if you need to modify it',
        'Try running the command with elevated privileges if necessary',
      ],
      recoveryStrategy: RecoveryStrategy.REQUEST_PERMISSION,
      context: {
        ...options.context,
        path: options.path,
        operation: options.operation,
      },
      cause: options.cause,
    });
  }
}

/**
 * Configuration Error - Invalid or missing configuration
 */
export class ConfigurationError extends AppError {
  constructor(options: {
    code: string;
    message: string;
    userMessage?: string;
    configKey?: string;
    configPath?: string;
    suggestions?: string[];
    context?: ErrorContext;
    cause?: Error;
  }) {
    super({
      code: options.code,
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.HIGH,
      message: options.message,
      userMessage: options.userMessage || 'Configuration error detected',
      technical: `Configuration issue${options.configKey ? ` with key '${options.configKey}'` : ''}${options.configPath ? ` in ${options.configPath}` : ''}`,
      suggestions: options.suggestions || [
        'Check your configuration file for errors',
        'Ensure all required configuration values are present',
        'Verify the configuration format is correct',
      ],
      recoveryStrategy: RecoveryStrategy.FIX_CONFIG,
      context: {
        ...options.context,
        configKey: options.configKey,
        configPath: options.configPath,
      },
      cause: options.cause,
    });
  }
}

/**
 * Plugin Error - Plugin-related issues
 */
export class PluginError extends AppError {
  constructor(options: {
    code: string;
    message: string;
    userMessage?: string;
    pluginId: string;
    pluginName?: string;
    suggestions?: string[];
    context?: ErrorContext;
    cause?: Error;
  }) {
    super({
      code: options.code,
      category: ErrorCategory.PLUGIN,
      severity: ErrorSeverity.MEDIUM,
      message: options.message,
      userMessage: options.userMessage || `Plugin error: ${options.pluginName || options.pluginId}`,
      technical: `Plugin system error for plugin '${options.pluginId}'`,
      suggestions: options.suggestions || [
        'Check if the plugin is properly installed',
        'Verify the plugin dependencies are met',
        'Review the plugin logs for more details',
        'Try reloading the plugin',
      ],
      recoveryStrategy: RecoveryStrategy.RETRY,
      context: {
        ...options.context,
        pluginId: options.pluginId,
        pluginName: options.pluginName,
      },
      cause: options.cause,
    });
  }
}

/**
 * Network Error - Network communication failures
 */
export class NetworkError extends AppError {
  constructor(options: {
    code: string;
    message: string;
    userMessage?: string;
    url?: string;
    method?: string;
    statusCode?: number;
    suggestions?: string[];
    context?: ErrorContext;
    cause?: Error;
  }) {
    super({
      code: options.code,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      message: options.message,
      userMessage: options.userMessage || 'Network error occurred',
      technical: `Network request failed${options.url ? ` to ${options.url}` : ''}${options.method ? ` via ${options.method}` : ''}${options.statusCode ? ` with status ${options.statusCode}` : ''}`,
      suggestions: options.suggestions || [
        'Check your internet connection',
        'Verify the URL or endpoint is correct',
        'Try again later as the service might be temporarily unavailable',
        'Check if a firewall or proxy is blocking the connection',
      ],
      recoveryStrategy: RecoveryStrategy.RETRY,
      context: {
        ...options.context,
        url: options.url,
        method: options.method,
        statusCode: options.statusCode,
      },
      cause: options.cause,
    });
  }
}

/**
 * Encryption Error - Encryption operation failures
 */
export class EncryptionError extends AppError {
  constructor(options: {
    code: string;
    message: string;
    userMessage?: string;
    algorithm?: string;
    suggestions?: string[];
    context?: ErrorContext;
    cause?: Error;
  }) {
    super({
      code: options.code,
      category: ErrorCategory.ENCRYPTION,
      severity: ErrorSeverity.HIGH,
      message: options.message,
      userMessage: options.userMessage || 'Encryption operation failed',
      technical: `Encryption error${options.algorithm ? ` using ${options.algorithm}` : ''}`,
      suggestions: options.suggestions || [
        'Verify the password or encryption key is correct',
        'Ensure the file is not corrupted',
        'Check if the encryption algorithm is supported',
        'Make sure you have sufficient disk space',
      ],
      recoveryStrategy: RecoveryStrategy.CORRECT_INPUT,
      context: {
        ...options.context,
        algorithm: options.algorithm,
      },
      cause: options.cause,
    });
  }
}

/**
 * Decryption Error - Decryption operation failures
 */
export class DecryptionError extends AppError {
  constructor(options: {
    code: string;
    message: string;
    userMessage?: string;
    algorithm?: string;
    suggestions?: string[];
    context?: ErrorContext;
    cause?: Error;
  }) {
    super({
      code: options.code,
      category: ErrorCategory.DECRYPTION,
      severity: ErrorSeverity.HIGH,
      message: options.message,
      userMessage: options.userMessage || 'Decryption operation failed',
      technical: `Decryption error${options.algorithm ? ` using ${options.algorithm}` : ''}`,
      suggestions: options.suggestions || [
        'Verify the password or decryption key is correct',
        'Ensure the encrypted file is not corrupted',
        'Check if the file was encrypted with a supported algorithm',
        'Make sure you are using the correct decryption method',
      ],
      recoveryStrategy: RecoveryStrategy.CORRECT_INPUT,
      context: {
        ...options.context,
        algorithm: options.algorithm,
      },
      cause: options.cause,
    });
  }
}

/**
 * Permission Error - Insufficient permissions
 */
export class PermissionError extends AppError {
  constructor(options: {
    code: string;
    message: string;
    userMessage?: string;
    resource?: string;
    requiredPermission?: string;
    suggestions?: string[];
    context?: ErrorContext;
    cause?: Error;
  }) {
    super({
      code: options.code,
      category: ErrorCategory.PERMISSION,
      severity: ErrorSeverity.HIGH,
      message: options.message,
      userMessage: options.userMessage || 'Insufficient permissions to perform this operation',
      technical: `Permission denied${options.resource ? ` for resource '${options.resource}'` : ''}${options.requiredPermission ? ` - requires: ${options.requiredPermission}` : ''}`,
      suggestions: options.suggestions || [
        'Check if you have the necessary permissions',
        'Try running the command with elevated privileges if appropriate',
        'Contact your administrator for access',
        'Ensure you are logged in with the correct account',
      ],
      recoveryStrategy: RecoveryStrategy.REQUEST_PERMISSION,
      context: {
        ...options.context,
        resource: options.resource,
        requiredPermission: options.requiredPermission,
      },
      cause: options.cause,
    });
  }
}

/**
 * Resource Error - Resource exhaustion or unavailability
 */
export class ResourceError extends AppError {
  constructor(options: {
    code: string;
    message: string;
    userMessage?: string;
    resourceType?: string;
    suggestions?: string[];
    context?: ErrorContext;
    cause?: Error;
  }) {
    super({
      code: options.code,
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.HIGH,
      message: options.message,
      userMessage: options.userMessage || 'Resource error - system resources unavailable',
      technical: `Resource error${options.resourceType ? ` for ${options.resourceType}` : ''}`,
      suggestions: options.suggestions || [
        'Close other applications to free up resources',
        'Check available disk space and memory',
        'Try the operation again later',
        'Increase system resource limits if applicable',
      ],
      recoveryStrategy: RecoveryStrategy.RETRY,
      context: {
        ...options.context,
        resourceType: options.resourceType,
      },
      cause: options.cause,
    });
  }
}

/**
 * Runtime Error - General runtime errors
 */
export class RuntimeError extends AppError {
  constructor(options: {
    code: string;
    message: string;
    userMessage?: string;
    suggestions?: string[];
    context?: ErrorContext;
    cause?: Error;
  }) {
    super({
      code: options.code,
      category: ErrorCategory.RUNTIME,
      severity: ErrorSeverity.MEDIUM,
      message: options.message,
      userMessage: options.userMessage || 'An unexpected runtime error occurred',
      technical: 'Runtime error during operation execution',
      suggestions: options.suggestions || [
        'Try the operation again',
        'Check the logs for more details',
        'Report this issue if it persists',
      ],
      recoveryStrategy: RecoveryStrategy.RETRY,
      context: options.context,
      cause: options.cause,
    });
  }
}
