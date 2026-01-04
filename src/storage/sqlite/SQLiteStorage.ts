/**
 * SQLite Storage Implementation
 * Provides SQLite-based storage for sessions and operation history
 */

import Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  SessionData,
  OperationHistoryEntry,
  SessionQueryOptions,
  OperationHistoryQueryOptions,
  SQLiteStorageOptions,
  StorageStatistics,
} from './types.js';
import type {
  AuditLogEntry,
  AuditLogQueryOptions,
  AuditStatistics,
  CreateAuditLogOptions,
  AuditLogStorageOptions,
} from '../../audit/types.js';

/**
 * SQLite Storage Class
 */
export class SQLiteStorage {
  private db: Database.Database | null = null;
  private options: Required<SQLiteStorageOptions>;
  private auditOptions: Required<AuditLogStorageOptions>;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private auditCleanupTimer: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor(
    options: SQLiteStorageOptions = {},
    auditOptions: AuditLogStorageOptions = {}
  ) {
    this.options = {
      dbPath: options.dbPath ?? '.devtoolbox/sessions.db',
      enableWAL: options.enableWAL ?? true,
      cleanupInterval: options.cleanupInterval ?? 5 * 60 * 1000, // 5 minutes
      sessionExpiration: options.sessionExpiration ?? 24 * 60 * 60 * 1000, // 24 hours
      maxHistoryEntries: options.maxHistoryEntries ?? 10000,
      debug: options.debug ?? false,
    };

    this.auditOptions = {
      retentionPeriod: auditOptions.retentionPeriod ?? 90 * 24 * 60 * 60 * 1000, // 90 days
      maxEntries: auditOptions.maxEntries ?? 100000,
      enableCleanup: auditOptions.enableCleanup ?? true,
      cleanupInterval: auditOptions.cleanupInterval ?? 60 * 60 * 1000, // 1 hour
    };
  }

  /**
   * Initialize the storage
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.options.debug) {
      console.log('[SQLiteStorage] Initializing with options:', this.options);
    }

    // Ensure database directory exists
    const dbDir = path.dirname(this.options.dbPath);
    await fs.mkdir(dbDir, { recursive: true });

    // Open database connection
    this.db = new Database(this.options.dbPath);

    // Enable WAL mode for better concurrency
    if (this.options.enableWAL) {
      this.db.pragma('journal_mode = WAL');
    }

    // Create tables
    this.createTables();

    // Setup cleanup timer
    if (this.options.cleanupInterval > 0) {
      this.setupCleanupTimer();
    }

    // Setup audit cleanup timer
    if (this.auditOptions.enableCleanup && this.auditOptions.cleanupInterval > 0) {
      this.setupAuditCleanupTimer();
    }

    this.isInitialized = true;

    if (this.options.debug) {
      console.log('[SQLiteStorage] Initialization complete');
    }
  }

  /**
   * Create a new session
   */
  createSession(
    sessionId: string,
    stateData: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): SessionData {
    this.ensureInitialized();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.options.sessionExpiration);

    const stmt = this.db!.prepare(`
      INSERT INTO sessions (id, createdAt, updatedAt, metadata, stateData, expiresAt, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sessionId,
      now.toISOString(),
      now.toISOString(),
      JSON.stringify(metadata || {}),
      JSON.stringify(stateData),
      expiresAt.toISOString(),
      1
    );

    if (this.options.debug) {
      console.log('[SQLiteStorage] Created session:', sessionId);
    }

    return {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      metadata: JSON.stringify(metadata || {}),
      stateData: JSON.stringify(stateData),
      expiresAt,
      isActive: true,
    };
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): SessionData | null {
    this.ensureInitialized();

    const stmt = this.db!.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(sessionId) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToSession(row);
  }

  /**
   * Update session state data
   */
  updateSession(
    sessionId: string,
    stateData: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): boolean {
    this.ensureInitialized();

    const now = new Date();
    const stmt = this.db!.prepare(`
      UPDATE sessions
      SET updatedAt = ?, stateData = ?, metadata = COALESCE(?, metadata)
      WHERE id = ?
    `);

    const result = stmt.run(
      now.toISOString(),
      JSON.stringify(stateData),
      metadata ? JSON.stringify(metadata) : null,
      sessionId
    );

    if (this.options.debug && result.changes > 0) {
      console.log('[SQLiteStorage] Updated session:', sessionId);
    }

    return result.changes > 0;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    this.ensureInitialized();

    // Delete associated operations first
    const deleteOps = this.db!.prepare('DELETE FROM operations WHERE sessionId = ?');
    deleteOps.run(sessionId);

    // Delete session
    const stmt = this.db!.prepare('DELETE FROM sessions WHERE id = ?');
    const result = stmt.run(sessionId);

    if (this.options.debug && result.changes > 0) {
      console.log('[SQLiteStorage] Deleted session:', sessionId);
    }

    return result.changes > 0;
  }

  /**
   * Query sessions with filters
   */
  querySessions(options: SessionQueryOptions = {}): SessionData[] {
    this.ensureInitialized();

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.isActive !== undefined) {
      conditions.push('isActive = ?');
      params.push(options.isActive ? 1 : 0);
    }

    if (options.excludeExpired) {
      conditions.push('(expiresAt IS NULL OR expiresAt > datetime("now"))');
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const sortField = options.sortBy ?? 'updatedAt';
    const sortOrder = options.sortOrder ?? 'DESC';

    const sql = `
      SELECT * FROM sessions
      ${whereClause}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const stmt = this.db!.prepare(sql);
    const rows = stmt.all(
      options.limit ?? -1,
      options.offset ?? 0
    ) as any[];

    return rows.map(row => this.mapRowToSession(row));
  }

