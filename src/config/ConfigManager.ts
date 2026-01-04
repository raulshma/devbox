/**
 * Configuration Manager
 * Manages application configuration with support for:
 * - Default values
 * - Configuration files
 * - Environment variables
 * - Runtime overrides
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import type {
  AppConfig,
  ConfigChangeListener,
  ConfigChangeEvent,
  ConfigOptions,
  ConfigSource,
} from './types.js';
import { DEFAULT_CONFIG, ENV_VAR_MAPPING, CONFIG_FILE_PATHS } from './defaults.js';
import { ConfigValidator } from './validator.js';

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge<T>(target: any, source: any): T {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output as T;
}

function isObject(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export class ConfigManager {
  private config: AppConfig;
  private listeners: Set<ConfigChangeListener> = new Set();
  private configPath: string | null = null;
  private options: ConfigOptions;

  constructor(options: ConfigOptions = {}) {
    this.options = options;
    this.config = deepClone(DEFAULT_CONFIG);
  }

  /**
   * Initialize the configuration manager
   * Loads config from file and environment variables
   */
  async initialize(): Promise<void> {
    // Load from file (if not disabled)
    if (!this.options.noConfigFile) {
      await this.loadFromFile();
    }

    // Load from environment variables (if not disabled)
    if (!this.options.noEnvVars) {
      this.loadFromEnv();
    }

    // Validate the final configuration
    const validation = ConfigValidator.validate(this.config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration:\n${validation.errors.join('\n')}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn(`Configuration warnings:\n${validation.warnings.join('\n')}`);
    }
  }

  /**
   * Get the entire configuration object
   */
  getConfig(): Readonly<AppConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Get a specific configuration value using dot notation
   * Example: get('app.debug') or get('preferences.theme')
   */
  get<T = unknown>(key: string): T | undefined {
    const keys = key.split('.');
    let value: any = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value as T;
  }

  /**
   * Set a specific configuration value using dot notation
   * This will not persist to file unless save() is called
   */
  async set<T = unknown>(key: string, value: T, source: ConfigSource['type'] = 'cli'): Promise<void> {
    const keys = key.split('.');
    const oldValue = this.get(key);

    // Validate the new value before setting
    const tempConfig = deepClone(this.config);
    this.setSilently(tempConfig, key, value);
    const validation = ConfigValidator.validate(tempConfig);
    if (!validation.valid) {
      throw new Error(`Invalid configuration value: ${validation.errors.join(', ')}`);
    }

    // Navigate to the parent object
    let current: any = this.config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    // Set the value
    current[keys[keys.length - 1]] = value;

    // Emit change event
    this.emitChange({
      key,
      oldValue,
      newValue: value,
      source,
    });
  }

  /**
   * Merge a partial configuration object
   */
  async merge(partialConfig: Partial<AppConfig>, source: ConfigSource['type'] = 'cli'): Promise<void> {
    // Validate before merging
    const tempConfig = deepMerge(this.config, partialConfig) as Partial<AppConfig>;
    const validation = ConfigValidator.validate(tempConfig);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Get old values for change events
    const oldConfig = deepClone(this.config);

    // Perform the merge
    this.config = deepMerge(this.config, partialConfig);

    // Emit change events for top-level keys
    for (const key of Object.keys(partialConfig)) {
      this.emitChange({
        key,
        oldValue: (oldConfig as any)[key],
        newValue: (this.config as any)[key],
        source,
      });
    }
  }

  /**
   * Reset a configuration value to its default
   */
  async reset(key: string): Promise<void> {
    const keys = key.split('.');
    let defaultValue: any = DEFAULT_CONFIG;

    for (const k of keys) {
      if (defaultValue && typeof defaultValue === 'object' && k in defaultValue) {
        defaultValue = defaultValue[k];
      } else {
        throw new Error(`No default value found for: ${key}`);
      }
    }

    await this.set(key, deepClone(defaultValue), 'default');
  }

  /**
   * Reset all configuration to defaults
   */
  async resetAll(): Promise<void> {
    const oldConfig = deepClone(this.config);
    this.config = deepClone(DEFAULT_CONFIG);

    this.emitChange({
      key: '*',
      oldValue: oldConfig,
      newValue: this.config,
      source: 'default',
    });
  }

  /**
   * Save the current configuration to file
   */
  async save(filePath?: string): Promise<void> {
    const savePath = filePath || this.configPath;
    if (!savePath) {
      throw new Error('No configuration file path specified');
    }

    // Expand home directory if needed
    const expandedPath = savePath.startsWith('~')
      ? path.join(os.homedir(), savePath.slice(1))
      : savePath;

    // Ensure directory exists
    const dir = path.dirname(expandedPath);
    await fs.mkdir(dir, { recursive: true });

    // Write configuration
    await fs.writeFile(
      expandedPath,
      JSON.stringify(this.config, null, 2),
      'utf-8'
    );

    this.configPath = expandedPath;
  }

  /**
   * Load configuration from a file
   */
  async loadFromFile(filePath?: string): Promise<void> {
    const pathsToCheck = filePath
      ? [filePath]
      : CONFIG_FILE_PATHS;

    for (const configPath of pathsToCheck) {
      try {
        // Expand home directory if needed
        const expandedPath = configPath.startsWith('~')
          ? path.join(os.homedir(), configPath.slice(1))
          : path.resolve(configPath);

        // Check if file exists
        await fs.access(expandedPath);

        // Read and parse the file
        const content = await fs.readFile(expandedPath, 'utf-8');
        const fileConfig = JSON.parse(content);

        // Merge with existing config
        await this.merge(fileConfig, 'file');

        // Store the config path for future saves
        this.configPath = expandedPath;

        // Stop checking other paths
        break;
      } catch (error) {
        // File doesn't exist or can't be read, continue to next path
        if ((error as any).code !== 'ENOENT') {
          console.warn(`Warning: Failed to load config from ${configPath}`);
        }
        continue;
      }
    }
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnv(): void {
    for (const [envVar, configPath] of Object.entries(ENV_VAR_MAPPING)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        // Convert the value to the appropriate type
        const convertedValue = this.convertEnvValue(value);
        // Set it silently (no change events for env vars)
        this.setSilently(this.config, configPath, convertedValue);
      }
    }
  }

  /**
   * Register a listener for configuration changes
   */
  onChange(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get the configuration file path
   */
  getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * Get configuration source information
   */
  getConfigSource(key: string): ConfigSource | null {
    // This is a simplified version - could be enhanced to track actual sources
    return {
      type: 'file',
      priority: 1,
    };
  }

  /**
   * Convert environment variable string to appropriate type
   */
  private convertEnvValue(value: string): any {
    // Try to parse as number
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }

    if (/^\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    // Try to parse as boolean
    if (value.toLowerCase() === 'true') {
      return true;
    }

    if (value.toLowerCase() === 'false') {
      return false;
    }

    // Return as string
    return value;
  }

  /**
   * Set a configuration value without emitting change events
   */
  private setSilently(obj: any, key: string, value: any): void {
    const keys = key.split('.');
    let current: any = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Emit a configuration change event
   */
  private emitChange(event: ConfigChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in config change listener:', error);
      }
    }
  }
}

// Singleton instance
let instance: ConfigManager | null = null;

/**
 * Get the singleton configuration manager instance
 */
export function getConfigManager(options?: ConfigOptions): ConfigManager {
  if (!instance) {
    instance = new ConfigManager(options);
  }
  return instance;
}

/**
 * Initialize the configuration system
 */
export async function initializeConfig(options?: ConfigOptions): Promise<ConfigManager> {
  const manager = getConfigManager(options);
  await manager.initialize();
  return manager;
}
