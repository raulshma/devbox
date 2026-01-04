/**
 * Plugin System
 *
 * Main entry point for the plugin system
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { PluginManager } from './PluginManager.js';
import { PluginContext, IPlugin, PluginManagerConfig } from './types.js';

/**
 * Create and configure the plugin system
 */
export async function createPluginSystem(
  program: Command,
  options: Partial<PluginManagerConfig> = {}
): Promise<PluginManager> {
  // Determine plugin directories
  const homeDir = os.homedir();
  const pluginDirectories = options.pluginDirectories || [
    path.join(homeDir, '.devtoolbox', 'plugins'),
    path.join(process.cwd(), '.devtoolbox', 'plugins'),
    path.join(process.cwd(), 'plugins'),
  ];

  // Ensure plugin directories exist
  for (const dir of pluginDirectories) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Ignore errors, directory might already exist
    }
  }

  // Create plugin context
  const dataDir = path.join(homeDir, '.devtoolbox', 'plugin-data');
  await fs.mkdir(dataDir, { recursive: true });

  const context: PluginContext = {
    dataDir,
    config: {},
    logger: {
      info: (message: string) => console.log(chalk.blue('ℹ'), message),
      warn: (message: string) => console.log(chalk.yellow('⚠'), message),
      error: (message: string) => console.log(chalk.red('✗'), message),
      debug: (message: string) => {
        if (process.env.DEBUG) {
          console.log(chalk.gray('🐛'), message);
        }
      },
    },
  };

  // Create plugin manager configuration
  const config: PluginManagerConfig = {
    pluginDirectories,
    autoLoad: options.autoLoad ?? true,
    hotReload: options.hotReload ?? false,
    maxPlugins: options.maxPlugins,
    verbose: options.verbose ?? !!process.env.DEBUG,
  };

  // Create plugin manager
  const pluginManager = new PluginManager(config, context);

  // Load plugins if auto-load is enabled
  if (config.autoLoad) {
    const results = await pluginManager.loadAllPlugins();
    const loadedCount = results.filter(r => r.success).length;

    // Only show plugin loading messages if plugins were found or in verbose mode
    if (loadedCount > 0 || config.verbose) {
      console.log(chalk.gray('\n🔌 Loading plugins...'));
      if (results.length === 0) {
        console.log(chalk.gray('  No plugins found'));
      } else {
        console.log(chalk.green(`  Loaded ${loadedCount} plugin(s)`));
      }
    }

    // Register plugin commands
    pluginManager.registerCommands(program);
  }

  return pluginManager;
}

/**
 * Export types and classes
 */
export { PluginManager } from './PluginManager.js';
export { PluginManagerConfig, PluginContext, IPlugin, PluginMetadata } from './types.js';
export type { PluginCommand, PluginHooks, PluginLoadResult } from './types.js';
