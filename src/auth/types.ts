/**
 * Authentication System Types
 *
 * Comprehensive authentication and session management types
 */

/**
 * Authentication token types
 */
export type TokenType = 'session' | 'api' | 'refresh' | 'one-time';

/**
 * Authentication methods
 */
export type AuthMethod = 'password' | 'token' | 'keychain' | 'oauth' | 'certificate';

/**
 * User roles
 */
export type UserRole = 'admin' | 'user' | 'guest' | 'service';

/**
 * Authentication status
 */
export type AuthStatus = 'authenticated' | 'unauthenticated' | 'expired' | 'revoked';

/**
 * User account information
 */
export interface UserAccount {
  /** Unique user identifier */
  id: string;
  /** Username */
  username: string;
  /** Email address (optional) */
  email?: string;
  /** User role */
  role: UserRole;
  /** Account creation timestamp */
  createdAt: Date;
  /** Account last updated timestamp */
  updatedAt: Date;
  /** Whether account is active */
  isActive: boolean;
  /** Additional user metadata (JSON string) */
  metadata: string;
}

/**
 * Authentication token
 */
export interface AuthToken {
  /** Unique token identifier */
  id: string;
  /** User ID this token belongs to */
  userId: string;
  /** Token type */
  tokenType: TokenType;
  /** Authentication method used */
  authMethod: AuthMethod;
  /** The actual token value (hashed) */
  tokenHash: string;
  /** Token creation timestamp */
  createdAt: Date;
  /** Token expiration timestamp */
  expiresAt: Date;
  /** Last used timestamp */
  lastUsedAt?: Date;
  /** Whether token is active */
  isActive: boolean;
  /** Associated session ID */
  sessionId?: string;
  /** Token metadata (JSON string) */
  metadata: string;
}

/**
 * Authenticated session with user context
 */
export interface AuthenticatedSession {
  /** Unique session identifier */
  id: string;
  /** User ID */
  userId: string;
  /** Username */
  username: string;
  /** User role */
  role: UserRole;
  /** Session creation timestamp */
  createdAt: Date;
  /** Session last updated timestamp */
  updatedAt: Date;
  /** Session expiration timestamp */
  expiresAt: Date;
  /** Whether session is active */
  isActive: boolean;
  /** Session token */
  token?: string;
  /** Refresh token */
  refreshToken?: string;
  /** IP address when session was created */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Session state data (JSON string) */
  stateData: string;
  /** Session metadata (JSON string) */
  metadata: string;
}

/**
 * Authentication credentials
 */
export interface AuthCredentials {
  /** Authentication method */
  method: AuthMethod;
  /** Username or identifier */
  username?: string;
  /** Password (for password auth) */
  password?: string;
  /** Token (for token auth) */
  token?: string;
  /** Keychain credential name (for keychain auth) */
  keychainName?: string;
  /** API key (for API access) */
  apiKey?: string;
  /** Additional credentials data */
  data?: Record<string, unknown>;
}

/**
 * Authentication result
 */
export interface AuthResult {
  /** Whether authentication was successful */
  success: boolean;
  /** Authenticated session (if successful) */
  session?: AuthenticatedSession;
  /** Authentication token (if generated) */
  token?: string;
  /** Refresh token (if generated) */
  refreshToken?: string;
  /** Error message (if failed) */
  error?: string;
  /** Error code (if failed) */
  errorCode?: string;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  /** Whether token is valid */
  valid: boolean;
  /** User ID (if valid) */
  userId?: string;
  /** Username (if valid) */
  username?: string;
  /** User role (if valid) */
  role?: UserRole;
  /** Session ID (if valid) */
  sessionId?: string;
  /** Token status */
  status: AuthStatus;
  /** Error message (if invalid) */
  error?: string;
}

/**
 * Authentication configuration options
 */
export interface AuthConfigOptions {
  /** Session expiration time in milliseconds (default: 24 hours) */
  sessionExpiration?: number;
  /** Token expiration time in milliseconds (default: 1 hour) */
  tokenExpiration?: number;
  /** Refresh token expiration time in milliseconds (default: 30 days) */
  refreshTokenExpiration?: number;
  /** Maximum active sessions per user (default: 5) */
  maxSessionsPerUser?: number;
  /** Enable token refresh */
  enableTokenRefresh?: boolean;
  /** Enable IP address validation */
  enableIpValidation?: boolean;
  /** Enable user agent validation */
  enableUserAgentValidation?: boolean;
  /** Require password for sensitive operations */
  requirePasswordForSensitiveOps?: boolean;
  /** Password policy */
  passwordPolicy?: PasswordPolicy;
}

/**
 * Password policy settings
 */
export interface PasswordPolicy {
  /** Minimum password length */
  minLength: number;
  /** Require uppercase letters */
  requireUppercase: boolean;
  /** Require lowercase letters */
  requireLowercase: boolean;
  /** Require numbers */
  requireNumbers: boolean;
  /** Require special characters */
  requireSpecialChars: boolean;
  /** Password expiration in milliseconds (0 = no expiration) */
  expirationTime: number;
  /** Prevent password reuse */
  preventReuse: number;
  /** Account lockout after failed attempts */
  lockoutThreshold: number;
  /** Lockout duration in milliseconds */
  lockoutDuration: number;
}

/**
 * Authentication statistics
 */
export interface AuthStatistics {
  /** Total number of users */
  totalUsers: number;
  /** Active users */
  activeUsers: number;
  /** Total sessions */
  totalSessions: number;
  /** Active sessions */
  activeSessions: number;
  /** Total tokens */
  totalTokens: number;
  /** Active tokens */
  activeTokens: number;
  /** Authentication attempts today */
  authAttemptsToday: number;
  /** Successful authentications today */
  successfulAuthToday: number;
  /** Failed authentications today */
  failedAuthToday: number;
}

/**
 * Permission definition
 */
export interface Permission {
  /** Permission identifier */
  id: string;
  /** Permission name */
  name: string;
  /** Permission description */
  description: string;
  /** Resource this permission applies to */
  resource: string;
  /** Actions allowed */
  actions: string[];
  /** Required role */
  requiredRole?: UserRole;
}

/**
 * User session context
 */
export interface SessionContext {
  /** Session ID */
  sessionId: string;
  /** User ID */
  userId: string;
  /** Username */
  username: string;
  /** User role */
  role: UserRole;
  /** User permissions */
  permissions: Permission[];
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Session data */
  sessionData: Record<string, unknown>;
}
