/**
 * Role-Based Access Control (RBAC) System
 *
 * Comprehensive permission system for CLI operations
 */

import type { UserRole, Permission } from './types.js';

/**
 * Resource categories for CLI operations
 */
export type ResourceCategory =
  | 'file'
  | 'config'
  | 'auth'
  | 'audit'
  | 'session'
  | 'plugin'
  | 'tool'
  | 'api'
  | 'state'
  | 'keychain'
  | 'theme'
  | 'system';

/**
 * Action types for permissions
 */
export type ActionType =
  | 'read'
  | 'write'
  | 'delete'
  | 'execute'
  | 'admin'
  | 'manage';

/**
 * Permission definition with resource and action
 */
export interface OperationPermission {
  /** Resource category */
  resource: ResourceCategory;
  /** Action type */
  action: ActionType;
  /** Specific operation name (optional, for granular control) */
  operation?: string;
  /** Description of what this permission allows */
  description: string;
}

/**
 * Role permission mapping
 */
export interface RolePermissions {
  /** Role this configuration applies to */
  role: UserRole;
  /** Permissions assigned to this role */
  permissions: OperationPermission[];
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  /** Whether permission is granted */
  granted: boolean;
  /** Reason for denial (if denied) */
  reason?: string;
  /** Required role (if denied) */
  requiredRole?: UserRole;
}

/**
 * Define all available permissions for CLI operations
 */
