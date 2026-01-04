/**
 * Tool Registry Commands
 *
 * CLI commands for managing the tool registry
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { promises as fs } from 'fs';
import { getGlobalRegistry, ToolCategory, ToolExecutionContext } from '../tools/index.js';

/**
 * Tool list command
 */
export const toolsListCommand = new Command('list')
  .description('List all registered tools')
  .option('-c, --category <category>', 'Filter by category')
  .option('-e, --enabled', 'Show only enabled tools')
  .option('-d, --disabled', 'Show only disabled tools')
  .option('-s, --search <query>', 'Search in name and description')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .action(async (options) => {
    const registry = getGlobalRegistry();

    const filter: any = {};

    if (options.category) {
      filter.category = options.category as ToolCategory;
    }

    if (options.enabled) {
      filter.enabled = true;
    }

    if (options.disabled) {
      filter.enabled = false;
    }

    if (options.search) {
      filter.search = options.search;
    }

    if (options.tags) {
      filter.tags = options.tags.split(',').map((t: string) => t.trim());
    }

    const tools = registry.searchTools(filter);

    if (tools.length === 0) {
      console.log(chalk.gray('No tools found matching the criteria'));
      return;
    }

    console.log(chalk.blue.bold(`\n🔧 Registered Tools (${tools.length})\n`));

    for (const tool of tools) {
      const status = tool.metadata.enabled
        ? chalk.green('●')
        : chalk.gray('○');
      const category = chalk.cyan(`[${tool.metadata.category}]`);

      console.log(`${status} ${chalk.white.bold(tool.metadata.name)} ${category}`);
      console.log(chalk.gray(`    ID: ${tool.metadata.id}`));
      console.log(chalk.gray(`    Description: ${tool.metadata.description}`));

      if (tool.metadata.tags.length > 0) {
        console.log(chalk.gray(`    Tags: ${tool.metadata.tags.join(', ')}`));
      }

      if (tool.metadata.author) {
        console.log(chalk.gray(`    Author: ${tool.metadata.author}`));
      }

      if (tool.metadata.version) {
        console.log(chalk.gray(`    Version: ${tool.metadata.version}`));
      }

      console.log();
    }
  });

/**
 * Tool info command
 */
