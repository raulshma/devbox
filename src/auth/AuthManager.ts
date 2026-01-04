/**
 * Authentication Manager
 *
 * Comprehensive authentication and session management system
 */

import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  AuthCredentials,
  AuthResult,
  AuthToken,
  AuthenticatedSession,
  TokenValidationResult,
  AuthConfigOptions,
  PasswordPolicy,
  AuthStatistics,
  SessionContext,
  TokenType,
  AuthMethod,
  AuthStatus,
  UserRole,
  UserAccount,
} from './types.js';
import { initializeSQLiteStorage } from '../storage/sqlite/index.js';

/**
 * Default authentication configuration
 */
const DEFAULT_AUTH_CONFIG: Required<AuthConfigOptions> = {
  sessionExpiration: 24 * 60 * 60 * 1000, // 24 hours
  tokenExpiration: 60 * 60 * 1000, // 1 hour
  refreshTokenExpiration: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxSessionsPerUser: 5,
  enableTokenRefresh: true,
  enableIpValidation: false,
  enableUserAgentValidation: false,
  requirePasswordForSensitiveOps: true,
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
    expirationTime: 0, // No expiration
    preventReuse: 5,
    lockoutThreshold: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
  },
};

/**
 * Authentication Manager class
 */
export class AuthManager {
  private config: Required<AuthConfigOptions>;
  private storage: Promise<Awaited<ReturnType<typeof initializeSQLiteStorage>>>;
  private tokensCache: Map<string, TokenValidationResult> = new Map();
  private failedAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();

