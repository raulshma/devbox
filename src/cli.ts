#!/usr/bin/env node

/**
 * Developer Toolbox CLI - Main Entry Point
 *
 * This is the main entry point for the Developer Toolbox CLI application.
 * It uses Commander.js to parse commands and dispatch to appropriate handlers.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { renameCommand } from './commands/rename.js';
import { regexBuilderCommand } from './commands/regex-builder.js';
import { encryptCommand } from './commands/encrypt.js';
import { decryptCommand } from './commands/decrypt.js';
import { fileOpsCommand } from './commands/fileops.js';
import { cleanupNodeCommand } from './commands/cleanup-node.js';
import { cleanupDotnetCommand } from './commands/cleanup-dotnet.js';
import { discoverCommand } from './commands/discover.js';
import { stateCommand } from './commands/state.js';
import { interactiveInkCommand } from './commands/interactive-ink.js';
import { createPluginSystem, PluginManager } from './plugins/index.js';
import { errorHandler } from './errors/index.js';
import { toolsCommand } from './commands/tools.js';
import { apiCommand } from './commands/api.js';
import { sessionsCommand } from './commands/sessions.js';
import { auditCommand } from './commands/audit.js';
import { keychainCommand } from './commands/keychain.js';
import { authCommand } from './commands/auth.js';
import { themeCommand } from './commands/theme.js';
import { helpCommand } from './commands/help.js';
import { azureBlobCommand } from './commands/azure-blob.js';
import { initializeTheme, getThemeManager } from './utils/theme/index.js';
import { getConfigManager } from './config/ConfigManager.js';
import { withInkInteractiveMode } from './utils/interactiveBuilderInk.js';
import ui from './utils/ui.js';
import { createRequire } from 'module';

// Read version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

// Create the main program instance
const program = new Command();

// Global reference to plugin manager
let pluginManager: PluginManager | null = null;

// Version info
const VERSION = pkg.version;
const CLI_NAME = 'Developer Toolbox';

// Configure the CLI program
program
  .name('devtoolbox')
  .description(`${CLI_NAME} - Your CLI companion for dev workflows`)
  .version(VERSION, '-v, --version', 'Display version number')
  .alias('dtb')
  .helpOption('-h, --help', 'Display help information')
  .action(() => {
    // Show welcome screen when no command is provided
    showWelcome();
  });

/**
 * Display welcome screen with quick start info
 */
function showWelcome(): void {
  const theme = getThemeManager();

  console.log(ui.cliBanner());
  console.log();

  // Quick start section
  console.log(ui.sectionHeader('Quick Start', { icon: '🚀', style: 'simple' }));
  console.log();
  console.log(ui.commandExample('dtb interactive', 'Launch guided menu'));
  console.log(ui.commandExample('dtb <command> -i', 'Build any command interactively'));
  console.log(ui.commandExample('dtb --help', 'Show all commands'));
  console.log();

  // Popular commands
  console.log(ui.sectionHeader('Popular Commands', { icon: '⭐', style: 'simple' }));
  console.log();

  const commands = [
    { cmd: 'rename', desc: 'Batch rename files with patterns' },
    { cmd: 'encrypt', desc: 'Encrypt files with AES-256' },
    { cmd: 'cleanup:node', desc: 'Clean node_modules' },
    { cmd: 'discover', desc: 'Find files by pattern' },
    { cmd: 'fileops', desc: 'Copy, move, delete files' },
  ];

  for (const { cmd, desc } of commands) {
    console.log(`  ${chalk.cyan('dtb ' + cmd.padEnd(14))} ${theme.muted(desc)}`);
  }

  console.log();
  console.log(ui.hint('Run dtb <command> --help for detailed usage'));
  console.log();
}

// Add error handling
program.configureOutput({
  writeErr: (str) => {
    if (str.includes('error:')) {
      console.error(chalk.red(str));
    } else {
      console.error(str);
    }
  },
  writeOut: (str) => {
    console.log(str);
  },
});

// Register commands with interactive mode support (using React Ink UI)
program.addCommand(withInkInteractiveMode(renameCommand));
program.addCommand(withInkInteractiveMode(regexBuilderCommand));
program.addCommand(withInkInteractiveMode(encryptCommand));
program.addCommand(withInkInteractiveMode(decryptCommand));
program.addCommand(withInkInteractiveMode(fileOpsCommand));
program.addCommand(withInkInteractiveMode(cleanupNodeCommand));
program.addCommand(withInkInteractiveMode(cleanupDotnetCommand));
program.addCommand(withInkInteractiveMode(discoverCommand));
program.addCommand(stateCommand);
program.addCommand(interactiveInkCommand);
program.addCommand(withInkInteractiveMode(sessionsCommand));
program.addCommand(withInkInteractiveMode(auditCommand));
program.addCommand(withInkInteractiveMode(keychainCommand));
program.addCommand(withInkInteractiveMode(authCommand));
program.addCommand(themeCommand);
program.addCommand(helpCommand);
program.addCommand(withInkInteractiveMode(azureBlobCommand));