export const CLI_PERMISSIONS: Record<string, Permission> = {
  // File operations
  'file.read': {
    id: 'file.read',
    name: 'Read Files',
    description: 'Read file contents and metadata',
    resource: 'file',
    actions: ['read'],
    requiredRole: 'guest',
  },
  'file.write': {
    id: 'file.write',
    name: 'Write Files',
    description: 'Create and modify files',
    resource: 'file',
    actions: ['write'],
    requiredRole: 'user',
  },
  'file.delete': {
    id: 'file.delete',
    name: 'Delete Files',
    description: 'Delete files and directories',
    resource: 'file',
    actions: ['delete'],
    requiredRole: 'user',
  },
  'file.admin': {
    id: 'file.admin',
    name: 'File Administration',
    description: 'Advanced file operations including bulk operations',
    resource: 'file',
    actions: ['admin'],
    requiredRole: 'admin',
  },

  // Configuration management
  'config.read': {
    id: 'config.read',
    name: 'Read Configuration',
    description: 'Read application configuration',
    resource: 'config',
    actions: ['read'],
    requiredRole: 'guest',
  },
  'config.write': {
    id: 'config.write',
    name: 'Write Configuration',
    description: 'Modify application configuration',
    resource: 'config',
    actions: ['write'],
    requiredRole: 'admin',
  },
  'config.manage': {
    id: 'config.manage',
    name: 'Manage Configuration',
    description: 'Full configuration management access',
    resource: 'config',
    actions: ['manage'],
    requiredRole: 'admin',
  },

  // Authentication and authorization
  'auth.read': {
    id: 'auth.read',
    name: 'Read Auth Status',
    description: 'View authentication status',
    resource: 'auth',
    actions: ['read'],
    requiredRole: 'guest',
  },
  'auth.login': {
    id: 'auth.login',
    name: 'Login',
    description: 'Authenticate with the system',
    resource: 'auth',
    actions: ['execute'],
    requiredRole: 'guest',
  },
  'auth.manage': {
    id: 'auth.manage',
    name: 'Manage Authentication',
    description: 'Manage users and authentication settings',
    resource: 'auth',
    actions: ['manage'],
    requiredRole: 'admin',
  },

  // Audit logging
  'audit.read': {
    id: 'audit.read',
    name: 'Read Audit Logs',
    description: 'View audit logs',
    resource: 'audit',
    actions: ['read'],
    requiredRole: 'user',
  },
  'audit.write': {
    id: 'audit.write',
    name: 'Write Audit Logs',
    description: 'Write audit log entries',
    resource: 'audit',
    actions: ['write'],
    requiredRole: 'service',
  },
  'audit.manage': {
    id: 'audit.manage',
    name: 'Manage Audit Logs',
    description: 'Manage and configure audit logging',
    resource: 'audit',
    actions: ['manage'],
    requiredRole: 'admin',
  },
  'audit.delete': {
    id: 'audit.delete',
    name: 'Delete Audit Logs',
    description: 'Delete audit log entries',
    resource: 'audit',
    actions: ['delete'],
    requiredRole: 'admin',
  },

  // Session management
  'session.read': {
    id: 'session.read',
    name: 'Read Sessions',
    description: 'View session information',
    resource: 'session',
    actions: ['read'],
    requiredRole: 'user',
  },
  'session.manage': {
    id: 'session.manage',
    name: 'Manage Sessions',
    description: 'Manage user sessions',
    resource: 'session',
    actions: ['manage'],
    requiredRole: 'user',
  },
  'session.delete': {
    id: 'session.delete',
    name: 'Delete Sessions',
    description: 'Delete user sessions',
    resource: 'session',
    actions: ['delete'],
    requiredRole: 'user',
  },
  'session.admin': {
    id: 'session.admin',
    name: 'Session Administration',
    description: 'Full session management including other users',
    resource: 'session',
    actions: ['admin'],
    requiredRole: 'admin',
  },

  // Plugin management
  'plugin.read': {
    id: 'plugin.read',
    name: 'Read Plugins',
    description: 'View loaded plugins',
    resource: 'plugin',
    actions: ['read'],
    requiredRole: 'guest',
  },
  'plugin.execute': {
    id: 'plugin.execute',
    name: 'Execute Plugins',
    description: 'Execute plugin commands',
    resource: 'plugin',
    actions: ['execute'],
    requiredRole: 'user',
  },
  'plugin.manage': {
    id: 'plugin.manage',
    name: 'Manage Plugins',
    description: 'Load, unload, and reload plugins',
    resource: 'plugin',
    actions: ['manage'],
    requiredRole: 'admin',
  },

  // Tool management
  'tool.read': {
    id: 'tool.read',
    name: 'Read Tools',
    description: 'View available tools',
    resource: 'tool',
    actions: ['read'],
    requiredRole: 'guest',
  },
  'tool.execute': {
    id: 'tool.execute',
    name: 'Execute Tools',
    description: 'Execute tool commands',
    resource: 'tool',
    actions: ['execute'],
    requiredRole: 'user',
  },
  'tool.manage': {
    id: 'tool.manage',
    name: 'Manage Tools',
    description: 'Register and manage tools',
    resource: 'tool',
    actions: ['manage'],
    requiredRole: 'admin',
  },

  // API server
  'api.read': {
    id: 'api.read',
    name: 'Read API Status',
    description: 'View API server status',
    resource: 'api',
    actions: ['read'],
    requiredRole: 'user',
  },
  'api.execute': {
    id: 'api.execute',
    name: 'Execute API Server',
    description: 'Start and stop API server',
    resource: 'api',
    actions: ['execute'],
    requiredRole: 'admin',
  },
  'api.manage': {
    id: 'api.manage',
    name: 'Manage API Server',
    description: 'Configure and manage API server',
    resource: 'api',
    actions: ['manage'],
    requiredRole: 'admin',
  },

  // State management
  'state.read': {
    id: 'state.read',
    name: 'Read State',
    description: 'View application state',
    resource: 'state',
    actions: ['read'],
    requiredRole: 'guest',
  },
  'state.write': {
    id: 'state.write',
    name: 'Write State',
    description: 'Modify application state',
    resource: 'state',
    actions: ['write'],
    requiredRole: 'user',
  },
  'state.manage': {
    id: 'state.manage',
    name: 'Manage State',
    description: 'Manage application state',
    resource: 'state',
    actions: ['manage'],
    requiredRole: 'admin',
  },

  // Keychain operations
  'keychain.read': {
    id: 'keychain.read',
    name: 'Read Keychain',
    description: 'Read keychain entries',
    resource: 'keychain',
    actions: ['read'],
    requiredRole: 'user',
  },
  'keychain.write': {
    id: 'keychain.write',
    name: 'Write Keychain',
    description: 'Write keychain entries',
    resource: 'keychain',
    actions: ['write'],
    requiredRole: 'user',
  },
  'keychain.delete': {
    id: 'keychain.delete',
    name: 'Delete Keychain',
    description: 'Delete keychain entries',
    resource: 'keychain',
    actions: ['delete'],
    requiredRole: 'user',
  },
  'keychain.manage': {
    id: 'keychain.manage',
    name: 'Manage Keychain',
    description: 'Manage keychain configuration',
    resource: 'keychain',
    actions: ['manage'],
    requiredRole: 'admin',
  },

  // Theme management
  'theme.read': {
    id: 'theme.read',
    name: 'Read Theme',
    description: 'View current theme',
    resource: 'theme',
    actions: ['read'],
    requiredRole: 'guest',
  },
  'theme.write': {
    id: 'theme.write',
    name: 'Write Theme',
    description: 'Change theme settings',
    resource: 'theme',
    actions: ['write'],
    requiredRole: 'user',
  },

  // System operations
  'system.read': {
    id: 'system.read',
    name: 'Read System Info',
    description: 'View system information',
    resource: 'system',
    actions: ['read'],
    requiredRole: 'guest',
  },
  'system.manage': {
    id: 'system.manage',
    name: 'Manage System',
    description: 'System-level operations',
    resource: 'system',
    actions: ['manage'],
    requiredRole: 'admin',
  },
};

