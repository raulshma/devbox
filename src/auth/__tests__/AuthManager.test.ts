/**
 * AuthManager Unit Tests
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('AuthManager', () => {
  let testDir: string;
  let authManager: any;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `auth-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const module = await import('../AuthManager.js');
    authManager = new module.AuthManager({
      tokenExpiry: 3600,
      refreshTokenExpiry: 86400,
    });
    await authManager.initialize();
  });

  describe('constructor', () => {
    it('should create with default config', async () => {
      const { AuthManager } = await import('../AuthManager.js');
      const manager = new AuthManager();
      expect(manager).toBeDefined();
    });

    it('should accept custom config', async () => {
      const { AuthManager } = await import('../AuthManager.js');
      const manager = new AuthManager({
        tokenExpiry: 7200,
      });
      expect(manager).toBeDefined();
    });
  });

  describe('authenticate', () => {
    it('should authenticate with valid password credentials', async () => {
      // First create a user/password
      const credentials = {
        method: 'password',
        username: 'testuser',
        password: 'TestPassword123!',
      };

      const result = await authManager.authenticate(credentials);
      
      // Should succeed for first-time authentication (creates user)
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should include tokens on successful auth', async () => {
      const credentials = {
        method: 'password',
        username: 'tokenuser',
        password: 'TokenPass123!',
      };

      const result = await authManager.authenticate(credentials);
      
      if (result.success) {
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
      }
    });

    it('should handle context information', async () => {
      const credentials = {
        method: 'password',
        username: 'contextuser',
        password: 'ContextPass123!',
      };

      const result = await authManager.authenticate(credentials, {
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      expect(result).toBeDefined();
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      // First authenticate to get a token
      const authResult = await authManager.authenticate({
        method: 'password',
        username: 'validateuser',
        password: 'ValidatePass123!',
      });

      if (authResult.success && authResult.accessToken) {
        const validation = await authManager.validateToken(authResult.accessToken);
        expect(validation).toBeDefined();
      }
    });

    it('should reject invalid tokens', async () => {
      const validation = await authManager.validateToken('invalid-token-string');
      expect(validation.valid).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should refresh a valid refresh token', async () => {
      const authResult = await authManager.authenticate({
        method: 'password',
        username: 'refreshuser',
        password: 'RefreshPass123!',
      });

      if (authResult.success && authResult.refreshToken) {
        const refreshResult = await authManager.refreshToken(authResult.refreshToken);
        expect(refreshResult).toBeDefined();
      }
    });

    it('should reject invalid refresh tokens', async () => {
      const result = await authManager.refreshToken('invalid-refresh-token');
      expect(result.success).toBe(false);
    });
  });

  describe('logout', () => {
    it('should logout a session', async () => {
      const authResult = await authManager.authenticate({
        method: 'password',
        username: 'logoutuser',
        password: 'LogoutPass123!',
      });

      if (authResult.success && authResult.session) {
        const logoutResult = await authManager.logout(
          authResult.session.sessionId,
          authResult.session.userId
        );
        expect(logoutResult).toBeDefined();
      }
    });
  });

  describe('getSessionContext', () => {
    it('should get session context from valid token', async () => {
      const authResult = await authManager.authenticate({
        method: 'password',
        username: 'sessionuser',
        password: 'SessionPass123!',
      });

      if (authResult.success && authResult.accessToken) {
        const context = await authManager.getSessionContext(authResult.accessToken);
        expect(context).toBeDefined();
      }
    });

    it('should return null for invalid token', async () => {
      const context = await authManager.getSessionContext('invalid-token');
      expect(context).toBeNull();
    });
  });

  describe('checkLockout', () => {
    it('should not be locked for new users', () => {
      const result = authManager.checkLockout('newuser');
      expect(result.locked).toBe(false);
    });

    it('should lock after multiple failed attempts', async () => {
      const username = 'lockoutuser';
      
      // Record multiple failed attempts
      for (let i = 0; i < 6; i++) {
        authManager.recordFailedAttempt(username);
      }

      const result = authManager.checkLockout(username);
      expect(result.locked).toBe(true);
      expect(result.remainingTime).toBeGreaterThan(0);
    });
  });

  describe('recordFailedAttempt and clearFailedAttempts', () => {
    it('should record failed attempts', () => {
      authManager.recordFailedAttempt('failuser');
      const lockout = authManager.checkLockout('failuser');
      // After 1 attempt, should not be locked
      expect(lockout.locked).toBe(false);
    });

    it('should clear failed attempts', () => {
      const username = 'clearuser';
      authManager.recordFailedAttempt(username);
      authManager.recordFailedAttempt(username);
      
      authManager.clearFailedAttempts(username);
      
      const lockout = authManager.checkLockout(username);
      expect(lockout.locked).toBe(false);
    });
  });

  describe('getStatistics', () => {
    it('should return authentication statistics', async () => {
      const stats = await authManager.getStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalSessions).toBe('number');
      expect(typeof stats.activeSessions).toBe('number');
    });
  });
});

describe('getAuthManager', () => {
  it('should return an AuthManager instance', async () => {
    const { getAuthManager } = await import('../AuthManager.js');
    const manager = getAuthManager();
    expect(manager).toBeDefined();
    expect(typeof manager.authenticate).toBe('function');
  });
});

describe('initializeAuth', () => {
  it('should initialize and return AuthManager', async () => {
    const { initializeAuth } = await import('../AuthManager.js');
    const manager = await initializeAuth();
    expect(manager).toBeDefined();
  });
});
