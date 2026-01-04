/**
 * Default configuration values
 */

import type { AppConfig } from './types.js';

export const DEFAULT_CONFIG: AppConfig = {
  app: {
    name: 'developer-toolbox-cli',
    version: '0.1.0',
    debug: false,
    logLevel: 'info',
    maxParallelOps: 4,
  },
  preferences: {
    theme: 'auto',
    colorTheme: 'default',
    colorOutput: true,
    locale: 'en',
    confirmDestructive: true,
    showTips: true,
    operationTimeout: 30000, // 30 seconds
  },
  features: {
    fileOps: {
      preserveTimestamps: true,
      preservePermissions: true,
      preserveOwnership: false,
      followSymlinks: false,
      useTrash: true,
      overwrite: false,
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      validatePassword: true,
      minPasswordLength: 8,
      backupOriginal: true,
      removeOriginal: false,
      useKeychain: false,
      keychainService: 'developer-toolbox-cli',
      streamingEnabled: true,
      streamChunkSize: 64 * 1024, // 64KB
      streamThreshold: 10 * 1024 * 1024, // 10MB
    },
    powerRename: {
      caseSensitive: false,
      useRegex: false,
      previewChanges: true,
      createUndoScript: true,
    },
    nodeCleanup: {
      removeNodeModules: true,
      removePackageLock: false,
      removeYarnLock: false,
      removeCache: true,
      analyzeDiskUsage: true,
    },
    dotnetCleanup: {
      removeBin: true,
      removeObj: true,
      cleanSolution: false,
      analyzeDiskUsage: true,
    },
  },
};

/**
 * Map of environment variable names to config paths
 */
export const ENV_VAR_MAPPING: Record<string, string> = {
  // App settings
  'DTB_DEBUG': 'app.debug',
  'DTB_LOG_LEVEL': 'app.logLevel',
  'DTB_MAX_PARALLEL': 'app.maxParallelOps',
  'DTB_DEFAULT_DIR': 'app.defaultDirectory',

  // Preferences
  'DTB_THEME': 'preferences.theme',
  'DTB_COLOR_THEME': 'preferences.colorTheme',
  'DTB_COLOR': 'preferences.colorOutput',
  'DTB_LOCALE': 'preferences.locale',
  'DTB_CONFIRM': 'preferences.confirmDestructive',
  'DTB_TIPS': 'preferences.showTips',
  'DTB_TIMEOUT': 'preferences.operationTimeout',

  // File operations
  'DTB_PRESERVE_TIME': 'features.fileOps.preserveTimestamps',
  'DTB_PRESERVE_PERMS': 'features.fileOps.preservePermissions',
  'DTB_PRESERVE_OWNER': 'features.fileOps.preserveOwnership',
  'DTB_FOLLOW_SYMLINKS': 'features.fileOps.followSymlinks',
  'DTB_USE_TRASH': 'features.fileOps.useTrash',
  'DTB_OVERWRITE': 'features.fileOps.overwrite',

  // Encryption
  'DTB_ENCRYPTION_ALGO': 'features.encryption.algorithm',
  'DTB_VALIDATE_PASSWORD': 'features.encryption.validatePassword',
  'DTB_MIN_PASSWORD': 'features.encryption.minPasswordLength',
  'DTB_BACKUP_ORIGINAL': 'features.encryption.backupOriginal',
  'DTB_REMOVE_ORIGINAL': 'features.encryption.removeOriginal',
  'DTB_USE_KEYCHAIN': 'features.encryption.useKeychain',
  'DTB_KEYCHAIN_SERVICE': 'features.encryption.keychainService',
  'DTB_STREAMING_ENABLED': 'features.encryption.streamingEnabled',
  'DTB_STREAM_CHUNK_SIZE': 'features.encryption.streamChunkSize',
  'DTB_STREAM_THRESHOLD': 'features.encryption.streamThreshold',

  // Power rename
  'DTB_CASE_SENSITIVE': 'features.powerRename.caseSensitive',
  'DTB_USE_REGEX': 'features.powerRename.useRegex',
  'DTB_PREVIEW_CHANGES': 'features.powerRename.previewChanges',
  'DTB_UNDO_SCRIPT': 'features.powerRename.createUndoScript',
};

/**
 * Configuration file paths to search (in order of priority)
 */
export const CONFIG_FILE_PATHS = [
  './devtoolbox.config.json',
  './.devtoolboxrc',
  './devtoolbox.json',
  '~/.devtoolbox/config.json',
  '~/.config/devtoolbox/config.json',
];
