/**
 * SQLiteStorage Unit Tests
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('SQLiteStorage', () => {
  let testDir: string;
  let storage: any;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `sqlite-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const module = await import('../SQLiteStorage.js');
    storage = new module.SQLiteStorage({
      dbPath: path.join(testDir, `test-${Date.now()}.db`),
    });
    await storage.initialize();
  });

  afterEach(async () => {
    if (storage?.close) {
      await storage.close();
    }
  });

  describe('initialize', () => {
    it('should initialize storage', async () => {
      expect(storage).toBeDefined();
    });

    it('should create database file', async () => {
      // Database file should exist after initialization
      const dbPath = path.join(testDir, 'init-test.db');
      const module = await import('../SQLiteStorage.js');
      const s = new module.SQLiteStorage({ dbPath });
      await s.initialize();
      
      const exists = await fs.access(dbPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      
      await s.close();
    });
  });

  describe('createSession', () => {
    it('should create a new session', () => {
      const session = storage.createSession('test-session-1', { key: 'value' });
      
      expect(session).toBeDefined();
      expect(session.sessionId).toBe('test-session-1');
      expect(session.state.key).toBe('value');
    });

    it('should include metadata', () => {
      const session = storage.createSession(
        'metadata-session',
        { data: 'test' },
        { source: 'unit-test' }
      );
      
      expect(session.metadata).toBeDefined();
      expect(session.metadata.source).toBe('unit-test');
    });

    it('should set timestamps', () => {
      const session = storage.createSession('timestamp-session', {});
      
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getSession', () => {
    it('should get an existing session', () => {
      storage.createSession('get-test', { value: 123 });
      const session = storage.getSession('get-test');
      
      expect(session).toBeDefined();
      expect(session.state.value).toBe(123);
    });

    it('should return null for non-existent session', () => {
      const session = storage.getSession('non-existent');
      expect(session).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should update session state', () => {
      storage.createSession('update-test', { original: true });
      const result = storage.updateSession('update-test', { updated: true });
      
      expect(result).toBe(true);
      
      const session = storage.getSession('update-test');
      expect(session.state.updated).toBe(true);
    });

    it('should return false for non-existent session', () => {
      const result = storage.updateSession('non-existent', {});
      expect(result).toBe(false);
    });
  });

  describe('deleteSession', () => {
    it('should delete an existing session', () => {
      storage.createSession('delete-test', {});
      const result = storage.deleteSession('delete-test');
      
      expect(result).toBe(true);
      expect(storage.getSession('delete-test')).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const result = storage.deleteSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('querySessions', () => {
    beforeEach(() => {
      storage.createSession('query-1', { type: 'a' });
      storage.createSession('query-2', { type: 'b' });
      storage.createSession('query-3', { type: 'a' });
    });

    it('should return all sessions', () => {
      const sessions = storage.querySessions();
      expect(sessions.length).toBeGreaterThanOrEqual(3);
    });

    it('should limit results', () => {
      const sessions = storage.querySessions({ limit: 2 });
      expect(sessions.length).toBe(2);
    });
  });

  describe('addOperation', () => {
    it('should add an operation', () => {
      const op = storage.addOperation(
        'op-session',
        'copy',
        '/source/path',
        'success'
      );
      
      expect(op).toBeDefined();
      expect(op.operationType).toBe('copy');
      expect(op.status).toBe('success');
    });

    it('should include result data', () => {
      const op = storage.addOperation(
        'op-session-2',
        'move',
        '/target',
        'success',
        { moved: true }
      );
      
      expect(op.result.moved).toBe(true);
    });
  });

  describe('getOperation', () => {
    it('should get an existing operation', () => {
      const created = storage.addOperation('get-op', 'delete', '/path', 'pending');
      const retrieved = storage.getOperation(created.operationId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved.operationId).toBe(created.operationId);
    });

    it('should return null for non-existent operation', () => {
      const op = storage.getOperation('non-existent-op-id');
      expect(op).toBeNull();
    });
  });

  describe('updateOperation', () => {
    it('should update operation status', () => {
      const op = storage.addOperation('update-op', 'copy', '/path', 'pending');
      const result = storage.updateOperation(op.operationId, 'success', { completed: true });
      
      expect(result).toBe(true);
      
      const updated = storage.getOperation(op.operationId);
      expect(updated.status).toBe('success');
    });
  });

  describe('queryOperations', () => {
    beforeEach(() => {
      storage.addOperation('query-ops', 'copy', '/a', 'success');
      storage.addOperation('query-ops', 'move', '/b', 'failed');
      storage.addOperation('query-ops', 'delete', '/c', 'success');
    });

    it('should query operations by session', () => {
      const ops = storage.queryOperations({ sessionId: 'query-ops' });
      expect(ops.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by status', () => {
      const ops = storage.queryOperations({ status: 'success' });
      expect(ops.every((op: any) => op.status === 'success')).toBe(true);
    });

    it('should filter by operation type', () => {
      const ops = storage.queryOperations({ operationType: 'copy' });
      expect(ops.every((op: any) => op.operationType === 'copy')).toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('should return storage statistics', () => {
      const stats = storage.getStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalSessions).toBe('number');
      expect(typeof stats.totalOperations).toBe('number');
    });
  });

  describe('cleanup', () => {
    it('should clean up old data', () => {
      const result = storage.cleanup();
      
      expect(result).toBeDefined();
      expect(typeof result.sessionsRemoved).toBe('number');
      expect(typeof result.operationsRemoved).toBe('number');
    });
  });

  describe('createAuditLog', () => {
    it('should create an audit log entry', () => {
      const entry = storage.createAuditLog({
        action: 'FILE_COPY',
        resource: '/source/file.txt',
        outcome: 'success',
      });
      
      expect(entry).toBeDefined();
      expect(entry.action).toBe('FILE_COPY');
      expect(entry.outcome).toBe('success');
    });

    it('should include optional fields', () => {
      const entry = storage.createAuditLog({
        action: 'FILE_DELETE',
        resource: '/path/to/delete',
        outcome: 'success',
        userId: 'test-user',
        details: { reason: 'cleanup' },
      });
      
      expect(entry.userId).toBe('test-user');
      expect(entry.details.reason).toBe('cleanup');
    });
  });

  describe('queryAuditLogs', () => {
    beforeEach(() => {
      storage.createAuditLog({ action: 'FILE_COPY', resource: '/a', outcome: 'success' });
      storage.createAuditLog({ action: 'FILE_MOVE', resource: '/b', outcome: 'failure' });
      storage.createAuditLog({ action: 'FILE_DELETE', resource: '/c', outcome: 'success' });
    });

    it('should query all audit logs', () => {
      const logs = storage.queryAuditLogs();
      expect(logs.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by action', () => {
      const logs = storage.queryAuditLogs({ action: 'FILE_COPY' });
      expect(logs.every((log: any) => log.action === 'FILE_COPY')).toBe(true);
    });

    it('should filter by outcome', () => {
      const logs = storage.queryAuditLogs({ outcome: 'success' });
      expect(logs.every((log: any) => log.outcome === 'success')).toBe(true);
    });
  });

  describe('getAuditStatistics', () => {
    it('should return audit statistics', () => {
      const stats = storage.getAuditStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalEntries).toBe('number');
    });
  });
});
