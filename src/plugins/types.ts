/**
 * Plugin System Types
 *
 * Defines the core types and interfaces for the plugin architecture
 */

import { Command } from 'commander';

/**
 * Plugin metadata interface
 */
export interface PluginMetadata {
  /** Unique plugin identifier */
  id: string;

  /** Plugin display name */
  name: string;

  /** Plugin version */
  version: string;

  /** Plugin description */
  description: string;

  /** Plugin author */
  author?: string;

  /** Minimum required CLI version */
  minVersion?: string;

  /** Plugin dependencies (other plugins) */
  dependencies?: string[];
}

/**
 * Plugin context provided to plugins during initialization
 */
export interface PluginContext {
  /** Plugin data directory for storing plugin-specific data */
  dataDir: string;

  /** Global configuration object */
  config: Record<string, unknown>;

  /** Logger function for plugins */
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    debug: (message: string) => void;
  };
}

/**
 * Command definition for plugins to add CLI commands
 */
export interface PluginCommand {
  /** Command instance */
  command: Command;

  /** Optional initialization function */
  init?: () => void | Promise<void>;

  /** Optional cleanup function */
  cleanup?: () => void | Promise<void>;
}

/**
 * Lifecycle hooks for plugins
 */
export interface PluginHooks {
  /** Called before CLI starts */
  beforeStart?: () => void | Promise<void>;

  /** Called after CLI finishes */
  afterFinish?: (exitCode: number) => void | Promise<void>;

  /** Called before any command execution */
  beforeCommand?: (command: string) => void | Promise<void>;

  /** Called after any command execution */
  afterCommand?: (command: string, exitCode: number) => void | Promise<void>;
}

/**
 * Main plugin interface
 */
export interface IPlugin {
  /** Plugin metadata */
  metadata: PluginMetadata;

  /** Initialize the plugin with context */
  initialize?(context: PluginContext): void | Promise<void>;

  /** Get commands provided by this plugin */
  getCommands?(): PluginCommand[];

  /** Lifecycle hooks */
  hooks?: PluginHooks;

  /** Cleanup function called when plugin is unloaded */
  cleanup?(): void | Promise<void>;
}

/**
 * Plugin load result
 */
export interface PluginLoadResult {
  /** Whether the plugin was loaded successfully */
  success: boolean;

  /** Plugin ID */
  pluginId: string;

  /** Error message if loading failed */
  error?: string;

  /** Warnings during loading */
  warnings?: string[];
}

/**
 * Plugin manager configuration
 */
export interface PluginManagerConfig {
  /** Directories to search for plugins */
  pluginDirectories: string[];

  /** Whether to load plugins automatically */
  autoLoad: boolean;

  /** Whether to enable hot-reloading of plugins */
  hotReload: boolean;

  /** Maximum number of plugins to load */
  maxPlugins?: number;

  /** Whether to show verbose error messages for plugin loading failures */
  verbose?: boolean;
}
