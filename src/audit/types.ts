/**
 * Audit Log Types
 * Types for comprehensive audit logging system
 */

/**
 * Audit log entry types
 */
export type AuditEventType =
  | 'user_login'
  | 'user_logout'
  | 'session_create'
  | 'session_delete'
  | 'session_update'
  | 'file_encrypt'
  | 'file_decrypt'
  | 'file_copy'
  | 'file_move'
  | 'file_delete'
  | 'file_rename'
  | 'directory_scan'
  | 'node_cleanup'
  | 'dotnet_cleanup'
  | 'config_change'
  | 'api_request'
  | 'api_response'
  | 'error_occurred'
  | 'permission_change'
  | 'batch_operation'
  | 'system_startup'
  | 'system_shutdown'
  | 'custom';

/**
 * Severity levels for audit events
 */
export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  /** Unique audit log identifier */
  id: string;
  /** Event type */
  eventType: AuditEventType;
  /** Event severity */
  severity: AuditSeverity;
  /** Timestamp when event occurred */
  timestamp: Date;
  /** User/session ID who performed the action */
  userId?: string;
  /** Session ID (if applicable) */
  sessionId?: string;
  /** IP address (for API operations) */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Operation/action performed */
  action: string;
  /** Target resource (file path, endpoint, etc.) */
  target?: string;
  /** Operation status */
  status: 'started' | 'success' | 'failed' | 'cancelled';
  /** HTTP status code (for API operations) */
  statusCode?: number;
  /** Error message (if operation failed) */
  errorMessage?: string;
  /** Result data (JSON string) */
  resultData?: string;
  /** Changes made (JSON string) */
  changes?: string;
  /** Additional metadata (JSON string) */
  metadata?: string;
  /** Duration in milliseconds */
  duration?: number;
}

/**
 * Query options for audit log retrieval
 */
export interface AuditLogQueryOptions {
  /** Filter by event type */
  eventType?: AuditEventType | AuditEventType[];
  /** Filter by severity */
  severity?: AuditSeverity | AuditSeverity[];
  /** Filter by user/session ID */
  userId?: string;
  /** Filter by session ID */
  sessionId?: string;
  /** Filter by status */
  status?: string;
  /** Filter by action */
  action?: string;
  /** Filter by target pattern */
  targetPattern?: string;
  /** Filter by date range start */
  startDate?: Date;
  /** Filter by date range end */
  endDate?: Date;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort by field (default: timestamp) */
  sortBy?: 'timestamp' | 'eventType' | 'severity' | 'action' | 'duration';
  /** Sort order (default: DESC) */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Audit statistics
 */
export interface AuditStatistics {
  /** Total number of audit log entries */
  totalEntries: number;
  /** Entries by event type */
  entriesByEventType: Record<string, number>;
  /** Entries by severity */
  entriesBySeverity: Record<string, number>;
  /** Entries by status */
  entriesByStatus: Record<string, number>;
  /** Total operations by user */
  operationsByUser: Record<string, number>;
  /** Failed operations count */
  failedOperations: number;
  /** Average operation duration */
  averageDuration: number;
  /** Oldest entry timestamp */
  oldestEntry?: Date;
  /** Newest entry timestamp */
  newestEntry?: Date;
}

/**
 * Audit log creation options
 */
export interface CreateAuditLogOptions {
  /** Event type */
  eventType: AuditEventType;
  /** Event severity */
  severity?: AuditSeverity;
  /** User/session ID */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Action performed */
  action: string;
  /** Target resource */
  target?: string;
  /** Operation status */
  status?: 'started' | 'success' | 'failed' | 'cancelled';
  /** HTTP status code */
  statusCode?: number;
  /** Error message */
  errorMessage?: string;
  /** Result data */
  resultData?: Record<string, unknown>;
  /** Changes made */
  changes?: Record<string, unknown>;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Duration in milliseconds */
  duration?: number;
}

/**
 * Audit log storage options
 */
export interface AuditLogStorageOptions {
  /** Retention period in milliseconds (default: 90 days) */
  retentionPeriod?: number;
  /** Maximum audit log entries (default: 100000) */
  maxEntries?: number;
  /** Enable automatic cleanup */
  enableCleanup?: boolean;
  /** Cleanup interval in milliseconds (default: 1 hour) */
  cleanupInterval?: number;
}