// Tool registry management command
program.addCommand(toolsCommand);

// API server command with interactive mode
program.addCommand(withInkInteractiveMode(apiCommand));

// Plugin management command
const pluginCommand = new Command('plugin')
  .description('Manage plugins')
  .alias('pl');

pluginCommand
  .command('list')
  .description('List all loaded plugins')
  .action(async () => {
    if (!pluginManager) {
      console.log(chalk.yellow('Plugin system not initialized'));
      return;
    }

    const plugins = pluginManager.getLoadedPlugins();

    if (plugins.length === 0) {
      console.log(chalk.gray('No plugins loaded'));
      return;
    }

    console.log(chalk.blue.bold('\n📦 Loaded Plugins\n'));
    for (const plugin of plugins) {
      console.log(chalk.white.bold(`  ${plugin.metadata.name}`));
      console.log(chalk.gray(`    ID: ${plugin.metadata.id}`));
      console.log(chalk.gray(`    Version: ${plugin.metadata.version}`));
      console.log(chalk.gray(`    Description: ${plugin.metadata.description}`));
      if (plugin.metadata.author) {
        console.log(chalk.gray(`    Author: ${plugin.metadata.author}`));
      }
      console.log();
    }
  });

pluginCommand
  .command('reload')
  .description('Reload all plugins')
  .action(async () => {
    if (!pluginManager) {
      console.log(chalk.yellow('Plugin system not initialized'));
      return;
    }

    console.log(chalk.blue('\n🔄 Reloading plugins...\n'));
    const results = await pluginManager.reloadAllPlugins();

    // Re-register commands
    pluginManager.registerCommands(program);

    const loadedCount = results.filter(r => r.success).length;
    console.log(chalk.green(`\n✓ Reloaded ${loadedCount} plugin(s)`));
  });

pluginCommand
  .command('info <pluginId>')
  .description('Show detailed information about a plugin')
  .action(async (pluginId: string) => {
    if (!pluginManager) {
      console.log(chalk.yellow('Plugin system not initialized'));
      return;
    }

    const plugin = pluginManager.getPlugin(pluginId);

    if (!plugin) {
      console.log(chalk.red(`Plugin not found: ${pluginId}`));
      return;
    }

    console.log(chalk.blue.bold(`\n📦 ${plugin.metadata.name}\n`));
    console.log(chalk.white(`ID:          ${plugin.metadata.id}`));
    console.log(chalk.white(`Version:     ${plugin.metadata.version}`));
    console.log(chalk.white(`Description: ${plugin.metadata.description}`));

    if (plugin.metadata.author) {
      console.log(chalk.white(`Author:      ${plugin.metadata.author}`));
    }

    if (plugin.metadata.dependencies && plugin.metadata.dependencies.length > 0) {
      console.log(chalk.white('Dependencies:'));
      for (const dep of plugin.metadata.dependencies) {
        console.log(chalk.gray(`  - ${dep}`));
      }
    }

    const commands = plugin.getCommands?.();
    if (commands && commands.length > 0) {
      console.log(chalk.white('\nCommands:'));
      for (const cmd of commands) {
        console.log(chalk.gray(`  - ${cmd.command.name()}`));
      }
    }

    console.log();
  });

program.addCommand(pluginCommand);

// Global error handler
program.hook('postAction', async (thisCommand) => {
  // Execute plugin afterCommand hooks
  if (pluginManager) {
    await pluginManager.executeHook('afterCommand', thisCommand.name(), 0);
  }
});

// Initialize plugin system and parse
async function main() {
  try {
    // Initialize configuration system
    const configManager = getConfigManager();
    await configManager.initialize();

    // Initialize theme system with config
    const theme = configManager.get<'light' | 'dark' | 'auto'>('preferences.theme');
    const colorTheme = configManager.get<'default' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'pastel' | 'monochrome'>('preferences.colorTheme');
    const colorOutput = configManager.get<boolean>('preferences.colorOutput');

    initializeTheme({
      mode: theme,
      theme: colorTheme,
      colorOutput: colorOutput,
    });

    // Initialize plugin system
    pluginManager = await createPluginSystem(program);

    // Execute beforeStart hooks
    if (pluginManager) {
      await pluginManager.executeHook('beforeStart');
    }

    // Parse and execute CLI
    await program.parseAsync(process.argv);

  } catch (error) {
    // Use the comprehensive error handler
    errorHandler.handle(error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

main();