/**
 * Define default role permissions
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: Object.keys(CLI_PERMISSIONS), // Admin has all permissions

  user: [
    // File operations
    'file.read',
    'file.write',
    'file.delete',

    // Configuration
    'config.read',

    // Authentication
    'auth.read',
    'auth.login',

    // Audit
    'audit.read',

    // Sessions
    'session.read',
    'session.manage',
    'session.delete',

    // Plugins
    'plugin.read',
    'plugin.execute',

    // Tools
    'tool.read',
    'tool.execute',

    // API
    'api.read',

    // State
    'state.read',
    'state.write',

    // Keychain
    'keychain.read',
    'keychain.write',
    'keychain.delete',

    // Theme
    'theme.read',
    'theme.write',

    // System
    'system.read',
  ],

  guest: [
    // Read-only access
    'file.read',
    'config.read',
    'auth.read',
    'auth.login',
    'plugin.read',
    'tool.read',
    'state.read',
    'theme.read',
    'system.read',
  ],

  service: [
    // Service account permissions
    'file.read',
    'file.write',

    'config.read',

    'audit.write',

    'session.read',

    'plugin.read',
    'plugin.execute',

    'tool.read',
    'tool.execute',

    'state.read',
    'state.write',

    'system.read',
  ],
};

/**
 * Get permission by ID
 */
export function getPermission(permissionId: string): Permission | undefined {
  return CLI_PERMISSIONS[permissionId];
}

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  const permissionIds = DEFAULT_ROLE_PERMISSIONS[role];
  return permissionIds
    .map(id => CLI_PERMISSIONS[id])
    .filter((p): p is Permission => p !== undefined);
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: UserRole, permissionId: string): boolean {
  return DEFAULT_ROLE_PERMISSIONS[role].includes(permissionId);
}

/**
 * Check if a role has any of the specified permissions
 */
export function roleHasAnyPermission(role: UserRole, permissionIds: string[]): boolean {
  return permissionIds.some(id => DEFAULT_ROLE_PERMISSIONS[role].includes(id));
}

/**
 * Get minimum required role for a permission
 */
export function getRequiredRoleForPermission(permissionId: string): UserRole | undefined {
  const permission = CLI_PERMISSIONS[permissionId];
  return permission?.requiredRole;
}

/**
 * Role hierarchy (higher index = more privileges)
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  guest: 0,
  service: 1,
  user: 2,
  admin: 3,
};

/**
 * Check if a role has sufficient privileges
 */
export function roleHasSufficientPrivilege(role: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Compare two roles and determine which has more privileges
 */
export function compareRoles(role1: UserRole, role2: UserRole): number {
  return ROLE_HIERARCHY[role1] - ROLE_HIERARCHY[role2];
}

/**
 * Get all roles that have a specific permission
 */
export function rolesWithPermission(permissionId: string): UserRole[] {
  return (Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRole[]).filter(role =>
    DEFAULT_ROLE_PERMISSIONS[role].includes(permissionId)
  );
}
