/**
 * Configuration system types for Developer Toolbox CLI
 */

export interface AppConfig {
  /** Application-level settings */
  app: AppSettings;
  /** User preferences */
  preferences: UserPreferences;
  /** Feature-specific configurations */
  features: FeatureConfigs;
}

export interface AppSettings {
  /** Application name */
  name: string;
  /** Application version */
  version: string;
  /** Default working directory */
  defaultDirectory?: string;
  /** Enable debug mode */
  debug: boolean;
  /** Log level */
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  /** Maximum number of parallel operations */
  maxParallelOps: number;
}

export interface UserPreferences {
  /** UI theme */
  theme: 'light' | 'dark' | 'auto';
  /** Color theme name */
  colorTheme: 'default' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'pastel' | 'monochrome';
  /** Color output */
  colorOutput: boolean;
  /** Language/locale */
  locale: string;
  /** Confirm before destructive operations */
  confirmDestructive: boolean;
  /** Show tips and hints */
  showTips: boolean;
  /** Default editor */
  defaultEditor?: string;
  /** Timeout for operations (ms) */
  operationTimeout: number;
}

export interface FeatureConfigs {
  /** File operations configuration */
  fileOps: FileOpsConfig;
  /** Encryption configuration */
  encryption: EncryptionConfig;
  /** Power rename configuration */
  powerRename: PowerRenameConfig;
  /** Node cleanup configuration */
  nodeCleanup: NodeCleanupConfig;
  /** DotNet cleanup configuration */
  dotnetCleanup: DotNetCleanupConfig;
}

export interface FileOpsConfig {
  /** Preserve timestamps when copying */
  preserveTimestamps: boolean;
  /** Preserve file permissions (mode) when copying */
  preservePermissions: boolean;
  /** Preserve file ownership (uid/gid on Unix) when copying - requires elevated privileges */
  preserveOwnership: boolean;
  /** Follow symbolic links */
  followSymlinks: boolean;
  /** Default to trash instead of delete */
  useTrash: boolean;
  /** Overwrite existing files */
  overwrite: boolean;
}

export interface EncryptionConfig {
  /** Default encryption algorithm */
  algorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
  /** Password validation enabled */
  validatePassword: boolean;
  /** Minimum password length */
  minPasswordLength: number;
  /** Backup original files */
  backupOriginal: boolean;
  /** Remove original after encryption */
  removeOriginal: boolean;
  /** Enable OS keychain integration for password storage */
  useKeychain: boolean;
  /** Service name for keychain storage */
  keychainService: string;
  /** Enable streaming mode by default for large files */
  streamingEnabled: boolean;
  /** Chunk size for streaming operations (in bytes) */
  streamChunkSize: number;
  /** File size threshold for auto-streaming (in bytes) */
  streamThreshold: number;
}

export interface PowerRenameConfig {
  /** Case sensitive by default */
  caseSensitive: boolean;
  /** Use regex by default */
  useRegex: boolean;
  /** Preview changes before applying */
  previewChanges: boolean;
  /** Create undo script */
  createUndoScript: boolean;
  /** Default conflict resolution strategy */
  defaultConflictStrategy?: 'skip' | 'overwrite' | 'rename' | 'keep-newer' | 'keep-older' | 'keep-larger' | 'keep-smaller' | 'backup' | 'skip-identical';
  /** Default rename suffix for conflict resolution */
  renameSuffix?: string;
  /** Default backup suffix for conflict resolution */
  backupSuffix?: string;
}

export interface NodeCleanupConfig {
  /** Remove node_modules */
  removeNodeModules: boolean;
  /** Remove package-lock.json */
  removePackageLock: boolean;
  /** Remove yarn.lock */
  removeYarnLock: boolean;
  /** Remove cache directories */
  removeCache: boolean;
  /** Analyze disk usage */
  analyzeDiskUsage: boolean;
}

export interface DotNetCleanupConfig {
  /** Remove bin directories */
  removeBin: boolean;
  /** Remove obj directories */
  removeObj: boolean;
  /** Clean solution files */
  cleanSolution: boolean;
  /** Analyze disk usage */
  analyzeDiskUsage: boolean;
}

export interface ConfigSource {
  /** Source of the configuration value */
  type: 'default' | 'file' | 'env' | 'cli';
  /** Priority level (higher = more priority) */
  priority: number;
}

export interface ConfigChangeEvent<T = unknown> {
  /** The key that changed (dot notation) */
  key: string;
  /** The old value */
  oldValue: T;
  /** The new value */
  newValue: T;
  /** Source of the change */
  source: ConfigSource['type'];
}

export type ConfigChangeListener = (event: ConfigChangeEvent) => void;

export interface ConfigValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

export interface ConfigOptions {
  /** Custom config file path */
  configPath?: string;
  /** Disable loading from config file */
  noConfigFile?: boolean;
  /** Disable environment variables */
  noEnvVars?: boolean;
  /** Enable watching for config changes */
  watch?: boolean;
}
