/**
 * SQLite Storage Types
 * Types for SQLite-based session and operation history storage
 */

/**
 * Session data stored in SQLite
 */
export interface SessionData {
  /** Unique session identifier */
  id: string;
  /** Session creation timestamp */
  createdAt: Date;
  /** Session last updated timestamp */
  updatedAt: Date;
  /** Session metadata (JSON string) */
  metadata: string;
  /** Session state data (JSON string) */
  stateData: string;
  /** Session expiration timestamp (optional) */
  expiresAt?: Date;
  /** Whether the session is active */
  isActive: boolean;
}

/**
 * Operation history entry stored in SQLite
 */
export interface OperationHistoryEntry {
  /** Unique operation identifier */
  id: string;
  /** Session ID this operation belongs to */
  sessionId: string;
  /** Operation type */
  operationType: string;
  /** Operation target (e.g., file path, key) */
  target: string;
  /** Operation status */
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  /** Operation start timestamp */
  startedAt: Date;
  /** Operation completion timestamp (optional) */
  completedAt?: Date;
  /** Operation duration in milliseconds */
  duration?: number;
  /** Operation result data (JSON string) */
  resultData?: string;
  /** Error message (if failed) */
  errorMessage?: string;
  /** Additional metadata (JSON string) */
  metadata?: string;
}

/**
 * Query options for session retrieval
 */
export interface SessionQueryOptions {
  /** Filter by active status */
  isActive?: boolean;
  /** Filter by expiration (only non-expired) */
  excludeExpired?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort by field (default: updatedAt) */
  sortBy?: 'createdAt' | 'updatedAt';
  /** Sort order (default: DESC) */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Query options for operation history retrieval
 */
export interface OperationHistoryQueryOptions {
  /** Filter by session ID */
  sessionId?: string;
  /** Filter by operation type */
  operationType?: string;
  /** Filter by status */
  status?: string;
  /** Filter by date range start */
  startDate?: Date;
  /** Filter by date range end */
  endDate?: Date;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort by field (default: startedAt) */
  sortBy?: 'startedAt' | 'completedAt' | 'duration';
  /** Sort order (default: DESC) */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * SQLite storage configuration options
 */
export interface SQLiteStorageOptions {
  /** Database file path (default: .devtoolbox/sessions.db) */
  dbPath?: string;
  /** Enable WAL mode for better concurrency (default: true) */
  enableWAL?: boolean;
  /** Session cleanup interval in milliseconds (default: 5 minutes) */
  cleanupInterval?: number;
  /** Session expiration time in milliseconds (default: 24 hours) */
  sessionExpiration?: number;
  /** Maximum operation history entries per session (default: 10000) */
  maxHistoryEntries?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Storage statistics
 */
export interface StorageStatistics {
  /** Total number of sessions */
  totalSessions: number;
  /** Number of active sessions */
  activeSessions: number;
  /** Total number of operations */
  totalOperations: number;
  /** Database file size in bytes */
  dbSize: number;
  /** Oldest session timestamp */
  oldestSession?: Date;
  /** Newest session timestamp */
  newestSession?: Date;
}
