/**
 * Configuration System
 *
 * Provides comprehensive configuration management with support for:
 * - Default values
 * - Configuration files (JSON)
 * - Environment variables
 * - Runtime overrides
 * - Validation
 * - Change listeners
 */

// Main configuration manager
export { ConfigManager, getConfigManager, initializeConfig } from './ConfigManager.js';

// Types
export type {
  AppConfig,
  AppSettings,
  UserPreferences,
  FeatureConfigs,
  FileOpsConfig,
  EncryptionConfig,
  PowerRenameConfig,
  NodeCleanupConfig,
  DotNetCleanupConfig,
  ConfigSource,
  ConfigChangeEvent,
  ConfigChangeListener,
  ConfigValidationResult,
  ConfigOptions,
} from './types.js';

// Validator
export { ConfigValidator } from './validator.js';

// Defaults
export { DEFAULT_CONFIG, ENV_VAR_MAPPING, CONFIG_FILE_PATHS } from './defaults.js';

// Helpers
export {
  getAppSetting,
  getPreference,
  getFeatureConfig,
  isDebugMode,
  getLogLevel,
  isColorOutput,
  requiresConfirmation,
  getTheme,
  getOperationTimeout,
  getMaxParallelOps,
  FileOps,
  Encryption,
  PowerRename,
  NodeCleanup,
  DotNetCleanup,
} from './helpers.js';
