/**
 * Audit Logger
 * Centralized audit logging utility for tracking all operations
 */

import type {
  AuditLogEntry,
  AuditEventType,
  AuditSeverity,
  CreateAuditLogOptions,
} from './types.js';
import { getSQLiteStorage, initializeSQLiteStorage } from '../storage/sqlite/index.js';

// Track if storage has been initialized
let storageInitialized = false;

/**
 * Audit Logger Class
 */
export class AuditLogger {
  private userId?: string;
  private sessionId?: string;
  private ipAddress?: string;
  private userAgent?: string;

  constructor(context?: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    this.userId = context?.userId;
    this.sessionId = context?.sessionId;
    this.ipAddress = context?.ipAddress;
    this.userAgent = context?.userAgent;
  }

  /**
   * Ensure storage is initialized
   */
  private async ensureStorageInitialized() {
    if (!storageInitialized) {
      try {
        await initializeSQLiteStorage();
        storageInitialized = true;
      } catch (error) {
        // Silently fail - audit logging is optional
        console.error('Failed to initialize audit storage:', error);
      }
    }
  }

  /**
   * Set user context for subsequent log entries
   */
  setContext(context: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): void {
    this.userId = context.userId;
    this.sessionId = context.sessionId;
    this.ipAddress = context.ipAddress;
    this.userAgent = context.userAgent;
  }

  /**
   * Log an audit event
   */
  async log(options: Omit<CreateAuditLogOptions, 'userId' | 'sessionId' | 'ipAddress' | 'userAgent'>): Promise<AuditLogEntry> {
    await this.ensureStorageInitialized();

    try {
      const storage = getSQLiteStorage();

      return storage.createAuditLog({
        ...options,
        userId: this.userId,
        sessionId: this.sessionId,
        ipAddress: this.ipAddress,
        userAgent: this.userAgent,
      });
    } catch (error) {
      // Silently fail - audit logging should not break operations
      console.error('Failed to create audit log:', error);
      throw error;
    }
  }

