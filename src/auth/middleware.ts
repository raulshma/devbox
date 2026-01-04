/**
 * Authentication Middleware
 *
 * Express middleware for authentication and authorization
 */

import { Request, Response, NextFunction } from 'express';
import { getAuthManager } from './AuthManager.js';
import type { SessionContext, UserRole, AuthMethod } from './types.js';

/**
 * Extend Express Request to include session context
 */
declare global {
  namespace Express {
    interface Request {
      sessionContext?: SessionContext;
    }
  }
}

/**
 * Authentication middleware options
 */
export interface AuthMiddlewareOptions {
  /** Require authentication (default: true) */
  requireAuth?: boolean;
  /** Allowed roles (if not specified, any authenticated user can access) */
  roles?: UserRole[];
  /** Allow API key authentication */
  allowApiKey?: boolean;
  /** Custom authentication header name */
  authHeader?: string;
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  const {
    requireAuth = true,
    roles,
    allowApiKey = true,
    authHeader = 'authorization',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const authManager = getAuthManager();

    try {
      // Extract token from Authorization header
      const authHeaderValue = req.headers[authHeader.toLowerCase()] as string;
      const apiKey = req.headers['x-api-key'] as string;

      let token: string | undefined;

      if (authHeaderValue) {
        // Bearer token format
        if (authHeaderValue.startsWith('Bearer ')) {
          token = authHeaderValue.substring(7);
        } else {
          token = authHeaderValue;
        }
      }

      // Try API key if allowed and no token provided
      if (!token && apiKey && allowApiKey) {
        // Validate API key
        const result = await authManager.authenticate({
          method: 'api' as AuthMethod,
          apiKey,
        });

        if (result.success && result.token) {
          token = result.token;
        }
      }

      // If no token found and auth is required
      if (!token) {
        if (requireAuth) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required. Please provide a valid token or API key.',
            code: 'AUTH_REQUIRED',
          });
        } else {
          return next();
        }
      }

      // Validate token
      const validation = await authManager.validateToken(token, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      if (!validation.valid) {
        return res.status(401).json({
          success: false,
          error: validation.error || 'Invalid or expired token',
          code: 'INVALID_TOKEN',
        });
      }

      // Check role requirements
      if (roles && roles.length > 0) {
        if (!validation.role || !roles.includes(validation.role)) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            requiredRoles: roles,
          });
        }
      }

      // Get session context
      const sessionContext = await authManager.getSessionContext(token, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      if (!sessionContext) {
        return res.status(401).json({
          success: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
      }

      // Attach session context to request
      req.sessionContext = sessionContext;

      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication error',
        code: 'AUTH_ERROR',
      });
    }
  };
}

/**
 * Require authentication middleware
 */
export const requireAuth = createAuthMiddleware({ requireAuth: true });

/**
 * Optional authentication middleware
 */
export const optionalAuth = createAuthMiddleware({ requireAuth: false });

/**
 * Require admin role middleware
 */
export const requireAdmin = createAuthMiddleware({
  requireAuth: true,
  roles: ['admin'],
});

/**
 * Require admin or user role middleware
 */
export const requireUser = createAuthMiddleware({
  requireAuth: true,
  roles: ['admin', 'user'],
});

/**
 * Extract session context from request
 */
export function extractSessionContext(req: Request): SessionContext | null {
  return req.sessionContext || null;
}

/**
 * Check if request has specific role
 */
export function hasRole(req: Request, role: UserRole): boolean {
  return req.sessionContext?.role === role;
}

/**
 * Check if request has any of the specified roles
 */
export function hasAnyRole(req: Request, roles: UserRole[]): boolean {
  return req.sessionContext?.role !== undefined && roles.includes(req.sessionContext.role);
}
