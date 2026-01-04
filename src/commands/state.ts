/**
 * State Management Command
 *
 * Provides CLI commands for managing global application state
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getGlobalStateManager } from '../state/index.js';

export const stateCommand = new Command('state')
  .description('Manage global application state')
  .alias('st')
  .option('-p, --persist', 'Enable state persistence to file', true)
  .option('--no-persist', 'Disable state persistence');

// Helper function to get manager with options from parent command
async function getManagerWithOptions(command: Command): Promise<ReturnType<typeof getGlobalStateManager>> {
  // Walk up the command tree to find the state command or root
  let current: Command | null = command;
  let stateCmd: Command | null = null;

  while (current) {
    if (current.name() === 'state' || current.name() === 'st') {
      stateCmd = current;
      break;
    }
    current = current.parent;
  }

  const parentOptions = stateCmd?.opts() || { persist: true };
  const manager = getGlobalStateManager({
    enablePersistence: parentOptions.persist,
    debug: false,
  });
  await manager.initialize();
  return manager;
}

// Get command
stateCommand
  .command('get')
  .description('Get a value from state')
  .argument('<key>', 'State key (supports dot notation)')
  .option('-j, --json', 'Output as JSON')
  .action(async function(this: Command, key, options) {
    try {
      const manager = await getManagerWithOptions(this);
      const value = manager.get(key);

      if (value === undefined) {
        console.log(chalk.yellow(`Key "${key}" not found in state`));
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(chalk.blue.bold(`📊 ${key}:`));
        console.log(JSON.stringify(value, null, 2));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Set command
stateCommand
  .command('set')
  .description('Set a value in state')
  .argument('<key>', 'State key (supports dot notation)')
  .argument('<value>', 'Value to set (JSON-formatted)')
  .option('-t, --type <type>', 'Value type: string, number, boolean, json', 'json')
  .action(async function(this: Command, key, value, options) {
    try {
      const manager = await getManagerWithOptions(this);

      let parsedValue: unknown;

      switch (options.type) {
        case 'string':
          parsedValue = value;
          break;
        case 'number':
          parsedValue = parseFloat(value);
          if (isNaN(parsedValue as number)) {
            throw new Error(`Invalid number: ${value}`);
          }
          break;
        case 'boolean':
          parsedValue = value.toLowerCase() === 'true';
          break;
        case 'json':
        default:
          try {
            parsedValue = JSON.parse(value);
          } catch {
            // If parsing fails, treat as string
            parsedValue = value;
          }
          break;
      }

      await manager.set(key, parsedValue);
      await manager.save(); // Ensure state is persisted

      console.log(chalk.green(`✓ Set ${key} =`), parsedValue);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Delete command
stateCommand
  .command('delete')
  .description('Delete a value from state')
  .argument('<key>', 'State key to delete')
  .option('-f, --force', 'Delete without confirmation')
  .action(async function(this: Command, key, options) {
    try {
      const manager = await getManagerWithOptions(this);

      if (!manager.has(key)) {
        console.log(chalk.yellow(`Key "${key}" not found in state`));
        process.exit(1);
      }

      if (!options.force) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(
            chalk.yellow(`Are you sure you want to delete "${key}"? (y/N): `),
            resolve
          );
        });

        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log(chalk.gray('Operation cancelled'));
          return;
        }
      }

      await manager.delete(key);
      console.log(chalk.green(`✓ Deleted "${key}" from state`));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List command
stateCommand
  .command('list')
  .description('List all keys in state')
  .option('-p, --pattern <pattern>', 'Filter keys by glob pattern')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const manager = await getManagerWithOptions(stateCommand);

      const keys = manager.keys(options.pattern);

      if (keys.length === 0) {
        if (options.json) {
          console.log(JSON.stringify({}, null, 2));
        } else {
          console.log(chalk.gray('No keys found in state'));
        }
        return;
      }

      if (options.json) {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          result[key] = manager.get(key);
        }
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.blue.bold(`📋 State Keys (${keys.length}):\n`));
        for (const key of keys) {
          const value = manager.get(key);
          const valueStr = JSON.stringify(value);
          const truncated = valueStr.length > 50
            ? valueStr.substring(0, 47) + '...'
            : valueStr;
          console.log(`  ${chalk.cyan(key)}: ${chalk.gray(truncated)}`);
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Clear command
stateCommand
  .command('clear')
  .description('Clear all state')
  .option('-f, --force', 'Clear without confirmation')
  .action(async (options) => {
    try {
      const manager = await getManagerWithOptions(stateCommand);

      if (!options.force) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(
            chalk.red('Are you sure you want to clear all state? (y/N): '),
            resolve
          );
        });

        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log(chalk.gray('Operation cancelled'));
          return;
        }
      }

      await manager.clear();
      console.log(chalk.green('✓ Cleared all state'));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Statistics command
stateCommand
  .command('stats')
  .description('Show state statistics')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const manager = await getManagerWithOptions(stateCommand);

      const stats = manager.getStatistics();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(chalk.blue.bold('📊 State Statistics:\n'));
        console.log(`  Total Keys: ${chalk.cyan(stats.totalKeys)}`);
        console.log(`  Namespaces: ${chalk.cyan(stats.namespaceCount)}`);
        console.log(`  Listeners: ${chalk.cyan(stats.listenerCount)}`);
        console.log(`  History Size: ${chalk.cyan(stats.historySize)}`);
        console.log(`  Memory Usage: ${chalk.cyan((stats.memoryUsage / 1024).toFixed(2) + ' KB')}`);
        console.log(`  Last Modified: ${chalk.cyan(stats.lastModified?.toISOString() || 'N/A')}`);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Export command
stateCommand
  .command('export')
  .description('Export state to a file')
  .argument('<file>', 'Output file path')
  .option('-d, --description <text>', 'Snapshot description')
  .action(async function(this: Command, file, options) {
    try {
      const manager = await getManagerWithOptions(this);

      const snapshot = manager.createSnapshot({
        description: options.description,
      });

      const { promises: fs } = await import('fs');
      await fs.writeFile(
        file,
        JSON.stringify(snapshot, null, 2),
        'utf-8'
      );

      console.log(chalk.green(`✓ Exported state to ${file}`));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Import command
stateCommand
  .command('import')
  .description('Import state from a file')
  .argument('<file>', 'Input file path')
  .action(async (file) => {
    try {
      const manager = await getManagerWithOptions(stateCommand);

      const { promises: fs } = await import('fs');
      const content = await fs.readFile(file, 'utf-8');
      const snapshot = JSON.parse(content);

      await manager.restoreSnapshot(snapshot);

      console.log(chalk.green(`✓ Imported state from ${file}`));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Watch command (demonstrate state changes)
stateCommand
  .command('watch')
  .description('Watch state changes in real-time')
  .option('-k, --key <key>', 'Watch specific key (default: all keys)')
  .action(async (options) => {
    try {
      const manager = await getManagerWithOptions(stateCommand);

      console.log(chalk.blue.bold('👀 Watching state changes...'));
      console.log(chalk.gray('Press Ctrl+C to stop\n'));

      manager.onAny((event) => {
        if (options.key && event.key !== options.key && !event.key.startsWith(options.key + '.')) {
          return;
        }

        const timestamp = event.timestamp.toLocaleTimeString();
        console.log(
          chalk.gray(`[${timestamp}]`),
          chalk.cyan(event.key),
          chalk.gray('=>'),
          chalk.green(JSON.stringify(event.newValue))
        );
      });

      // Keep process alive
      await new Promise(() => {});
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Undo command
stateCommand
  .command('undo')
  .description('Undo the last state change')
  .action(async () => {
    try {
      const manager = await getManagerWithOptions(stateCommand);

      const success = await manager.undo();

      if (success) {
        console.log(chalk.green('✓ Undo successful'));
      } else {
        console.log(chalk.yellow('Nothing to undo'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Redo command
stateCommand
  .command('redo')
  .description('Redo the last undone change')
  .action(async () => {
    try {
      const manager = await getManagerWithOptions(stateCommand);

      const success = await manager.redo();

      if (success) {
        console.log(chalk.green('✓ Redo successful'));
      } else {
        console.log(chalk.yellow('Nothing to redo'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
