/**
 * Audit Log Command
 *
 * Provides CLI commands for viewing and managing audit logs
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { initializeSQLiteStorage } from '../storage/sqlite/index.js';

export const auditCommand = new Command('audit')
  .description('Manage and view audit logs')
  .alias('log')
  .option('-d, --db-path <path>', 'Database file path', '.devtoolbox/sessions.db')
  .option('--debug', 'Enable debug logging');

// Helper function to get storage with options from command
async function getStorageWithOptions(command: Command) {
  // Walk up the command tree to find the audit command or root
  let current: Command | null = command;
  let auditCmd: Command | null = null;

  while (current) {
    if (current.name() === 'audit' || current.name() === 'log') {
      auditCmd = current;
      break;
    }
    current = current.parent;
  }

  const options = auditCmd?.opts() || {};
  const storage = await initializeSQLiteStorage({
    dbPath: options.dbPath,
    debug: options.debug,
  });

  return storage;
}

// List audit logs command
auditCommand
  .command('list')
  .description('List audit log entries')
  .option('-t, --type <type...>', 'Filter by event type(s)')
  .option('-s, --severity <severity...>', 'Filter by severity level(s)')
  .option('-u, --user <id>', 'Filter by user ID')
  .option('-S, --session <id>', 'Filter by session ID')
  .option('--status <status>', 'Filter by status')
  .option('-a, --action <pattern>', 'Filter by action pattern')
  .option('--target <pattern>', 'Filter by target pattern')
  .option('--start <date>', 'Filter by start date (ISO 8601)')
  .option('--end <date>', 'Filter by end date (ISO 8601)')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .option('-j, --json', 'Output as JSON')
  .action(async function(this: Command, options) {
    try {
      const storage = await getStorageWithOptions(this);

      const queryOptions: any = {};

      if (options.type) {
        queryOptions.eventType = options.type;
      }

      if (options.severity) {
        queryOptions.severity = options.severity;
      }

      if (options.user) {
        queryOptions.userId = options.user;
      }

      if (options.session) {
        queryOptions.sessionId = options.session;
      }

      if (options.status) {
        queryOptions.status = options.status;
      }

      if (options.action) {
        queryOptions.action = options.action;
      }

      if (options.target) {
        queryOptions.targetPattern = options.target;
      }

      if (options.start) {
        queryOptions.startDate = new Date(options.start);
      }

      if (options.end) {
        queryOptions.endDate = new Date(options.end);
      }

      queryOptions.limit = parseInt(options.limit);
      queryOptions.sortBy = 'timestamp';
      queryOptions.sortOrder = 'DESC';

      const auditLogs = storage.queryAuditLogs(queryOptions);

      if (options.json) {
        console.log(JSON.stringify(auditLogs, null, 2));
      } else {
        if (auditLogs.length === 0) {
          console.log(chalk.gray('No audit log entries found'));
          return;
        }

        console.log(chalk.blue.bold(`📋 Audit Logs (${auditLogs.length}):\n`));
        for (const entry of auditLogs) {
          const severityColor = {
            info: chalk.blue,
            warning: chalk.yellow,
            error: chalk.red,
            critical: chalk.red.bold,
          }[entry.severity] || chalk.gray;

          const statusColor = {
            started: chalk.yellow,
            success: chalk.green,
            failed: chalk.red,
            cancelled: chalk.gray,
          }[entry.status] || chalk.gray;

          console.log(`  ${chalk.cyan('ID:')} ${entry.id}`);
          console.log(`    ${chalk.gray('Timestamp:')} ${entry.timestamp.toLocaleString()}`);
          console.log(`    ${chalk.gray('Type:')} ${entry.eventType}`);
          console.log(`    ${chalk.gray('Severity:')} ${severityColor(entry.severity)}`);
          console.log(`    ${chalk.gray('Action:')} ${entry.action}`);

          if (entry.target) {
            console.log(`    ${chalk.gray('Target:')} ${entry.target}`);
          }

          console.log(`    ${chalk.gray('Status:')} ${statusColor(entry.status)}`);

          if (entry.userId) {
            console.log(`    ${chalk.gray('User:')} ${entry.userId}`);
          }

          if (entry.sessionId) {
            console.log(`    ${chalk.gray('Session:')} ${entry.sessionId}`);
          }

          if (entry.statusCode) {
            console.log(`    ${chalk.gray('Status Code:')} ${entry.statusCode}`);
          }

          if (entry.duration) {
            console.log(`    ${chalk.gray('Duration:')} ${entry.duration}ms`);
          }

          if (entry.errorMessage) {
            console.log(`    ${chalk.red('Error:')} ${entry.errorMessage}`);
          }

          if (entry.resultData) {
            try {
              const result = JSON.parse(entry.resultData);
              console.log(`    ${chalk.gray('Result:')} ${JSON.stringify(result).substring(0, 100)}...`);
            } catch {
              console.log(`    ${chalk.gray('Result:')} ${entry.resultData.substring(0, 100)}...`);
            }
          }

          console.log();
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Show audit log entry by ID
auditCommand
  .command('get')
  .description('Get an audit log entry by ID')
  .argument('<id>', 'Audit log entry ID')
  .option('-j, --json', 'Output as JSON')
  .action(async function(this: Command, id, options) {
    try {
      const storage = await getStorageWithOptions(this);

      const entry = storage.getAuditLog(id);

      if (!entry) {
        console.log(chalk.yellow(`Audit log entry "${id}" not found`));
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(entry, null, 2));
      } else {
        const severityColor = {
          info: chalk.blue,
          warning: chalk.yellow,
          error: chalk.red,
          critical: chalk.red.bold,
        }[entry.severity] || chalk.gray;

        const statusColor = {
          started: chalk.yellow,
          success: chalk.green,
          failed: chalk.red,
          cancelled: chalk.gray,
        }[entry.status] || chalk.gray;

        console.log(chalk.blue.bold(`📊 Audit Log Entry: ${entry.id}\n`));
        console.log(`  ${chalk.gray('Timestamp:')} ${entry.timestamp.toLocaleString()}`);
        console.log(`  ${chalk.gray('Event Type:')} ${entry.eventType}`);
        console.log(`  ${chalk.gray('Severity:')} ${severityColor(entry.severity)}`);
        console.log(`  ${chalk.gray('Action:')} ${entry.action}`);
        console.log(`  ${chalk.gray('Status:')} ${statusColor(entry.status)}`);

        if (entry.target) {
          console.log(`  ${chalk.gray('Target:')} ${entry.target}`);
        }

        if (entry.userId) {
          console.log(`  ${chalk.gray('User ID:')} ${entry.userId}`);
        }

        if (entry.sessionId) {
          console.log(`  ${chalk.gray('Session ID:')} ${entry.sessionId}`);
        }

        if (entry.ipAddress) {
          console.log(`  ${chalk.gray('IP Address:')} ${entry.ipAddress}`);
        }

        if (entry.userAgent) {
          console.log(`  ${chalk.gray('User Agent:')} ${entry.userAgent}`);
        }

        if (entry.statusCode) {
          console.log(`  ${chalk.gray('Status Code:')} ${entry.statusCode}`);
        }

        if (entry.duration) {
          console.log(`  ${chalk.gray('Duration:')} ${entry.duration}ms`);
        }

        if (entry.errorMessage) {
          console.log(`\n  ${chalk.red.bold('Error Message:')}`);
          console.log(`    ${entry.errorMessage}`);
        }

        if (entry.resultData) {
          console.log(`\n  ${chalk.cyan.bold('Result Data:')}`);
          try {
            const result = JSON.parse(entry.resultData);
            console.log(`    ${JSON.stringify(result, null, 2).split('\n').join('\n    ')}`);
          } catch {
            console.log(`    ${entry.resultData}`);
          }
        }

        if (entry.changes) {
          console.log(`\n  ${chalk.cyan.bold('Changes:')}`);
          try {
            const changes = JSON.parse(entry.changes);
            console.log(`    ${JSON.stringify(changes, null, 2).split('\n').join('\n    ')}`);
          } catch {
            console.log(`    ${entry.changes}`);
          }
        }

        if (entry.metadata) {
          console.log(`\n  ${chalk.cyan.bold('Metadata:')}`);
          try {
            const metadata = JSON.parse(entry.metadata);
            console.log(`    ${JSON.stringify(metadata, null, 2).split('\n').join('\n    ')}`);
          } catch {
            console.log(`    ${entry.metadata}`);
          }
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Statistics command
auditCommand
  .command('stats')
  .description('Show audit statistics')
  .option('--start <date>', 'Filter by start date (ISO 8601)')
  .option('--end <date>', 'Filter by end date (ISO 8601)')
  .option('-j, --json', 'Output as JSON')
  .action(async function(this: Command, options) {
    try {
      const storage = await getStorageWithOptions(this);

      const startDate = options.start ? new Date(options.start) : undefined;
      const endDate = options.end ? new Date(options.end) : undefined;

      const stats = storage.getAuditStatistics(startDate, endDate);

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(chalk.blue.bold('📊 Audit Statistics:\n'));
        console.log(`  Total Entries: ${chalk.cyan(stats.totalEntries)}`);

        if (stats.oldestEntry) {
          console.log(`  Oldest Entry: ${chalk.cyan(stats.oldestEntry.toLocaleString())}`);
        }

        if (stats.newestEntry) {
          console.log(`  Newest Entry: ${chalk.cyan(stats.newestEntry.toLocaleString())}`);
        }

        console.log(`  Failed Operations: ${chalk.red(stats.failedOperations)}`);

        if (stats.averageDuration > 0) {
          console.log(`  Average Duration: ${chalk.cyan(stats.averageDuration.toFixed(2) + 'ms')}`);
        }

        console.log(`\n  ${chalk.cyan.bold('By Event Type:')}`);
        Object.entries(stats.entriesByEventType).forEach(([type, count]) => {
          console.log(`    ${type}: ${chalk.cyan(count)}`);
        });

        console.log(`\n  ${chalk.cyan.bold('By Severity:')}`);
        Object.entries(stats.entriesBySeverity).forEach(([severity, count]) => {
          const color = {
            info: chalk.blue,
            warning: chalk.yellow,
            error: chalk.red,
            critical: chalk.red.bold,
          }[severity] || chalk.gray;
          console.log(`    ${color(severity)}: ${chalk.cyan(count)}`);
        });

        console.log(`\n  ${chalk.cyan.bold('By Status:')}`);
        Object.entries(stats.entriesByStatus).forEach(([status, count]) => {
          const color = {
            started: chalk.yellow,
            success: chalk.green,
            failed: chalk.red,
            cancelled: chalk.gray,
          }[status] || chalk.gray;
          console.log(`    ${color(status)}: ${chalk.cyan(count)}`);
        });

        if (Object.keys(stats.operationsByUser).length > 0) {
          console.log(`\n  ${chalk.cyan.bold('By User:')}`);
          Object.entries(stats.operationsByUser).forEach(([user, count]) => {
            console.log(`    ${user}: ${chalk.cyan(count)}`);
          });
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Cleanup command
auditCommand
  .command('cleanup')
  .description('Clean up old audit logs based on retention policy')
  .action(async function(this: Command) {
    try {
      const storage = await getStorageWithOptions(this);

      const result = storage.cleanupAuditLogs();

      console.log(chalk.green(`✓ Cleanup complete:`));
      console.log(`  Entries removed: ${chalk.cyan(result.entriesRemoved)}`);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Export command
auditCommand
  .command('export')
  .description('Export audit logs to a file')
  .option('-o, --output <file>', 'Output file path', 'audit-export.json')
  .option('-t, --type <type...>', 'Filter by event type(s)')
  .option('-s, --severity <severity...>', 'Filter by severity level(s)')
  .option('--start <date>', 'Filter by start date (ISO 8601)')
  .option('--end <date>', 'Filter by end date (ISO 8601)')
  .option('-l, --limit <number>', 'Limit number of results', '1000')
  .action(async function(this: Command, options) {
    try {
      const { promises: fs } = await import('fs');

      const storage = await getStorageWithOptions(this);

      const queryOptions: any = {
        limit: parseInt(options.limit),
        sortBy: 'timestamp',
        sortOrder: 'DESC',
      };

      if (options.type) {
        queryOptions.eventType = options.type;
      }

      if (options.severity) {
        queryOptions.severity = options.severity;
      }

      if (options.start) {
        queryOptions.startDate = new Date(options.start);
      }

      if (options.end) {
        queryOptions.endDate = new Date(options.end);
      }

      const auditLogs = storage.queryAuditLogs(queryOptions);

      await fs.writeFile(options.output, JSON.stringify(auditLogs, null, 2));

      console.log(chalk.green(`✓ Exported ${chalk.cyan(auditLogs.length)} audit log entries to ${chalk.cyan(options.output)}`));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
