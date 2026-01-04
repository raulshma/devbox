/**
 * Error Types Module
 *
 * Defines structured error types for comprehensive error handling
 */

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  // Input and validation errors
  VALIDATION = 'VALIDATION',
  INVALID_INPUT = 'INVALID_INPUT',

  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ACCESS = 'FILE_ACCESS',
  FILE_SYSTEM = 'FILE_SYSTEM',

  // Network and external service errors
  NETWORK = 'NETWORK',
  API = 'API',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',

  // Configuration and environment errors
  CONFIGURATION = 'CONFIGURATION',
  ENVIRONMENT = 'ENVIRONMENT',

  // Plugin system errors
  PLUGIN = 'PLUGIN',
  PLUGIN_DEPENDENCY = 'PLUGIN_DEPENDENCY',

  // Security and permission errors
  PERMISSION = 'PERMISSION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',

  // Resource and system errors
  RESOURCE = 'RESOURCE',
  SYSTEM = 'SYSTEM',

  // Encryption/decryption errors
  ENCRYPTION = 'ENCRYPTION',
  DECRYPTION = 'DECRYPTION',

  // Generic errors
  RUNTIME = 'RUNTIME',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error recovery strategies
 */
export enum RecoveryStrategy {
  // User can retry the operation
  RETRY = 'retry',

  // User needs to provide different input
  CORRECT_INPUT = 'correct_input',

  // User needs to fix configuration
  FIX_CONFIG = 'fix_config',

  // User needs to install missing dependencies
  INSTALL_DEPENDENCY = 'install_dependency',

  // User needs permissions
  REQUEST_PERMISSION = 'request_permission',

  // Application can recover automatically
  AUTO_RECOVER = 'auto_recover',

  // Cannot recover - must terminate
  TERMINATE = 'terminate',

  // Cannot recover but can continue
  IGNORE = 'ignore',
}

/**
 * Base error context interface
 */
export interface ErrorContext {
  [key: string]: unknown;
}

/**
 * Detailed error information for user display
 */
export interface ErrorDetails {
  /** User-friendly message */
  message: string;

  /** Technical explanation */
  technical?: string;

  /** Suggested actions to resolve the error */
  suggestions: string[];

  /** Documentation links */
  documentation?: string[];

  /** Related files or resources */
  relatedResources?: string[];
}

/**
 * Base class for all application errors
 */
export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly code: string;
  public readonly recoveryStrategy: RecoveryStrategy;
  public readonly context: ErrorContext;
  public readonly userMessage: string;
  public readonly technical?: string;
  public readonly suggestions: string[];
  public readonly documentation?: string[];
  public readonly relatedResources?: string[];
  public readonly timestamp: Date;
  public readonly originalError?: Error;

  constructor(options: {
    code: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    userMessage?: string;
    technical?: string;
    suggestions: string[];
    recoveryStrategy: RecoveryStrategy;
    context?: ErrorContext;
    documentation?: string[];
    relatedResources?: string[];
    cause?: Error;
  }) {
    super(options.message);

    // Set error name for better stack traces
    this.name = this.constructor.name;

    // Error code for programmatic handling
    this.code = options.code;

    // Classification
    this.category = options.category;
    this.severity = options.severity;

    // Recovery information
    this.recoveryStrategy = options.recoveryStrategy;
    this.suggestions = options.suggestions;
    this.userMessage = options.userMessage || options.message;

    // Technical details
    this.technical = options.technical;
    this.context = options.context || {};
    this.documentation = options.documentation;
    this.relatedResources = options.relatedResources;

    // Timestamp
    this.timestamp = new Date();

    // Preserve stack trace and original error
    this.originalError = options.cause;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get a user-friendly representation of the error
   */
  getUserMessage(): string {
    return this.userMessage;
  }

  /**
   * Get detailed error information
   */
  getDetails(): ErrorDetails {
    return {
      message: this.userMessage,
      technical: this.technical,
      suggestions: this.suggestions,
      documentation: this.documentation,
      relatedResources: this.relatedResources,
    };
  }

  /**
   * Check if this error is recoverable
   */
  isRecoverable(): boolean {
    return this.recoveryStrategy !== RecoveryStrategy.TERMINATE;
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      severity: this.severity,
      message: this.message,
      userMessage: this.userMessage,
      technical: this.technical,
      suggestions: this.suggestions,
      recoveryStrategy: this.recoveryStrategy,
      context: this.context,
      documentation: this.documentation,
      relatedResources: this.relatedResources,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      originalError: this.originalError?.message,
    };
  }
}
