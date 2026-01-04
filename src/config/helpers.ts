/**
 * Configuration helper utilities
 * Provides convenient functions for accessing configuration values
 */

import { getConfigManager } from './ConfigManager.js';
import type { AppSettings, UserPreferences, FeatureConfigs } from './types.js';

/**
 * Get app settings
 */
export function getAppSetting<K extends keyof AppSettings>(
  key: K
): AppSettings[K] | undefined {
  const manager = getConfigManager();
  return manager.get(`app.${key}`);
}

/**
 * Get user preference
 */
export function getPreference<K extends keyof UserPreferences>(
  key: K
): UserPreferences[K] | undefined {
  const manager = getConfigManager();
  return manager.get(`preferences.${key}`);
}

/**
 * Get feature configuration
 */
export function getFeatureConfig<F extends keyof FeatureConfigs, K extends keyof FeatureConfigs[F]>(
  feature: F,
  key: K
): FeatureConfigs[F][K] | undefined {
  const manager = getConfigManager();
  return manager.get(`features.${String(feature)}.${String(key)}`);
}

/**
 * Check if debug mode is enabled
 */
export function isDebugMode(): boolean {
  return getAppSetting('debug') ?? false;
}

/**
 * Get log level
 */
export function getLogLevel(): AppSettings['logLevel'] {
  return getAppSetting('logLevel') ?? 'info';
}

/**
 * Check if color output is enabled
 */
export function isColorOutput(): boolean {
  return getPreference('colorOutput') ?? true;
}

/**
 * Check if destructive operations need confirmation
 */
export function requiresConfirmation(): boolean {
  return getPreference('confirmDestructive') ?? true;
}

/**
 * Get theme setting
 */
export function getTheme(): UserPreferences['theme'] {
  return getPreference('theme') ?? 'auto';
}

/**
 * Get operation timeout
 */
export function getOperationTimeout(): number {
  return getPreference('operationTimeout') ?? 30000;
}

/**
 * Get max parallel operations
 */
export function getMaxParallelOps(): number {
  return getAppSetting('maxParallelOps') ?? 4;
}

/**
 * File operations helpers
 */
export const FileOps = {
  shouldPreserveTimestamps: (): boolean => {
    return getFeatureConfig('fileOps', 'preserveTimestamps') ?? true;
  },

  shouldPreservePermissions: (): boolean => {
    return getFeatureConfig('fileOps', 'preservePermissions') ?? true;
  },

  shouldPreserveOwnership: (): boolean => {
    return getFeatureConfig('fileOps', 'preserveOwnership') ?? false;
  },

  shouldFollowSymlinks: (): boolean => {
    return getFeatureConfig('fileOps', 'followSymlinks') ?? false;
  },

  shouldUseTrash: (): boolean => {
    return getFeatureConfig('fileOps', 'useTrash') ?? true;
  },

  shouldOverwrite: (): boolean => {
    return getFeatureConfig('fileOps', 'overwrite') ?? false;
  },
};

/**
 * Encryption helpers
 */
export const Encryption = {
  getAlgorithm: (): FeatureConfigs['encryption']['algorithm'] => {
    return getFeatureConfig('encryption', 'algorithm') ?? 'aes-256-gcm';
  },

  shouldValidatePassword: (): boolean => {
    return getFeatureConfig('encryption', 'validatePassword') ?? true;
  },

  getMinPasswordLength: (): number => {
    return getFeatureConfig('encryption', 'minPasswordLength') ?? 8;
  },

  shouldBackupOriginal: (): boolean => {
    return getFeatureConfig('encryption', 'backupOriginal') ?? true;
  },

  shouldRemoveOriginal: (): boolean => {
    return getFeatureConfig('encryption', 'removeOriginal') ?? false;
  },

  shouldUseKeychain: (): boolean => {
    return getFeatureConfig('encryption', 'useKeychain') ?? false;
  },

  getKeychainService: (): string => {
    return getFeatureConfig('encryption', 'keychainService') ?? 'developer-toolbox-cli';
  },

  isStreamingEnabled: (): boolean => {
    return getFeatureConfig('encryption', 'streamingEnabled') ?? true;
  },

  getStreamChunkSize: (): number => {
    return getFeatureConfig('encryption', 'streamChunkSize') ?? 64 * 1024; // 64KB default
  },

  getStreamThreshold: (): number => {
    return getFeatureConfig('encryption', 'streamThreshold') ?? 10 * 1024 * 1024; // 10MB default
  },
};

/**
 * Power rename helpers
 */
export const PowerRename = {
  isCaseSensitive: (): boolean => {
    return getFeatureConfig('powerRename', 'caseSensitive') ?? false;
  },

  useRegex: (): boolean => {
    return getFeatureConfig('powerRename', 'useRegex') ?? false;
  },

  shouldPreviewChanges: (): boolean => {
    return getFeatureConfig('powerRename', 'previewChanges') ?? true;
  },

  shouldCreateUndoScript: (): boolean => {
    return getFeatureConfig('powerRename', 'createUndoScript') ?? true;
  },

  getDefaultConflictStrategy: (): string | undefined => {
    return getFeatureConfig('powerRename', 'defaultConflictStrategy');
  },

  getRenameSuffix: (): string => {
    return getFeatureConfig('powerRename', 'renameSuffix') ?? '_$n';
  },

  getBackupSuffix: (): string => {
    return getFeatureConfig('powerRename', 'backupSuffix') ?? '.bak';
  },
};

/**
 * Node cleanup helpers
 */
export const NodeCleanup = {
  shouldRemoveNodeModules: (): boolean => {
    return getFeatureConfig('nodeCleanup', 'removeNodeModules') ?? true;
  },

  shouldRemovePackageLock: (): boolean => {
    return getFeatureConfig('nodeCleanup', 'removePackageLock') ?? false;
  },

  shouldRemoveYarnLock: (): boolean => {
    return getFeatureConfig('nodeCleanup', 'removeYarnLock') ?? false;
  },

  shouldRemoveCache: (): boolean => {
    return getFeatureConfig('nodeCleanup', 'removeCache') ?? true;
  },

  shouldAnalyzeDiskUsage: (): boolean => {
    return getFeatureConfig('nodeCleanup', 'analyzeDiskUsage') ?? true;
  },
};

/**
 * DotNet cleanup helpers
 */
export const DotNetCleanup = {
  shouldRemoveBin: (): boolean => {
    return getFeatureConfig('dotnetCleanup', 'removeBin') ?? true;
  },

  shouldRemoveObj: (): boolean => {
    return getFeatureConfig('dotnetCleanup', 'removeObj') ?? true;
  },

  shouldCleanSolution: (): boolean => {
    return getFeatureConfig('dotnetCleanup', 'cleanSolution') ?? false;
  },

  shouldAnalyzeDiskUsage: (): boolean => {
    return getFeatureConfig('dotnetCleanup', 'analyzeDiskUsage') ?? true;
  },
};