  /**
   * Log a successful operation
   */
  async logSuccess(
    eventType: AuditEventType,
    action: string,
    target?: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditLogEntry> {
    return this.log({
      eventType,
      severity: 'info',
      action,
      target,
      status: 'success',
      metadata,
    });
  }

  /**
   * Log a failed operation
   */
  async logFailure(
    eventType: AuditEventType,
    action: string,
    errorMessage: string,
    target?: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditLogEntry> {
    return this.log({
      eventType,
      severity: 'error',
      action,
      target,
      status: 'failed',
      errorMessage,
      metadata,
    });
  }

  /**
   * Log a started operation
   */
  async logStart(
    eventType: AuditEventType,
    action: string,
    target?: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditLogEntry> {
    return this.log({
      eventType,
      severity: 'info',
      action,
      target,
      status: 'started',
      metadata,
    });
  }

  /**
   * Log a warning
   */
  async logWarning(
    eventType: AuditEventType,
    action: string,
    errorMessage: string,
    target?: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditLogEntry> {
    return this.log({
      eventType,
      severity: 'warning',
      action,
      target,
      status: 'failed',
      errorMessage,
      metadata,
    });
  }

  /**
   * Log a critical error
   */
  async logCritical(
    eventType: AuditEventType,
    action: string,
    errorMessage: string,
    target?: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditLogEntry> {
    return this.log({
      eventType,
      severity: 'critical',
      action,
      target,
      status: 'failed',
      errorMessage,
      metadata,
    });
  }

  /**
   * Log file encryption operation
   */
  async logFileEncryption(
    action: string,
    target: string,
    resultData?: Record<string, unknown>,
    duration?: number
  ): Promise<AuditLogEntry> {
    return this.log({
      eventType: 'file_encrypt',
      severity: 'info',
      action,
      target,
      status: 'success',
      resultData,
      duration,
    });
  }

  /**
   * Log file decryption operation
   */
  async logFileDecryption(
    action: string,
    target: string,
    resultData?: Record<string, unknown>,
    duration?: number
  ): Promise<AuditLogEntry> {
    return this.log({
      eventType: 'file_decrypt',
      severity: 'info',
      action,
      target,
      status: 'success',
      resultData,
      duration,
    });
  }

  /**
   * Log file operation (copy, move, delete, trash)
   */
  async logFileOperation(
    operation: 'copy' | 'move' | 'delete' | 'trash',
    target: string,
    status: 'success' | 'failed',
    resultData?: Record<string, unknown>,
    errorMessage?: string
  ): Promise<AuditLogEntry> {
    const eventTypeMap: Record<string, 'file_copy' | 'file_move' | 'file_delete'> = {
      copy: 'file_copy',
      move: 'file_move',
      delete: 'file_delete',
      trash: 'file_delete', // Trash is a type of delete operation
    };

    return this.log({
      eventType: eventTypeMap[operation],
      severity: status === 'success' ? 'info' : 'error',
      action: `${operation.toUpperCase()}: ${target}`,
      target,
      status,
      resultData,
      errorMessage,
    });
  }

  /**
   * Log batch operation
   */
  async logBatchOperation(
    action: string,
    resultData: { total: number; successful: number; failed: number; duration?: number },
    target?: string
  ): Promise<AuditLogEntry> {
    const severity = resultData.failed > 0 ? 'warning' : 'info';

    return this.log({
      eventType: 'batch_operation',
      severity,
      action,
      target,
      status: 'success',
      resultData,
      duration: resultData.duration,
    });
  }

  /**
   * Log system startup
   */
  async logSystemStartup(metadata?: Record<string, unknown>): Promise<AuditLogEntry> {
    return this.log({
      eventType: 'system_startup',
      severity: 'info',
      action: 'System started',
      status: 'success',
      metadata,
    });
  }

  /**
   * Log system shutdown
   */
  async logSystemShutdown(metadata?: Record<string, unknown>): Promise<AuditLogEntry> {
    return this.log({
      eventType: 'system_shutdown',
      severity: 'info',
      action: 'System shutdown',
      status: 'success',
      metadata,
    });
  }

  /**
   * Log configuration change
   */
  async logConfigChange(
    action: string,
    changes: Record<string, unknown>,
    target?: string
  ): Promise<AuditLogEntry> {
    return this.log({
      eventType: 'config_change',
      severity: 'warning',
      action,
      target,
      status: 'success',
      changes,
    });
  }

  /**
   * Log API request
   */
  async logApiRequest(
    action: string,
    target: string,
    statusCode?: number,
    resultData?: Record<string, unknown>,
    errorMessage?: string
  ): Promise<AuditLogEntry> {
    const severity = !statusCode || statusCode >= 500 ? 'error' :
                     statusCode >= 400 ? 'warning' : 'info';
    const status = !statusCode ? 'started' :
                   statusCode >= 400 ? 'failed' : 'success';

    return this.log({
      eventType: 'api_request',
      severity,
      action,
      target,
      status,
      statusCode,
      resultData,
      errorMessage,
    });
  }

  /**
   * Log session creation
   */
  async logSessionCreate(sessionId: string, metadata?: Record<string, unknown>): Promise<AuditLogEntry> {
    return this.log({
      eventType: 'session_create',
      severity: 'info',
      action: 'Session created',
      target: sessionId,
      status: 'success',
      metadata: { ...metadata, sessionId },
    });
  }

  /**
   * Log session deletion
   */
  async logSessionDelete(sessionId: string, metadata?: Record<string, unknown>): Promise<AuditLogEntry> {
    return this.log({
      eventType: 'session_delete',
      severity: 'warning',
      action: 'Session deleted',
      target: sessionId,
      status: 'success',
      metadata: { ...metadata, sessionId },
    });
  }

  /**
   * Log permission change
   */
  async logPermissionChange(
    action: string,
    target: string,
    changes: Record<string, unknown>
  ): Promise<AuditLogEntry> {
    return this.log({
      eventType: 'permission_change',
      severity: 'warning',
      action,
      target,
      status: 'success',
      changes,
    });
  }

  /**
   * Log error occurred
   */
  async logError(
    eventType: AuditEventType,
    action: string,
    errorMessage: string,
    target?: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditLogEntry> {
    return this.log({
      eventType,
      severity: 'error',
      action,
      target,
      status: 'failed',
      errorMessage,
      metadata,
    });
  }
}

// Global audit logger instance
let globalAuditLogger: AuditLogger | null = null;

/**
 * Get the global audit logger instance
 */
export function getAuditLogger(context?: {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}): AuditLogger {
  if (!globalAuditLogger) {
    globalAuditLogger = new AuditLogger(context);
  } else if (context) {
    globalAuditLogger.setContext(context);
  }
  return globalAuditLogger;
}

/**
 * Initialize the audit logger with context
 */
export function initializeAuditLogger(context?: {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}): AuditLogger {
  globalAuditLogger = new AuditLogger(context);
  return globalAuditLogger;
}

/**
 * Create a scoped audit logger with specific context
 */
export function createScopedAuditLogger(context: {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}): AuditLogger {
  return new AuditLogger(context);
}
