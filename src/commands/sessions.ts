/**
 * Sessions Command
 *
 * Provides CLI commands for managing sessions and operation history using SQLite storage
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { initializeSQLiteStorage, type SQLiteStorageOptions } from '../storage/sqlite/index.js';

export const sessionsCommand = new Command('sessions')
  .description('Manage sessions and operation history (SQLite storage)')
  .alias('sess')
  .option('-d, --db-path <path>', 'Database file path', '.devtoolbox/sessions.db')
  .option('--debug', 'Enable debug logging');

// Helper function to get storage with options from command
async function getStorageWithOptions(command: Command): Promise<Awaited<ReturnType<typeof initializeSQLiteStorage>>> {
  // Walk up the command tree to find the sessions command or root
  let current: Command | null = command;
  let sessionsCmd: Command | null = null;

  while (current) {
    if (current.name() === 'sessions' || current.name() === 'sess') {
      sessionsCmd = current;
      break;
    }
    current = current.parent;
  }

  const options = sessionsCmd?.opts() || {};
  const storage = await initializeSQLiteStorage({
    dbPath: options.dbPath,
    debug: options.debug,
  });

  return storage;
}

// List sessions command
sessionsCommand
  .command('list')
  .description('List all sessions')
  .option('-a, --active-only', 'Show only active sessions')
  .option('-e, --exclude-expired', 'Exclude expired sessions')
  .option('-j, --json', 'Output as JSON')
  .option('-l, --limit <number>', 'Limit number of results', '10')
  .action(async function(this: Command, options) {
    try {
      const storage = await getStorageWithOptions(this);

      const sessions = storage.querySessions({
        isActive: options.activeOnly,
        excludeExpired: options.excludeExpired,
        limit: parseInt(options.limit),
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      });

      if (options.json) {
        console.log(JSON.stringify(sessions, null, 2));
      } else {
        if (sessions.length === 0) {
          console.log(chalk.gray('No sessions found'));
          return;
        }

        console.log(chalk.blue.bold(`📋 Sessions (${sessions.length}):\n`));
        for (const session of sessions) {
          const stateData = JSON.parse(session.stateData);
          console.log(`  ${chalk.cyan('ID:')} ${session.id}`);
          console.log(`    ${chalk.gray('Created:')} ${session.createdAt.toLocaleString()}`);
          console.log(`    ${chalk.gray('Updated:')} ${session.updatedAt.toLocaleString()}`);
          console.log(`    ${chalk.gray('Active:')} ${session.isActive ? chalk.green('✓') : chalk.red('✗')}`);
          if (session.expiresAt) {
            const isExpired = session.expiresAt < new Date();
            console.log(`    ${chalk.gray('Expires:')} ${isExpired ? chalk.red : chalk.gray}(session.expiresAt.toLocaleString())}`);
          }
          console.log(`    ${chalk.gray('State:')} ${JSON.stringify(stateData).substring(0, 100)}...`);
          console.log();
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Create session command
sessionsCommand
  .command('create')
  .description('Create a new session')
  .argument('[id]', 'Session ID (auto-generated if not provided)')
  .option('-s, --state <json>', 'Initial state data (JSON)')
  .option('-m, --metadata <json>', 'Session metadata (JSON)')
  .action(async function(this: Command, id, options) {
    try {
      const storage = await getStorageWithOptions(this);

      const sessionId = id || `session-${Date.now()}`;
      const stateData = options.state ? JSON.parse(options.state) : {};
      const metadata = options.metadata ? JSON.parse(options.metadata) : {};

      const session = storage.createSession(sessionId, stateData, metadata);

      console.log(chalk.green(`✓ Created session:`));
      console.log(`  ${chalk.cyan('ID:')} ${session.id}`);
      console.log(`  ${chalk.gray('Created:')} ${session.createdAt.toLocaleString()}`);
      console.log(`  ${chalk.gray('Expires:')} ${session.expiresAt?.toLocaleString()}`);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Get session command
sessionsCommand
  .command('get')
  .description('Get a session by ID')
  .argument('<id>', 'Session ID')
  .option('-j, --json', 'Output as JSON')
  .action(async function(this: Command, id, options) {
    try {
      const storage = await getStorageWithOptions(this);

      const session = storage.getSession(id);

      if (!session) {
        console.log(chalk.yellow(`Session "${id}" not found`));
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(session, null, 2));
      } else {
        const stateData = JSON.parse(session.stateData);
        const metadata = JSON.parse(session.metadata);

        console.log(chalk.blue.bold(`📊 Session: ${session.id}\n`));
        console.log(`  ${chalk.gray('Created:')} ${session.createdAt.toLocaleString()}`);
        console.log(`  ${chalk.gray('Updated:')} ${session.updatedAt.toLocaleString()}`);
        console.log(`  ${chalk.gray('Active:')} ${session.isActive ? chalk.green('✓') : chalk.red('✗')}`);
        if (session.expiresAt) {
          console.log(`  ${chalk.gray('Expires:')} ${session.expiresAt.toLocaleString()}`);
        }
        console.log(`\n  ${chalk.cyan.bold('Metadata:')}`);
        console.log(`    ${JSON.stringify(metadata, null, 2).split('\n').join('\n    ')}`);
        console.log(`\n  ${chalk.cyan.bold('State:')}`);
        console.log(`    ${JSON.stringify(stateData, null, 2).split('\n').join('\n    ')}`);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Update session command
sessionsCommand
  .command('update')
  .description('Update a session')
  .argument('<id>', 'Session ID')
  .option('-s, --state <json>', 'New state data (JSON)')
  .option('-m, --metadata <json>', 'New metadata (JSON)')
  .action(async function(this: Command, id, options) {
    try {
      const storage = await getStorageWithOptions(this);

      const stateData = options.state ? JSON.parse(options.state) : undefined;
      const metadata = options.metadata ? JSON.parse(options.metadata) : undefined;

      if (!stateData && !metadata) {
        console.log(chalk.yellow('Nothing to update. Specify --state or --metadata'));
        process.exit(1);
      }

      // Get current state to merge
      const current = storage.getSession(id);
      if (!current) {
        console.log(chalk.yellow(`Session "${id}" not found`));
        process.exit(1);
      }

      const currentState = JSON.parse(current.stateData);
      const newState = stateData ? { ...currentState, ...stateData } : currentState;

      const success = storage.updateSession(id, newState, metadata);

      if (success) {
        console.log(chalk.green(`✓ Updated session "${id}"`));
      } else {
        console.log(chalk.yellow(`Failed to update session "${id}"`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Delete session command
sessionsCommand
  .command('delete')
  .description('Delete a session')
  .argument('<id>', 'Session ID')
  .option('-f, --force', 'Delete without confirmation')
  .action(async function(this: Command, id, options) {
    try {
      const storage = await getStorageWithOptions(this);

      const session = storage.getSession(id);
      if (!session) {
        console.log(chalk.yellow(`Session "${id}" not found`));
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
            chalk.yellow(`Are you sure you want to delete session "${id}"? (y/N): `),
            resolve
          );
        });

        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log(chalk.gray('Operation cancelled'));
          return;
        }
      }

      const success = storage.deleteSession(id);

      if (success) {
        console.log(chalk.green(`✓ Deleted session "${id}"`));
      } else {
        console.log(chalk.yellow(`Failed to delete session "${id}"`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List operations command
sessionsCommand
  .command('operations')
  .description('List operation history')
  .argument('[session-id]', 'Filter by session ID')
  .option('-t, --type <type>', 'Filter by operation type')
  .option('-s, --status <status>', 'Filter by status')
  .option('-j, --json', 'Output as JSON')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .action(async function(this: Command, sessionId, options) {
    try {
      const storage = await getStorageWithOptions(this);

      const operations = storage.queryOperations({
        sessionId,
        operationType: options.type,
        status: options.status,
        limit: parseInt(options.limit),
        sortBy: 'startedAt',
        sortOrder: 'DESC',
      });

      if (options.json) {
        console.log(JSON.stringify(operations, null, 2));
      } else {
        if (operations.length === 0) {
          console.log(chalk.gray('No operations found'));
          return;
        }

        console.log(chalk.blue.bold(`📋 Operations (${operations.length}):\n`));
        for (const op of operations) {
          const statusColor = {
            pending: chalk.yellow,
            success: chalk.green,
            failed: chalk.red,
            cancelled: chalk.gray,
          }[op.status] || chalk.gray;

          console.log(`  ${chalk.cyan('ID:')} ${op.id}`);
          console.log(`    ${chalk.gray('Session:')} ${op.sessionId}`);
          console.log(`    ${chalk.gray('Type:')} ${op.operationType}`);
          console.log(`    ${chalk.gray('Target:')} ${op.target}`);
          console.log(`    ${chalk.gray('Status:')} ${statusColor(op.status)}`);
          console.log(`    ${chalk.gray('Started:')} ${op.startedAt.toLocaleString()}`);
          if (op.completedAt) {
            console.log(`    ${chalk.gray('Completed:')} ${op.completedAt.toLocaleString()}`);
          }
          if (op.duration) {
            console.log(`    ${chalk.gray('Duration:')} ${op.duration}ms`);
          }
          if (op.errorMessage) {
            console.log(`    ${chalk.red('Error:')} ${op.errorMessage}`);
          }
          console.log();
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Add operation command
sessionsCommand
  .command('add-operation')
  .description('Add an operation to history')
  .argument('<session-id>', 'Session ID')
  .argument('<type>', 'Operation type')
  .argument('<target>', 'Operation target')
  .option('-s, --status <status>', 'Operation status', 'success')
  .option('-r, --result <json>', 'Result data (JSON)')
  .option('-e, --error <message>', 'Error message (if failed)')
  .option('-m, --metadata <json>', 'Operation metadata (JSON)')
  .action(async function(this: Command, sessionId, type, target, options) {
    try {
      const storage = await getStorageWithOptions(this);

      const resultData = options.result ? JSON.parse(options.result) : undefined;
      const metadata = options.metadata ? JSON.parse(options.metadata) : undefined;

      const operation = storage.addOperation(
        sessionId,
        type,
        target,
        options.status as any,
        resultData,
        options.error,
        metadata
      );

      console.log(chalk.green(`✓ Added operation:`));
      console.log(`  ${chalk.cyan('ID:')} ${operation.id}`);
      console.log(`  ${chalk.gray('Type:')} ${operation.operationType}`);
      console.log(`  ${chalk.gray('Status:')} ${operation.status}`);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Statistics command
sessionsCommand
  .command('stats')
  .description('Show storage statistics')
  .option('-j, --json', 'Output as JSON')
  .action(async function(this: Command, options) {
    try {
      const storage = await getStorageWithOptions(this);

      const stats = storage.getStatistics();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(chalk.blue.bold('📊 Storage Statistics:\n'));
        console.log(`  Total Sessions: ${chalk.cyan(stats.totalSessions)}`);
        console.log(`  Active Sessions: ${chalk.cyan(stats.activeSessions)}`);
        console.log(`  Total Operations: ${chalk.cyan(stats.totalOperations)}`);
        console.log(`  Database Size: ${chalk.cyan((stats.dbSize / 1024).toFixed(2) + ' KB')}`);
        if (stats.oldestSession) {
          console.log(`  Oldest Session: ${chalk.cyan(stats.oldestSession.toLocaleString())}`);
        }
        if (stats.newestSession) {
          console.log(`  Newest Session: ${chalk.cyan(stats.newestSession.toLocaleString())}`);
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Cleanup command
sessionsCommand
  .command('cleanup')
  .description('Clean up expired sessions and old history')
  .action(async function(this: Command) {
    try {
      const storage = await getStorageWithOptions(this);

      const result = storage.cleanup();

      console.log(chalk.green(`✓ Cleanup complete:`));
      console.log(`  Sessions removed: ${chalk.cyan(result.sessionsRemoved)}`);
      console.log(`  Operations removed: ${chalk.cyan(result.operationsRemoved)}`);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
