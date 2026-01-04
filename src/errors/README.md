# Error Handling System

A comprehensive error handling system with structured error types, user-friendly messages, and recovery mechanisms.

## Overview

This error handling system provides:
- **Structured error types** for different error scenarios
- **User-friendly error messages** with actionable suggestions
- **Error recovery strategies** to guide users toward solutions
- **Comprehensive error context** for debugging and logging
- **Type-safe error handling** with Result types

## Features

### 1. Error Categories

Errors are classified into categories for better handling:
- `VALIDATION` - Input validation failures
- `FILE_NOT_FOUND` - Missing files or directories
- `FILE_ACCESS` - Permission or access issues
- `CONFIGURATION` - Invalid or missing configuration
- `PLUGIN` - Plugin-related issues
- `NETWORK` - Network communication failures
- `ENCRYPTION` - Encryption operation failures
- `DECRYPTION` - Decryption operation failures
- `PERMISSION` - Insufficient permissions
- `RESOURCE` - Resource exhaustion or unavailability
- `RUNTIME` - General runtime errors

### 2. Error Severity Levels

- `LOW` - Minor issues that don't prevent functionality
- `MEDIUM` - Issues that affect some functionality
- `HIGH` - Major issues that significantly impact functionality
- `CRITICAL` - Severe issues that require immediate attention

### 3. Recovery Strategies

Each error includes a recovery strategy:
- `RETRY` - User can retry the operation
- `CORRECT_INPUT` - User needs to provide different input
- `FIX_CONFIG` - User needs to fix configuration
- `INSTALL_DEPENDENCY` - User needs to install missing dependencies
- `REQUEST_PERMISSION` - User needs permissions
- `AUTO_RECOVER` - Application can recover automatically
- `TERMINATE` - Cannot recover - must terminate
- `IGNORE` - Cannot recover but can continue

## Usage

### Basic Error Throwing

```typescript
import { ValidationError, FileNotFoundError } from './errors/index.js';

// Validation error
throw new ValidationError({
  code: 'INVALID_EMAIL',
  message: 'Invalid email address provided',
  userMessage: 'Please enter a valid email address',
  field: 'email',
  value: 'invalid-email',
  suggestions: [
    'Enter a valid email address',
    'Example: user@example.com',
  ],
});

// File not found error
throw new FileNotFoundError({
  code: 'CONFIG_FILE_NOT_FOUND',
  message: 'Configuration file not found',
  path: './config.json',
  suggestions: [
    'Create a configuration file',
    'Check if the file path is correct',
  ],
});
```

### Wrapping Functions with Error Handling

```typescript
import { withErrorHandling } from './errors/index.js';

const processFile = withErrorHandling(async (filePath: string) => {
  // Any errors thrown here will be automatically handled
  console.log(`Processing: ${filePath}`);
  // ... implementation
});
```

### Using Result Types

```typescript
import { safeAsync, type Result } from './errors/index.js';

async function readFile(filePath: string): Promise<Result<string>> {
  return await safeAsync(async () => {
    // File reading logic
    return 'File content';
  });
}

// Usage
const result = await readFile('./file.txt');

if (!result.success) {
  console.error('Error:', result.error.getUserMessage());
  console.error('Suggestions:', result.error.suggestions);
  return;
}

console.log('Content:', result.data);
```

### Error Context and Metadata

All errors include rich context:

```typescript
throw new PluginError({
  code: 'PLUGIN_LOAD_FAILED',
  message: 'Failed to load plugin',
  userMessage: 'The plugin could not be loaded',
  pluginId: 'my-plugin',
  pluginName: 'My Plugin',
  context: {
    loadTime: Date.now(),
    dependencies: ['dep1', 'dep2'],
  },
  documentation: [
    'https://docs.example.com/plugins',
  ],
  relatedResources: [
    'Plugin manifest: plugins/my-plugin/plugin.json',
  ],
});
```

## Available Error Types

- `ValidationError` - Input validation failures
- `FileNotFoundError` - File or directory doesn't exist
- `FileAccessError` - Permission or access issues
- `ConfigurationError` - Invalid or missing configuration
- `PluginError` - Plugin-related issues
- `NetworkError` - Network communication failures
- `EncryptionError` - Encryption operation failures
- `DecryptionError` - Decryption operation failures
- `PermissionError` - Insufficient permissions
- `ResourceError` - Resource exhaustion or unavailability
- `RuntimeError` - General runtime errors

## Error Display

Errors are automatically formatted with:
- ❌ Error header with severity indicator
- User-friendly message
- Error code and category (in verbose mode)
- Technical details (in verbose mode)
- 💡 Actionable suggestions
- 📚 Documentation links
- 📎 Related resources
- Stack trace (in verbose mode)
- 🔄 Recovery strategy information

## Integration with Commands

Commands can use the error handling system:

```typescript
import { Command } from 'commander';
import { ValidationError, withErrorHandling } from '../errors/index.js';

export const myCommand = new Command('my-command')
  .description('My command description')
  .option('-f, --file <path>', 'Input file')
  .action(withErrorHandling(async (options) => {
    // Validate input
    if (!options.file) {
      throw new ValidationError({
        code: 'MISSING_FILE',
        message: 'File path is required',
        userMessage: 'Please provide a file path using the --file option',
        suggestions: [
          'Use: my-command --file <path>',
          'Check the command help for more options',
        ],
      });
    }

    // Command implementation
    console.log('Processing file:', options.file);
  }));
```

## Error Handler Configuration

The error handler can be configured:

```typescript
import { errorHandler } from './errors/index.js';

errorHandler.configure({
  verbose: true,           // Show detailed error information
  logErrors: true,         // Log errors to file
  showStackTraces: false,  // Show stack traces
  enableRecovery: true,    // Enable error recovery prompts
});
```

## Logging

Errors are automatically logged to the Winston logger with appropriate severity levels:
- Critical/High errors → `error` level
- Medium errors → `warn` level
- Low/Info errors → `info` level

Error logs include:
- Error code and category
- Severity level
- Context metadata
- Timestamp
- Original error (if any)

## Best Practices

1. **Use specific error types** - Choose the most specific error type for your scenario
2. **Provide clear messages** - Write user-friendly messages that explain what went wrong
3. **Include actionable suggestions** - Give users specific steps to resolve the error
4. **Add context** - Include relevant context information for debugging
5. **Set appropriate severity** - Use severity levels to indicate impact
6. **Choose recovery strategy** - Select the strategy that best describes how to recover
7. **Use Result types** - For operations that can fail, use Result types for better error handling
8. **Wrap with error handling** - Use `withErrorHandling` for automatic error handling

## Examples

See `examples.ts` for comprehensive usage examples of all error types and patterns.