  constructor(config: AuthConfigOptions = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config };
    this.storage = initializeSQLiteStorage();
  }

  /**
   * Initialize authentication system
   */
  async initialize(): Promise<void> {
    await this.storage;
    // Audit logging temporarily disabled for compilation
    console.log('Authentication system initialized');
  }

  /**
   * Authenticate a user with credentials
   */
  async authenticate(credentials: AuthCredentials, context?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthResult> {
    const startTime = Date.now();

    try {
      // Check for account lockout
      const lockoutCheck = this.checkLockout(credentials.username || 'anonymous');
      if (lockoutCheck.locked) {
        return {
          success: false,
          error: 'Account is temporarily locked. Please try again later.',
          errorCode: 'ACCOUNT_LOCKED',
        };
      }

      // Validate credentials based on method
      const validationResult = await this.validateCredentials(credentials);

      if (!validationResult.valid) {
        // Record failed attempt
        this.recordFailedAttempt(credentials.username || 'anonymous');
        return {
          success: false,
          error: validationResult.error,
          errorCode: 'INVALID_CREDENTIALS',
        };
      }

      // Clear failed attempts on successful authentication
      this.clearFailedAttempts(credentials.username || '');

      // Check if user exists, create if not
      const user = await this.getOrCreateUser(validationResult.username!, credentials.method);

      // Create authenticated session
      const session = await this.createAuthenticatedSession(user, context);

      // Generate tokens
      const token = await this.generateToken(session, 'session');
      const refreshToken = this.config.enableTokenRefresh
        ? await this.generateToken(session, 'refresh')
        : undefined;

      // Store tokens in database
      await this.storeToken(session.id, 'session', token, credentials.method);
      if (refreshToken) {
        await this.storeToken(session.id, 'refresh', refreshToken, credentials.method);
      }

      // Update session with tokens
      session.token = token;
      session.refreshToken = refreshToken;

      return {
        success: true,
        session,
        token,
        refreshToken,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Authentication failed due to system error',
        errorCode: 'SYSTEM_ERROR',
      };
    }
  }

  /**
   * Validate a token and return session context
   */
  async validateToken(token: string, context?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<TokenValidationResult> {
    // Check cache first
    const cached = this.tokensCache.get(token);
    if (cached && cached.valid) {
      return cached;
    }

    const storage = await this.storage;

    // For now, we'll decode the JWT-like token
    try {
      const decoded = this.decodeToken(token);
      const session = storage.getSession(decoded.sessionId);

      if (!session) {
        return {
          valid: false,
          status: 'revoked',
          error: 'Session not found',
        };
      }

      const sessionData = JSON.parse(session.stateData);
      const metadata = JSON.parse(session.metadata);

      // Check if session is active
      if (!session.isActive) {
        return {
          valid: false,
          status: 'revoked',
          error: 'Session is inactive',
        };
      }

      // Check if session is expired
      if (session.expiresAt && session.expiresAt < new Date()) {
        return {
          valid: false,
          status: 'expired',
          error: 'Session has expired',
        };
      }

      // Validate IP address if enabled
      if (this.config.enableIpValidation && context?.ipAddress) {
        const sessionIp = metadata.ipAddress;
        if (sessionIp && sessionIp !== context.ipAddress) {
          return {
            valid: false,
            status: 'unauthenticated',
            error: 'IP address mismatch',
          };
        }
      }

      // Validate user agent if enabled
      if (this.config.enableUserAgentValidation && context?.userAgent) {
        const sessionUserAgent = metadata.userAgent;
        if (sessionUserAgent && sessionUserAgent !== context.userAgent) {
          return {
            valid: false,
            status: 'unauthenticated',
            error: 'User agent mismatch',
          };
        }
      }

      const result: TokenValidationResult = {
        valid: true,
        userId: sessionData.userId,
        username: sessionData.username,
        role: sessionData.role as UserRole,
        sessionId: session.id,
        status: 'authenticated',
      };

      // Cache the result
      this.tokensCache.set(token, result);

      return result;
    } catch (error) {
      return {
        valid: false,
        status: 'unauthenticated',
        error: 'Invalid token format',
      };
    }
  }

  /**
   * Refresh an authentication token
   */
  async refreshToken(refreshToken: string, context?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthResult> {
    const validation = await this.validateToken(refreshToken, context);

    if (!validation.valid || validation.status !== 'authenticated') {
      return {
        success: false,
        error: 'Invalid or expired refresh token',
        errorCode: 'INVALID_REFRESH_TOKEN',
      };
    }

    const storage = await this.storage;
    const session = storage.getSession(validation.sessionId!);

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        errorCode: 'SESSION_NOT_FOUND',
      };
    }

    const sessionData = JSON.parse(session.stateData);

    // Generate new tokens
    const newToken = await this.generateToken(
      {
        id: session.id,
        userId: sessionData.userId,
        username: sessionData.username,
        role: sessionData.role as UserRole,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt!,
        isActive: session.isActive,
        stateData: session.stateData,
        metadata: session.metadata,
      },
      'session'
    );

    const newRefreshToken = await this.generateToken(
      {
        id: session.id,
        userId: sessionData.userId,
        username: sessionData.username,
        role: sessionData.role as UserRole,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt!,
        isActive: session.isActive,
        stateData: session.stateData,
        metadata: session.metadata,
      },
      'refresh'
    );

    // Store new tokens
    await this.storeToken(session.id, 'session', newToken, 'token');
    await this.storeToken(session.id, 'refresh', newRefreshToken, 'token');

    return {
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logout and invalidate a session
   */
  async logout(sessionId: string, userId: string): Promise<boolean> {
    const storage = await this.storage;
    const session = storage.getSession(sessionId);

    if (!session) {
      return false;
    }

    const sessionData = JSON.parse(session.stateData);

    // Verify user owns this session
    if (sessionData.userId !== userId) {
      return false;
    }

    // Deactivate session
    storage.updateSession(sessionId, JSON.parse(session.stateData), {
      ...JSON.parse(session.metadata),
      isActive: false,
      loggedOutAt: new Date().toISOString(),
    });

    // Clear token cache
    const tokensToClear: string[] = [];
    this.tokensCache.forEach((value, key) => {
      if (value.sessionId === sessionId) {
        tokensToClear.push(key);
      }
    });
    tokensToClear.forEach(key => this.tokensCache.delete(key));

    return true;
  }

  /**
   * Get session context from token
   */
  async getSessionContext(token: string, context?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<SessionContext | null> {
    const validation = await this.validateToken(token, context);

    if (!validation.valid) {
      return null;
    }

    const storage = await this.storage;
    const session = storage.getSession(validation.sessionId!);

    if (!session) {
      return null;
    }

    const sessionData = JSON.parse(session.stateData);

    return {
      sessionId: session.id,
      userId: validation.userId!,
      username: validation.username!,
      role: validation.role!,
      permissions: [], // TODO: Implement permissions system
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      sessionData: sessionData,
    };
  }

  /**
   * Get authentication statistics
   */
  async getStatistics(): Promise<AuthStatistics> {
    const storage = await this.storage;
    const stats = storage.getStatistics();

    // TODO: Add more detailed auth statistics
    return {
      totalUsers: 0, // TODO: Implement user management
      activeUsers: 0,
      totalSessions: stats.totalSessions,
      activeSessions: stats.activeSessions,
      totalTokens: 0,
      activeTokens: this.tokensCache.size,
      authAttemptsToday: 0,
      successfulAuthToday: 0,
      failedAuthToday: 0,
    };
  }

  /**
   * Validate credentials based on method
   */
  private async validateCredentials(credentials: AuthCredentials): Promise<{
    valid: boolean;
    username?: string;
    error?: string;
  }> {
    switch (credentials.method) {
      case 'password':
        if (!credentials.username || !credentials.password) {
          return { valid: false, error: 'Username and password required' };
        }
        // For now, accept any non-empty password
        // TODO: Implement proper password validation against stored users
        return { valid: true, username: credentials.username };

      case 'token':
        if (!credentials.token) {
          return { valid: false, error: 'Token required' };
        }
        const validation = await this.validateToken(credentials.token);
        if (validation.valid && validation.username) {
          return { valid: true, username: validation.username };
        }
        return { valid: false, error: 'Invalid token' };

      default:
        return { valid: false, error: 'Unsupported authentication method' };
    }
  }

  /**
   * Get or create user account
   */
  private async getOrCreateUser(username: string, method: AuthMethod): Promise<UserAccount> {
    // For now, create a simple user object
    // TODO: Implement proper user management with database storage
    return {
      id: uuidv4(),
      username,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      metadata: JSON.stringify({ authMethod: method }),
    };
  }

  /**
   * Create an authenticated session
   */
  private async createAuthenticatedSession(
    user: UserAccount,
    context?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<AuthenticatedSession> {
    const storage = await this.storage;
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionExpiration);

    const sessionData = {
      userId: user.id,
      username: user.username,
      role: user.role,
      authenticatedAt: now.toISOString(),
    };

    const metadata = {
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      createdAt: now.toISOString(),
    };

    storage.createSession(
      sessionId,
      sessionData,
      metadata
    );

    return {
      id: sessionId,
      userId: user.id,
      username: user.username,
      role: user.role,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      isActive: true,
      stateData: JSON.stringify(sessionData),
      metadata: JSON.stringify(metadata),
    };
  }

  /**
   * Generate an authentication token
   */
  private async generateToken(session: AuthenticatedSession, tokenType: TokenType): Promise<string> {
    const now = Date.now();
    const expirationTime = tokenType === 'refresh'
      ? now + this.config.refreshTokenExpiration
      : now + this.config.tokenExpiration;

    const payload = {
      sessionId: session.id,
      userId: session.userId,
      username: session.username,
      role: session.role,
      type: tokenType,
      iat: now,
      exp: expirationTime,
    };

    // Create a simple JWT-like token
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = crypto
      .createHmac('sha256', 'devtoolbox-secret')
      .update(`${header}.${encodedPayload}`)
      .digest('base64');

    return `${header}.${encodedPayload}.${signature}`;
  }

  /**
   * Decode a token
   */
  private decodeToken(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    return JSON.parse(Buffer.from(parts[1], 'base64').toString());
  }

  /**
   * Hash a token for storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Store a token in the database
   */
  private async storeToken(
    sessionId: string,
    tokenType: TokenType,
    token: string,
    method: string
  ): Promise<void> {
    const storage = await this.storage;
    const tokenHash = this.hashToken(token);

    storage.addOperation(
      sessionId,
      'token_created',
      tokenType,
      'success',
      { tokenHash, tokenType, method },
      undefined,
      { timestamp: new Date().toISOString() }
    );
  }

  /**
   * Check if account is locked out
   */
  private checkLockout(username: string): { locked: boolean; remainingTime?: number } {
    const attempts = this.failedAttempts.get(username);
    if (!attempts) {
      return { locked: false };
    }

    if (attempts.count >= this.config.passwordPolicy.lockoutThreshold) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
      if (timeSinceLastAttempt < this.config.passwordPolicy.lockoutDuration) {
        return {
          locked: true,
          remainingTime: this.config.passwordPolicy.lockoutDuration - timeSinceLastAttempt,
        };
      } else {
        // Lockout period expired, clear attempts
        this.clearFailedAttempts(username);
        return { locked: false };
      }
    }

    return { locked: false };
  }

  /**
   * Record a failed authentication attempt
   */
  private recordFailedAttempt(username: string): void {
    const attempts = this.failedAttempts.get(username) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    this.failedAttempts.set(username, attempts);
  }

  /**
   * Clear failed authentication attempts
   */
  private clearFailedAttempts(username: string): void {
    this.failedAttempts.delete(username);
  }
}

// Global auth manager instance
let authManagerInstance: AuthManager | null = null;

/**
 * Get the global authentication manager instance
 */
export function getAuthManager(config?: AuthConfigOptions): AuthManager {
  if (!authManagerInstance) {
    authManagerInstance = new AuthManager(config);
  }
  return authManagerInstance;
}

/**
 * Initialize the authentication system
 */
export async function initializeAuth(config?: AuthConfigOptions): Promise<AuthManager> {
  const manager = getAuthManager(config);
  await manager.initialize();
  return manager;
}
