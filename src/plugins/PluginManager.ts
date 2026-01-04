/**
 * Plugin Manager
 *
 * Core plugin system responsible for discovering, loading, and managing plugins
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import {
  IPlugin,
  PluginContext,
  PluginLoadResult,
  PluginManagerConfig,
  PluginMetadata,
} from './types.js';

/**
 * Manages the plugin lifecycle
 */
export class PluginManager {
  private plugins: Map<string, IPlugin> = new Map();
  private pluginCommands: Map<string, Command[]> = new Map();
  private config: PluginManagerConfig;
  private context: PluginContext;

  constructor(config: PluginManagerConfig, context: PluginContext) {
    this.config = config;
    this.context = context;
  }

  /**
   * Discover all plugins in the configured directories
   */
  async discoverPlugins(): Promise<string[]> {
    const pluginPaths: string[] = [];

    for (const dir of this.config.pluginDirectories) {
      try {
        const stat = await fs.stat(dir);

        if (stat.isDirectory()) {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            if (entry.isDirectory()) {
              const pluginPath = path.join(dir, entry.name);
              const manifestPath = path.join(pluginPath, 'plugin.json');
              const indexPath = path.join(pluginPath, 'index.js');

              try {
                // Check if both plugin.json and index.js exist
                await fs.access(manifestPath);
                await fs.access(indexPath);
                pluginPaths.push(pluginPath);
              } catch {
                // Not a valid plugin directory, skip
                continue;
              }
            }
          }
        }
      } catch (error) {
        this.context.logger.warn(`Failed to scan plugin directory: ${dir}`);
        if (error instanceof Error) {
          this.context.logger.debug(`  Error: ${error.message}`);
        }
      }
    }