  /**
   * Add an operation to history
   */
  addOperation(
    sessionId: string,
    operationType: string,
    target: string,
    status: 'pending' | 'success' | 'failed' | 'cancelled',
    resultData?: Record<string, unknown>,
    errorMessage?: string,
    metadata?: Record<string, unknown>
  ): OperationHistoryEntry {
    this.ensureInitialized();

    const now = new Date();
    const id = `${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db!.prepare(`
      INSERT INTO operations (
        id, sessionId, operationType, target, status,
        startedAt, completedAt, resultData, errorMessage, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      sessionId,
      operationType,
      target,
      status,
      now.toISOString(),
      status !== 'pending' ? now.toISOString() : null,
      resultData ? JSON.stringify(resultData) : null,
      errorMessage || null,
      metadata ? JSON.stringify(metadata) : null
    );

    // Check if we need to trim history for this session
    this.trimSessionHistory(sessionId);

    if (this.options.debug) {
      console.log('[SQLiteStorage] Added operation:', id);
    }

    return {
      id,
      sessionId,
      operationType,
      target,
      status,
      startedAt: now,
      completedAt: status !== 'pending' ? now : undefined,
      resultData: resultData ? JSON.stringify(resultData) : undefined,
      errorMessage,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    };
  }

  /**
   * Update an operation status
   */
  updateOperation(
    operationId: string,
    status: 'pending' | 'success' | 'failed' | 'cancelled',
    resultData?: Record<string, unknown>,
    errorMessage?: string
  ): boolean {
    this.ensureInitialized();

    const now = new Date();
    const startedAt = this.getOperation(operationId)?.startedAt ?? now;
    const duration = now.getTime() - new Date(startedAt).getTime();

    const stmt = this.db!.prepare(`
      UPDATE operations
      SET status = ?, completedAt = ?, duration = ?, resultData = ?, errorMessage = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      status,
      now.toISOString(),
      duration,
      resultData ? JSON.stringify(resultData) : null,
      errorMessage || null,
      operationId
    );

    if (this.options.debug && result.changes > 0) {
      console.log('[SQLiteStorage] Updated operation:', operationId);
    }

    return result.changes > 0;
  }

  /**
   * Get an operation by ID
   */
  getOperation(operationId: string): OperationHistoryEntry | null {
    this.ensureInitialized();

    const stmt = this.db!.prepare('SELECT * FROM operations WHERE id = ?');
    const row = stmt.get(operationId) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToOperation(row);
  }

  /**
   * Query operations with filters
   */
  queryOperations(options: OperationHistoryQueryOptions = {}): OperationHistoryEntry[] {
    this.ensureInitialized();

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.sessionId) {
      conditions.push('sessionId = ?');
      params.push(options.sessionId);
    }

    if (options.operationType) {
      conditions.push('operationType = ?');
      params.push(options.operationType);
    }

    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (options.startDate) {
      conditions.push('startedAt >= ?');
      params.push(options.startDate.toISOString());
    }

    if (options.endDate) {
      conditions.push('startedAt <= ?');
      params.push(options.endDate.toISOString());
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const sortField = options.sortBy ?? 'startedAt';
    const sortOrder = options.sortOrder ?? 'DESC';

    const sql = `
      SELECT * FROM operations
      ${whereClause}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const stmt = this.db!.prepare(sql);
    const rows = stmt.all(
      options.limit ?? -1,
      options.offset ?? 0
    ) as any[];

    return rows.map(row => this.mapRowToOperation(row));
  }

  /**
   * Get storage statistics
   */
  getStatistics(): StorageStatistics {
    this.ensureInitialized();

    const sessionStats = this.db!.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as active,
        MIN(createdAt) as oldest,
        MAX(createdAt) as newest
      FROM sessions
    `).get() as any;

    const operationCount = this.db!.prepare(
      'SELECT COUNT(*) as count FROM operations'
    ).get() as any;

    const dbSize = this.db!.prepare(
      'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()'
    ).get() as any;

    return {
      totalSessions: sessionStats.total || 0,
      activeSessions: sessionStats.active || 0,
      totalOperations: operationCount.count || 0,
      dbSize: dbSize.size || 0,
      oldestSession: sessionStats.oldest ? new Date(sessionStats.oldest) : undefined,
      newestSession: sessionStats.newest ? new Date(sessionStats.newest) : undefined,
    };
  }

  /**
   * Clean up expired sessions and old history
   */
  cleanup(): { sessionsRemoved: number; operationsRemoved: number } {
    this.ensureInitialized();

    // Find expired sessions
    const expiredStmt = this.db!.prepare(`
      SELECT id FROM sessions
      WHERE expiresAt IS NOT NULL AND expiresAt < datetime("now")
    `);
    const expiredSessions = expiredStmt.all() as any[];

    let sessionsRemoved = 0;
    let operationsRemoved = 0;

    for (const row of expiredSessions) {
      // Delete operations for expired sessions
      const deleteOps = this.db!.prepare('DELETE FROM operations WHERE sessionId = ?');
      const opsResult = deleteOps.run(row.id);
      operationsRemoved += opsResult.changes;

      // Delete expired session
      const deleteSession = this.db!.prepare('DELETE FROM sessions WHERE id = ?');
      const sessionResult = deleteSession.run(row.id);
      sessionsRemoved += sessionResult.changes;
    }

    if (this.options.debug && (sessionsRemoved > 0 || operationsRemoved > 0)) {
      console.log('[SQLiteStorage] Cleanup removed:', {
        sessions: sessionsRemoved,
        operations: operationsRemoved,
      });
    }

    return { sessionsRemoved, operationsRemoved };
  }

  /**
   * Close the storage
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.auditCleanupTimer) {
      clearInterval(this.auditCleanupTimer);
      this.auditCleanupTimer = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.isInitialized = false;

    if (this.options.debug) {
      console.log('[SQLiteStorage] Closed');
    }
  }

  /**
   * Create database tables
   */
  private createTables(): void {
    // Sessions table
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        stateData TEXT NOT NULL DEFAULT '{}',
        expiresAt TEXT,
        isActive INTEGER NOT NULL DEFAULT 1
      )
    `);

    // Operations table
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS operations (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        operationType TEXT NOT NULL,
        target TEXT NOT NULL,
        status TEXT NOT NULL,
        startedAt TEXT NOT NULL,
        completedAt TEXT,
        duration INTEGER,
        resultData TEXT,
        errorMessage TEXT,
        metadata TEXT,
        FOREIGN KEY (sessionId) REFERENCES sessions (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better query performance
    this.db!.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_updatedAt ON sessions (updatedAt);
      CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions (expiresAt);
      CREATE INDEX IF NOT EXISTS idx_sessions_isActive ON sessions (isActive);
      CREATE INDEX IF NOT EXISTS idx_operations_sessionId ON operations (sessionId);
      CREATE INDEX IF NOT EXISTS idx_operations_startedAt ON operations (startedAt);
      CREATE INDEX IF NOT EXISTS idx_operations_status ON operations (status);
    `);

    // Audit logs table
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        eventType TEXT NOT NULL,
        severity TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        userId TEXT,
        sessionId TEXT,
        ipAddress TEXT,
        userAgent TEXT,
        action TEXT NOT NULL,
        target TEXT,
        status TEXT NOT NULL,
        statusCode INTEGER,
        errorMessage TEXT,
        resultData TEXT,
        changes TEXT,
        metadata TEXT,
        duration INTEGER
      )
    `);

    // Create indexes for audit logs
    this.db!.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs (timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_eventType ON audit_logs (eventType);
      CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs (severity);
      CREATE INDEX IF NOT EXISTS idx_audit_userId ON audit_logs (userId);
      CREATE INDEX IF NOT EXISTS idx_audit_sessionId ON audit_logs (sessionId);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action);
      CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_logs (status);
      CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs (target);
    `);
  }

  /**
   * Setup automatic cleanup timer
   */
  private setupCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  /**
   * Setup automatic audit cleanup timer
   */
  private setupAuditCleanupTimer(): void {
    this.auditCleanupTimer = setInterval(() => {
      this.cleanupAuditLogs();
    }, this.auditOptions.cleanupInterval);
  }

  /**
   * Trim operation history for a session if it exceeds max entries
   */
  private trimSessionHistory(sessionId: string): void {
    const countStmt = this.db!.prepare(
      'SELECT COUNT(*) as count FROM operations WHERE sessionId = ?'
    );
    const result = countStmt.get(sessionId) as any;

    if (result.count > this.options.maxHistoryEntries) {
      const excess = result.count - this.options.maxHistoryEntries;
      const deleteStmt = this.db!.prepare(`
        DELETE FROM operations
        WHERE sessionId = ?
        ORDER BY startedAt ASC
        LIMIT ?
      `);
      deleteStmt.run(sessionId, excess);

      if (this.options.debug) {
        console.log('[SQLiteStorage] Trimmed', excess, 'old operations for session:', sessionId);
      }
    }
  }

  /**
   * Map database row to SessionData
   */
  private mapRowToSession(row: any): SessionData {
    return {
      id: row.id,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      metadata: row.metadata,
      stateData: row.stateData,
      expiresAt: row.expiresAt ? new Date(row.expiresAt) : undefined,
      isActive: row.isActive === 1,
    };
  }

  /**
   * Map database row to OperationHistoryEntry
   */
  private mapRowToOperation(row: any): OperationHistoryEntry {
    return {
      id: row.id,
      sessionId: row.sessionId,
      operationType: row.operationType,
      target: row.target,
      status: row.status,
      startedAt: new Date(row.startedAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
      duration: row.duration,
      resultData: row.resultData,
      errorMessage: row.errorMessage,
      metadata: row.metadata,
    };
  }

  /**
   * Ensure storage is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.db) {
      throw new Error('SQLiteStorage is not initialized. Call initialize() first.');
    }
  }

  // ==================== AUDIT LOG METHODS ====================

  /**
   * Create an audit log entry
   */
  createAuditLog(options: CreateAuditLogOptions): AuditLogEntry {
    this.ensureInitialized();

    const now = new Date();
    const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db!.prepare(`
      INSERT INTO audit_logs (
        id, eventType, severity, timestamp, userId, sessionId,
        ipAddress, userAgent, action, target, status, statusCode,
        errorMessage, resultData, changes, metadata, duration
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      options.eventType,
      options.severity || 'info',
      now.toISOString(),
      options.userId || null,
      options.sessionId || null,
      options.ipAddress || null,
      options.userAgent || null,
      options.action,
      options.target || null,
      options.status || 'started',
      options.statusCode || null,
      options.errorMessage || null,
      options.resultData ? JSON.stringify(options.resultData) : null,
      options.changes ? JSON.stringify(options.changes) : null,
      options.metadata ? JSON.stringify(options.metadata) : null,
      options.duration || null
    );

    // Check if we need to trim audit logs
    this.trimAuditLogs();

    if (this.options.debug) {
      console.log('[SQLiteStorage] Created audit log:', id, options.action);
    }

    return {
      id,
      eventType: options.eventType,
      severity: options.severity || 'info',
      timestamp: now,
      userId: options.userId,
      sessionId: options.sessionId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      action: options.action,
      target: options.target,
      status: options.status || 'started',
      statusCode: options.statusCode,
      errorMessage: options.errorMessage,
      resultData: options.resultData ? JSON.stringify(options.resultData) : undefined,
      changes: options.changes ? JSON.stringify(options.changes) : undefined,
      metadata: options.metadata ? JSON.stringify(options.metadata) : undefined,
      duration: options.duration,
    };
  }

  /**
   * Get an audit log entry by ID
   */
  getAuditLog(auditId: string): AuditLogEntry | null {
    this.ensureInitialized();

    const stmt = this.db!.prepare('SELECT * FROM audit_logs WHERE id = ?');
    const row = stmt.get(auditId) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToAuditLog(row);
  }

  /**
   * Query audit logs with filters
   */
  queryAuditLogs(queryOptions: AuditLogQueryOptions = {}): AuditLogEntry[] {
    this.ensureInitialized();

    const conditions: string[] = [];
    const params: any[] = [];

    // Handle event type filter (single or multiple)
    if (queryOptions.eventType) {
      if (Array.isArray(queryOptions.eventType)) {
        const placeholders = queryOptions.eventType.map(() => '?').join(',');
        conditions.push(`eventType IN (${placeholders})`);
        params.push(...queryOptions.eventType);
      } else {
        conditions.push('eventType = ?');
        params.push(queryOptions.eventType);
      }
    }

    // Handle severity filter (single or multiple)
    if (queryOptions.severity) {
      if (Array.isArray(queryOptions.severity)) {
        const placeholders = queryOptions.severity.map(() => '?').join(',');
        conditions.push(`severity IN (${placeholders})`);
        params.push(...queryOptions.severity);
      } else {
        conditions.push('severity = ?');
        params.push(queryOptions.severity);
      }
    }

    if (queryOptions.userId) {
      conditions.push('userId = ?');
      params.push(queryOptions.userId);
    }

    if (queryOptions.sessionId) {
      conditions.push('sessionId = ?');
      params.push(queryOptions.sessionId);
    }

    if (queryOptions.status) {
      conditions.push('status = ?');
      params.push(queryOptions.status);
    }

    if (queryOptions.action) {
      conditions.push('action LIKE ?');
      params.push(`%${queryOptions.action}%`);
    }

    if (queryOptions.targetPattern) {
      conditions.push('target LIKE ?');
      params.push(queryOptions.targetPattern);
    }

    if (queryOptions.startDate) {
      conditions.push('timestamp >= ?');
      params.push(queryOptions.startDate.toISOString());
    }

    if (queryOptions.endDate) {
      conditions.push('timestamp <= ?');
      params.push(queryOptions.endDate.toISOString());
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const sortField = queryOptions.sortBy ?? 'timestamp';
    const sortOrder = queryOptions.sortOrder ?? 'DESC';

    const sql = `
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const stmt = this.db!.prepare(sql);
    const rows = stmt.all(
      ...params,
      queryOptions.limit ?? -1,
      queryOptions.offset ?? 0
    ) as any[];

    return rows.map(row => this.mapRowToAuditLog(row));
  }

  /**
   * Get audit statistics
   */
  getAuditStatistics(startDate?: Date, endDate?: Date): AuditStatistics {
    this.ensureInitialized();

    const dateCondition = startDate || endDate
      ? `WHERE timestamp >= ? AND timestamp <= ?`
      : '';
    const dateParams = startDate && endDate
      ? [startDate.toISOString(), endDate.toISOString()]
      : [];

    // Total entries
    const totalStmt = this.db!.prepare(
      `SELECT COUNT(*) as count FROM audit_logs ${dateCondition}`
    );
    const totalResult = totalStmt.get(...(dateParams as any)) as any;
    const totalEntries = totalResult.count || 0;

    // Entries by event type
    const byTypeStmt = this.db!.prepare(`
      SELECT eventType, COUNT(*) as count
      FROM audit_logs
      ${dateCondition}
      GROUP BY eventType
    `);
    const byTypeRows = byTypeStmt.all(...(dateParams as any)) as any[];
    const entriesByEventType: Record<string, number> = {};
    byTypeRows.forEach(row => {
      entriesByEventType[row.eventType] = row.count;
    });

    // Entries by severity
    const bySeverityStmt = this.db!.prepare(`
      SELECT severity, COUNT(*) as count
      FROM audit_logs
      ${dateCondition}
      GROUP BY severity
    `);
    const bySeverityRows = bySeverityStmt.all(...(dateParams as any)) as any[];
    const entriesBySeverity: Record<string, number> = {};
    bySeverityRows.forEach(row => {
      entriesBySeverity[row.severity] = row.count;
    });

    // Entries by status
    const byStatusStmt = this.db!.prepare(`
      SELECT status, COUNT(*) as count
      FROM audit_logs
      ${dateCondition}
      GROUP BY status
    `);
    const byStatusRows = byStatusStmt.all(...(dateParams as any)) as any[];
    const entriesByStatus: Record<string, number> = {};
    byStatusRows.forEach(row => {
      entriesByStatus[row.status] = row.count;
    });

    // Operations by user
    const byUserStmt = this.db!.prepare(`
      SELECT userId, COUNT(*) as count
      FROM audit_logs
      ${dateCondition}
      GROUP BY userId
    `);
    const byUserRows = byUserStmt.all(...(dateParams as any)) as any[];
    const operationsByUser: Record<string, number> = {};
    byUserRows.forEach(row => {
      if (row.userId) {
        operationsByUser[row.userId] = row.count;
      }
    });

    // Failed operations
    const failedStmt = this.db!.prepare(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE status = 'failed'
      ${startDate || endDate ? 'AND timestamp >= ? AND timestamp <= ?' : ''}
    `);
    const failedResult = failedStmt.get(...(dateParams as any)) as any;
    const failedOperations = failedResult.count || 0;

    // Average duration
    const avgDurationStmt = this.db!.prepare(`
      SELECT AVG(duration) as avg
      FROM audit_logs
      WHERE duration IS NOT NULL
      ${startDate || endDate ? 'AND timestamp >= ? AND timestamp <= ?' : ''}
    `);
    const avgDurationResult = avgDurationStmt.get(...(dateParams as any)) as any;
    const averageDuration = avgDurationResult.avg || 0;

    // Oldest and newest entries
    const rangeStmt = this.db!.prepare(`
      SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest
      FROM audit_logs
    `);
    const rangeResult = rangeStmt.get() as any;

    return {
      totalEntries,
      entriesByEventType,
      entriesBySeverity,
      entriesByStatus,
      operationsByUser,
      failedOperations,
      averageDuration,
      oldestEntry: rangeResult.oldest ? new Date(rangeResult.oldest) : undefined,
      newestEntry: rangeResult.newest ? new Date(rangeResult.newest) : undefined,
    };
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  cleanupAuditLogs(): { entriesRemoved: number } {
    this.ensureInitialized();

    const cutoffDate = new Date(Date.now() - this.auditOptions.retentionPeriod);

    const stmt = this.db!.prepare(`
      DELETE FROM audit_logs
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());

    if (this.options.debug && result.changes > 0) {
      console.log('[SQLiteStorage] Cleanup removed', result.changes, 'old audit log entries');
    }

    return { entriesRemoved: result.changes };
  }

  /**
   * Trim audit logs if they exceed max entries
   */
  private trimAuditLogs(): void {
    const countStmt = this.db!.prepare('SELECT COUNT(*) as count FROM audit_logs');
    const result = countStmt.get() as any;

    if (result.count > this.auditOptions.maxEntries) {
      const excess = result.count - this.auditOptions.maxEntries;

      const deleteStmt = this.db!.prepare(`
        DELETE FROM audit_logs
        ORDER BY timestamp ASC
        LIMIT ?
      `);
      deleteStmt.run(excess);

      if (this.options.debug) {
        console.log('[SQLiteStorage] Trimmed', excess, 'old audit log entries');
      }
    }
  }

  /**
   * Map database row to AuditLogEntry
   */
  private mapRowToAuditLog(row: any): AuditLogEntry {
    return {
      id: row.id,
      eventType: row.eventType,
      severity: row.severity,
      timestamp: new Date(row.timestamp),
      userId: row.userId,
      sessionId: row.sessionId,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      action: row.action,
      target: row.target,
      status: row.status,
      statusCode: row.statusCode,
      errorMessage: row.errorMessage,
      resultData: row.resultData,
      changes: row.changes,
      metadata: row.metadata,
      duration: row.duration,
    };
  }
}

// Singleton instance
let instance: SQLiteStorage | null = null;

/**
 * Get the singleton storage instance
 */
export function getSQLiteStorage(options?: SQLiteStorageOptions): SQLiteStorage {
  if (!instance) {
    instance = new SQLiteStorage(options);
  }
  return instance;
}

/**
 * Initialize the SQLite storage system
 */
export async function initializeSQLiteStorage(options?: SQLiteStorageOptions): Promise<SQLiteStorage> {
  const storage = getSQLiteStorage(options);
  await storage.initialize();
  return storage;
}