export const toolsInfoCommand = new Command('info')
  .description('Show detailed information about a tool')
  .argument('<toolId>', 'Tool ID')
  .action(async (toolId: string) => {
    const registry = getGlobalRegistry();
    const tool = registry.getTool(toolId);

    if (!tool) {
      console.log(chalk.red(`Tool not found: ${toolId}`));
      return;
    }

    console.log(chalk.blue.bold(`\n🔧 ${tool.metadata.name}\n`));

    console.log(chalk.white.bold('Metadata:'));
    console.log(`  ID:          ${tool.metadata.id}`);
    console.log(`  Category:    ${tool.metadata.category}`);
    console.log(`  Description: ${tool.metadata.description}`);
    console.log(`  Enabled:     ${tool.metadata.enabled ? chalk.green('Yes') : chalk.red('No')}`);

    if (tool.metadata.version) {
      console.log(`  Version:     ${tool.metadata.version}`);
    }

    if (tool.metadata.author) {
      console.log(`  Author:      ${tool.metadata.author}`);
    }

    if (tool.metadata.tags.length > 0) {
      console.log(`  Tags:        ${tool.metadata.tags.join(', ')}`);
    }

    if (tool.metadata.docsUrl) {
      console.log(`  Docs:        ${tool.metadata.docsUrl}`);
    }

    if (tool.metadata.repoUrl) {
      console.log(`  Repository:  ${tool.metadata.repoUrl}`);
    }

    if (tool.metadata.dependencies && tool.metadata.dependencies.length > 0) {
      console.log(chalk.white.bold('\nDependencies:'));
      for (const dep of tool.metadata.dependencies) {
        const depTool = registry.getTool(dep);
        const status = depTool ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${status} ${dep}`);
      }
    }

    if (tool.getHelp) {
      const help = tool.getHelp();
      if (help) {
        console.log(chalk.white.bold('\nHelp:'));
        console.log(chalk.gray(help));
      }
    }

    console.log();
  });

/**
 * Tool stats command
 */
export const toolsStatsCommand = new Command('stats')
  .description('Show tool registry statistics')
  .action(async () => {
    const registry = getGlobalRegistry();
    const stats = registry.getStatistics();

    console.log(chalk.blue.bold('\n📊 Tool Registry Statistics\n'));

    console.log(chalk.white.bold('Overview:'));
    console.log(`  Total Tools:   ${stats.totalTools}`);
    console.log(`  Enabled:       ${chalk.green(stats.enabledTools)}`);
    console.log(`  Disabled:      ${chalk.gray(stats.disabledTools)}`);

    console.log(chalk.white.bold('\nBy Category:'));
    for (const [category, count] of Object.entries(stats.toolsByCategory)) {
      if (count > 0) {
        const bar = '█'.repeat(Math.min(count, 20));
        console.log(`  ${category.padEnd(12)} ${chalk.cyan(bar)} ${count}`);
      }
    }

    if (stats.lastRegistered) {
      const tool = registry.getTool(stats.lastRegistered);
      console.log(chalk.white.bold('\nLast Registered:'));
      console.log(`  ${tool?.metadata.name || stats.lastRegistered} (${stats.lastRegistered})`);
    }

    if (stats.lastUnregistered) {
      console.log(chalk.white.bold('\nLast Unregistered:'));
      console.log(`  ${stats.lastUnregistered}`);
    }

    console.log();
  });

/**
 * Tool enable command
 */
export const toolsEnableCommand = new Command('enable')
  .description('Enable a tool')
  .argument('<toolId>', 'Tool ID')
  .action(async (toolId: string) => {
    const registry = getGlobalRegistry();
    const result = await registry.enableTool(toolId);

    if (result.success) {
      console.log(chalk.green(`✓ Tool enabled: ${toolId}`));
    } else {
      console.log(chalk.red(`✗ Failed to enable tool: ${result.error}`));
      process.exit(1);
    }
  });

/**
 * Tool disable command
 */
export const toolsDisableCommand = new Command('disable')
  .description('Disable a tool')
  .argument('<toolId>', 'Tool ID')
  .action(async (toolId: string) => {
    const registry = getGlobalRegistry();
    const result = await registry.disableTool(toolId);

    if (result.success) {
      console.log(chalk.yellow(`Tool disabled: ${toolId}`));
    } else {
      console.log(chalk.red(`✗ Failed to disable tool: ${result.error}`));
      process.exit(1);
    }
  });

/**
 * Tool execute command
 */
export const toolsExecuteCommand = new Command('execute')
  .description('Execute a tool')
  .argument('<toolId>', 'Tool ID')
  .argument('[args...]', 'Arguments to pass to the tool')
  .option('-o, --option <key=value>', 'Options to pass to the tool (can be used multiple times)', [])
  .action(async (toolId: string, args: string[], options) => {
    const registry = getGlobalRegistry();

    // Parse options
    const parsedOptions: Record<string, string> = {};
    if (Array.isArray(options.option)) {
      for (const opt of options.option) {
        const [key, ...valueParts] = opt.split('=');
        parsedOptions[key] = valueParts.join('=');
      }
    } else if (options.option) {
      const [key, ...valueParts] = options.option.split('=');
      parsedOptions[key] = valueParts.join('=');
    }

    const context: ToolExecutionContext = {
      args,
      options: parsedOptions,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    };

    const result = await registry.executeTool(toolId, context);

    if (result.success) {
      console.log(chalk.green(`✓ Tool executed successfully`));
      if (result.data) {
        console.log(chalk.gray('\nOutput:'));
        console.log(JSON.stringify(result.data, null, 2));
      }
    } else {
      console.log(chalk.red(`✗ Tool execution failed: ${result.error}`));
      process.exit(result.exitCode);
    }
  });

/**
 * Tool search command
 */
export const toolsSearchCommand = new Command('search')
  .description('Search for tools')
  .argument('<query>', 'Search query')
  .option('-c, --category <category>', 'Filter by category')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .action(async (query: string, options) => {
    const registry = getGlobalRegistry();

    const filter: any = {
      search: query,
    };

    if (options.category) {
      filter.category = options.category as ToolCategory;
    }

    if (options.tags) {
      filter.tags = options.tags.split(',').map((t: string) => t.trim());
    }

    const tools = registry.searchTools(filter);

    if (tools.length === 0) {
      console.log(chalk.gray(`No tools found matching "${query}"`));
      return;
    }

    console.log(
      chalk.blue.bold(`\n🔍 Search Results for "${query}" (${tools.length})\n`)
    );

    for (const tool of tools) {
      const status = tool.metadata.enabled
        ? chalk.green('●')
        : chalk.gray('○');
      const category = chalk.cyan(`[${tool.metadata.category}]`);

      console.log(`${status} ${chalk.white.bold(tool.metadata.name)} ${category}`);
      console.log(chalk.gray(`    ID: ${tool.metadata.id}`));
      console.log(chalk.gray(`    Description: ${tool.metadata.description}`));
      console.log();
    }
  });

/**
 * Tool categories command
 */
export const toolsCategoriesCommand = new Command('categories')
  .description('List all tool categories')
  .action(async () => {
    const categories: ToolCategory[] = [
      'file',
      'code',
      'git',
      'build',
      'test',
      'deploy',
      'utility',
      'api',
      'database',
      'other',
    ];

    console.log(chalk.blue.bold('\n📂 Tool Categories\n'));

    for (const category of categories) {
      console.log(`  ${chalk.cyan(category.padEnd(12))} - ${getCategoryDescription(category)}`);
    }

    console.log();
  });

/**
 * Get category description
 */
function getCategoryDescription(category: ToolCategory): string {
  const descriptions: Record<ToolCategory, string> = {
    file: 'File manipulation and management tools',
    code: 'Code analysis and transformation tools',
    git: 'Git version control tools',
    build: 'Build and compilation tools',
    test: 'Testing and validation tools',
    deploy: 'Deployment and release tools',
    utility: 'General utility tools',
    api: 'API and HTTP tools',
    database: 'Database management tools',
    other: 'Other miscellaneous tools',
  };

  return descriptions[category];
}

/**
 * Export all tool commands
 */
export const toolsCommand = new Command('tools')
  .description('Manage tool registry')
  .alias('tool');

toolsCommand.addCommand(toolsListCommand);
toolsCommand.addCommand(toolsInfoCommand);
toolsCommand.addCommand(toolsStatsCommand);
toolsCommand.addCommand(toolsEnableCommand);
toolsCommand.addCommand(toolsDisableCommand);
toolsCommand.addCommand(toolsExecuteCommand);
toolsCommand.addCommand(toolsSearchCommand);
toolsCommand.addCommand(toolsCategoriesCommand);

export { toolsCommand as default };