    return pluginPaths;
  }

  /**
   * Load a plugin from the given path
   */
  async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    const indexPath = path.join(pluginPath, 'index.js');

    try {
      // Read and parse manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginMetadata = JSON.parse(manifestContent);

      // Validate manifest
      const validation = this.validateManifest(manifest);
      if (!validation.valid) {
        return {
          success: false,
          pluginId: manifest.id || 'unknown',
          error: `Invalid manifest: ${validation.errors.join(', ')}`,
        };
      }

      // Check if plugin is already loaded
      if (this.plugins.has(manifest.id)) {
        return {
          success: false,
          pluginId: manifest.id,
          error: 'Plugin already loaded',
        };
      }

      // Check dependencies
      if (manifest.dependencies) {
        for (const dep of manifest.dependencies) {
          if (!this.plugins.has(dep)) {
            return {
              success: false,
              pluginId: manifest.id,
              error: `Missing dependency: ${dep}`,
            };
          }
        }
      }

      // Dynamic import of the plugin module
      // Convert Windows path to file:// URL for ESM import
      const importPath = process.platform === 'win32'
        ? `file:///${indexPath.replace(/\\/g, '/')}`
        : `file://${indexPath}`;

      const pluginModule = await import(importPath);

      // Get the plugin class or object
      const PluginClass = pluginModule.default || pluginModule.Plugin;
      if (!PluginClass) {
        return {
          success: false,
          pluginId: manifest.id,
          error: 'Plugin does not export a default class or Plugin class',
        };
      }

      // Instantiate the plugin
      const plugin: IPlugin = typeof PluginClass === 'function'
        ? new PluginClass()
        : PluginClass;

      // Verify plugin interface
      if (!plugin.metadata) {
        return {
          success: false,
          pluginId: manifest.id,
          error: 'Plugin does not have metadata property',
        };
      }

      // Initialize plugin if it has an initialize method
      if (plugin.initialize) {
        await plugin.initialize(this.context);
      }

      // Register plugin
      this.plugins.set(manifest.id, plugin);

      this.context.logger.info(
        chalk.green(`✓ Loaded plugin: ${plugin.metadata.name} v${plugin.metadata.version}`)
      );

      return {
        success: true,
        pluginId: manifest.id,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        pluginId: path.basename(pluginPath),
        error: errorMessage,
      };
    }
  }

  /**
   * Load all discovered plugins
   */
  async loadAllPlugins(): Promise<PluginLoadResult[]> {
    const pluginPaths = await this.discoverPlugins();
    const results: PluginLoadResult[] = [];

    // Check max plugins limit
    if (this.config.maxPlugins && pluginPaths.length > this.config.maxPlugins) {
      this.context.logger.warn(
        `Found ${pluginPaths.length} plugins but limit is ${this.config.maxPlugins}`
      );
    }

    for (const pluginPath of pluginPaths) {
      const result = await this.loadPlugin(pluginPath);
      results.push(result);

      if (!result.success && this.config.verbose) {
        this.context.logger.error(
          chalk.red(`✗ Failed to load plugin: ${result.error}`)
        );
      }
    }

    return results;
  }

  /**
   * Register plugin commands with the CLI program
   */
  registerCommands(program: Command): void {
    for (const [pluginId, plugin] of this.plugins.entries()) {
      if (plugin.getCommands) {
        try {
          const commands = plugin.getCommands();
          if (commands && commands.length > 0) {
            for (const cmd of commands) {
              program.addCommand(cmd.command);

              // Store command reference for cleanup
              if (!this.pluginCommands.has(pluginId)) {
                this.pluginCommands.set(pluginId, []);
              }
              this.pluginCommands.get(pluginId)!.push(cmd.command);

              // Initialize command if needed
              if (cmd.init) {
                cmd.init();
              }

              this.context.logger.debug(
                `Registered command: ${cmd.command.name()} from plugin ${pluginId}`
              );
            }
          }
        } catch (error) {
          this.context.logger.error(
            `Failed to register commands for plugin ${pluginId}: ${error}`
          );
        }
      }
    }
  }

  /**
   * Execute plugin hooks
   */
  async executeHook(hookName: keyof NonNullable<IPlugin['hooks']>, ...args: unknown[]): Promise<void> {
    for (const [pluginId, plugin] of this.plugins.entries()) {
      if (plugin.hooks && plugin.hooks[hookName]) {
        try {
          const hookFn = plugin.hooks[hookName];
          if (hookFn) {
            // Call hook with proper arguments based on hook type
            if (hookName === 'afterCommand' && args.length >= 2) {
              await (hookFn as (command: string, exitCode: number) => void)(args[0] as string, args[1] as number);
            } else if (hookName === 'beforeCommand' && args.length >= 1) {
              await (hookFn as (command: string) => void)(args[0] as string);
            } else {
              await (hookFn as (...args: unknown[]) => void)(...args);
            }
          }
        } catch (error) {
          this.context.logger.error(
            `Error executing ${hookName} hook for plugin ${pluginId}: ${error}`
          );
        }
      }
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    try {
      // Cleanup plugin
      if (plugin.cleanup) {
        await plugin.cleanup();
      }

      // Cleanup commands
      const commands = this.pluginCommands.get(pluginId);
      if (commands) {
        for (const cmd of commands) {
          // Note: Commander.js Command objects don't have a built-in cleanup method
          // Plugin commands with cleanup functions are handled through the PluginCommand interface
        }
        this.pluginCommands.delete(pluginId);
      }

      // Remove from registry
      this.plugins.delete(pluginId);

      this.context.logger.info(
        chalk.yellow(`Unloaded plugin: ${pluginId}`)
      );

      return true;
    } catch (error) {
      this.context.logger.error(
        `Failed to unload plugin ${pluginId}: ${error}`
      );
      return false;
    }
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): IPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Check if a plugin is loaded
   */
  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Validate plugin manifest
   */
  private validateManifest(manifest: PluginMetadata): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!manifest.id) {
      errors.push('Missing required field: id');
    }

    if (!manifest.name) {
      errors.push('Missing required field: name');
    }

    if (!manifest.version) {
      errors.push('Missing required field: version');
    }

    if (!manifest.description) {
      errors.push('Missing required field: description');
    }

    // Validate ID format (alphanumeric, hyphens, underscores)
    if (manifest.id && !/^[a-zA-Z0-9_-]+$/.test(manifest.id)) {
      errors.push('Plugin ID must contain only alphanumeric characters, hyphens, and underscores');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Reload all plugins
   */
  async reloadAllPlugins(): Promise<PluginLoadResult[]> {
    // Unload all plugins
    const pluginIds = Array.from(this.plugins.keys());
    for (const pluginId of pluginIds) {
      await this.unloadPlugin(pluginId);
    }

    // Load all plugins again
    return await this.loadAllPlugins();
  }
}
