/**
 * Error Handling Examples
 *
 * This file demonstrates how to use the comprehensive error handling system
 */

import {
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
  AppError,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  withErrorHandling,
  safeAsync,
  type Result,
} from './index.js';

/**
 * Example 1: Basic error throwing
 */
export function basicErrorExample() {
  throw new ValidationError({
    code: 'INPUT_VALIDATION_FAILED',
    message: 'Invalid input detected',
    userMessage: 'The provided input is not valid',
    field: 'email',
    value: 'invalid-email',
    suggestions: [
      'Enter a valid email address',
      'Example: user@example.com',
    ],
  });
}

/**
 * Example 2: File operations with error handling
 */
export async function fileOperationExample(filePath: string) {
  // Example: Check if file exists
  const fileExists = await safeAsync(async () => {
    // Simulate file check
    if (filePath !== '/valid/path/to/file.txt') {
      throw new FileNotFoundError({
        code: 'FILE_NOT_FOUND',
        message: `File not found: ${filePath}`,
        path: filePath,
        suggestions: [
          'Check if the file path is correct',
          'Verify the file exists in the specified location',
          'Ensure you have the necessary permissions to access the file',
        ],
      });
    }
    return true;
  });

  if (!fileExists.success) {
    // Handle the error
    console.error('Error:', fileExists.error.getUserMessage());
    console.error('Suggestions:', fileExists.error.suggestions);
    return;
  }

  // Continue with file operation
  console.log('File exists, proceeding...');
}

/**
 * Example 3: Wrapping functions with error handling
 */
export const processFile = withErrorHandling(async (...args: unknown[]) => {
  const filePath = args[0] as string;
  // This function is automatically wrapped with error handling
  console.log(`Processing file: ${filePath}`);

  // Simulate an error
  throw new FileAccessError({
    code: 'FILE_ACCESS_DENIED',
    message: 'Cannot access file',
    userMessage: `You don't have permission to access: ${filePath}`,
    path: filePath,
    operation: 'read',
    suggestions: [
      'Check if you have the necessary permissions',
      'Ensure the file is not in use by another process',
      'Try running with elevated privileges if necessary',
    ],
  });
});

/**
 * Example 4: Plugin error handling
 */
export function loadPluginExample(pluginId: string) {
  throw new PluginError({
    code: 'PLUGIN_LOAD_FAILED',
    message: `Failed to load plugin: ${pluginId}`,
    userMessage: `The plugin '${pluginId}' could not be loaded`,
    pluginId: pluginId,
    pluginName: 'Example Plugin',
    suggestions: [
      'Check if the plugin is properly installed',
      'Verify the plugin dependencies are met',
      'Review the plugin logs for more details',
      'Try reloading the plugin',
    ],
  });
}

/**
 * Example 5: Network error with retry strategy
 */
export async function apiCallExample(url: string) {
  throw new NetworkError({
    code: 'NETWORK_ERROR',
    message: 'Network request failed',
    userMessage: 'Could not connect to the server',
    url: url,
    method: 'GET',
    statusCode: 500,
    suggestions: [
      'Check your internet connection',
      'Verify the URL or endpoint is correct',
      'Try again later as the service might be temporarily unavailable',
    ],
  });
}

/**
 * Example 6: Decryption error
 */
export async function decryptFileExample(encryptedFilePath: string) {
  throw new DecryptionError({
    code: 'DECRYPTION_FAILED',
    message: 'Failed to decrypt file',
    userMessage: 'Could not decrypt the file. The password might be incorrect.',
    algorithm: 'AES-256-GCM',
    suggestions: [
      'Verify the decryption password is correct',
      'Ensure the file was encrypted with a supported algorithm',
      'Make sure you are using the correct decryption method',
      'Check if the encrypted file is corrupted',
    ],
  });
}

/**
 * Example 7: Configuration error
 */
export function validateConfigExample(configKey: string) {
  throw new ConfigurationError({
    code: 'INVALID_CONFIG',
    message: 'Invalid configuration value',
    userMessage: `The configuration '${configKey}' is not valid`,
    configKey: configKey,
    configPath: './config.json',
    suggestions: [
      'Check your configuration file for errors',
      'Ensure all required configuration values are present',
      'Verify the configuration format is correct',
      'Refer to the documentation for valid configuration options',
    ],
  });
}

/**
 * Example 8: Permission error
 */
export function deleteFileExample(filePath: string) {
  throw new PermissionError({
    code: 'PERMISSION_DENIED',
    message: 'Insufficient permissions to delete file',
    userMessage: `You don't have permission to delete: ${filePath}`,
    resource: filePath,
    requiredPermission: 'write',
    suggestions: [
      'Check if you have the necessary permissions',
      'Try running the command with elevated privileges if appropriate',
      'Contact your administrator for access',
      'Ensure you are logged in with the correct account',
    ],
  });
}

/**
 * Example 9: Using Result type for error handling
 */
export async function readFileResult(filePath: string): Promise<Result<string>> {
  // Simulate file reading with Result type
  if (filePath.includes('invalid')) {
    return {
      success: false,
      error: new FileNotFoundError({
        code: 'FILE_NOT_FOUND',
        message: `File not found: ${filePath}`,
        path: filePath,
      }),
    };
  }

  return {
    success: true,
    data: 'File content here...',
  };
}

/**
 * Example 10: Usage of Result type
 */
export async function processFileResult(filePath: string) {
  const result = await readFileResult(filePath);

  if (!result.success) {
    console.error('Failed to read file:', result.error.getUserMessage());
    console.error('Suggestions:', result.error.suggestions);
    return;
  }

  // Process the file content
  console.log('File content:', result.data);
}

/**
 * Example 11: Custom error with all options
 */
export function comprehensiveErrorExample() {
  throw new AppError({
    code: 'CUSTOM_ERROR',
    category: ErrorCategory.RUNTIME,
    severity: ErrorSeverity.MEDIUM,
    message: 'A custom runtime error occurred',
    userMessage: 'Something went wrong during execution',
    technical: 'Detailed technical explanation for developers',
    suggestions: [
      'Try the operation again',
      'Check the logs for more details',
      'Report this issue if it persists',
    ],
    recoveryStrategy: RecoveryStrategy.RETRY,
    context: {
      operation: 'data-processing',
      userId: 'user-123',
      timestamp: new Date().toISOString(),
    },
    documentation: [
      'https://docs.example.com/errors/custom-error',
      'https://docs.example.com/troubleshooting',
    ],
    relatedResources: [
      'Log file: /var/log/app.log',
      'Config file: /etc/app/config.json',
    ],
  });
}

/**
 * Example 12: Error with recovery strategy
 */
export function recoverableErrorExample() {
  const error = new ValidationError({
    code: 'VALIDATION_ERROR',
    message: 'Input validation failed',
    userMessage: 'Please check your input and try again',
    suggestions: [
      'Fix the validation errors',
      'Try again with correct input',
    ],
  });

  // Check if error is recoverable
  if (error.isRecoverable()) {
    console.log(`This error can be recovered. Strategy: ${error.recoveryStrategy}`);
  }

  throw error;
}
