/**
 * Authentication Command
 *
 * CLI commands for authentication and session management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getAuthManager } from '../auth/AuthManager.js';
import type { AuthMethod, AuthConfigOptions } from '../auth/types.js';
import { promptPassword } from '../utils/password.js';

export const authCommand = new Command('auth')
  .description('Manage authentication and sessions')
  .alias('authenticate');

// Login command
authCommand
  .command('login')
  .description('Authenticate with username and password')
  .option('-u, --username <username>', 'Username')
  .option('-p, --password <password>', 'Password (not recommended, use interactive prompt)')
  .option('-m, --method <method>', 'Authentication method (password, token)', 'password')
  .action(async (options) => {
    const authManager = getAuthManager();

    console.log(chalk.blue.bold('🔐 Authentication\n'));

    try {
      let username = options.username;
      let password = options.password;
      let method = options.method as AuthMethod;

      // Prompt for username if not provided
      if (!username) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        username = await new Promise<string>((resolve) => {
          rl.question(chalk.white('Username: '), resolve);
        });

        rl.close();
      }

      // Prompt for password if using password method and not provided
      if (method === 'password' && !password) {
        try {
          password = await promptPassword('Password: ');
        } catch (error) {
          console.error(chalk.red('\n❌ Password entry cancelled'));
          process.exit(1);
        }
      }

      // Authenticate
      const result = await authManager.authenticate(
        {
          method,
          username,
          password,
        },
        {
          ipAddress: 'localhost',
          userAgent: 'devtoolbox-cli',
        }
      );

      if (result.success) {
        console.log(chalk.green('\n✓ Authentication successful!\n'));
        console.log(`  ${chalk.cyan('User:')} ${result.session?.username}`);
        console.log(`  ${chalk.cyan('Session ID:')} ${result.session?.id}`);
        console.log(`  ${chalk.cyan('Token:')} ${result.token?.substring(0, 20)}...`);
        console.log(`  ${chalk.cyan('Expires:')} ${result.session?.expiresAt.toLocaleString()}`);
        console.log();
        console.log(chalk.gray('Use this token for API calls:'));
        console.log(chalk.gray(`  Authorization: Bearer ${result.token}\n`));
      } else {
        console.error(chalk.red(`\n❌ Authentication failed: ${result.error}\n`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Logout command
authCommand
  .command('logout')
  .description('Logout and invalidate session')
  .option('-s, --session-id <sessionId>', 'Session ID')
  .option('-u, --user-id <userId>', 'User ID')
  .action(async (options) => {
    const authManager = getAuthManager();

    console.log(chalk.blue.bold('🔐 Logout\n'));

    if (!options.sessionId || !options.userId) {
      console.error(chalk.red('❌ Session ID and User ID are required'));
      console.error(chalk.gray('Use: devtoolbox auth logout --session-id <id> --user-id <id>\n'));
      process.exit(1);
    }

    try {
      const success = await authManager.logout(options.sessionId, options.userId);

      if (success) {
        console.log(chalk.green('\n✓ Logged out successfully\n'));
      } else {
        console.error(chalk.red('\n❌ Logout failed. Session not found or invalid user.\n'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Validate token command
authCommand
  .command('validate')
  .description('Validate an authentication token')
  .argument('<token>', 'Authentication token to validate')
  .action(async (token) => {
    const authManager = getAuthManager();

    console.log(chalk.blue.bold('🔐 Token Validation\n'));

    try {
      const result = await authManager.validateToken(token, {
        ipAddress: 'localhost',
        userAgent: 'devtoolbox-cli',
      });

      if (result.valid) {
        console.log(chalk.green('✓ Token is valid\n'));
        console.log(`  ${chalk.cyan('User ID:')} ${result.userId}`);
        console.log(`  ${chalk.cyan('Username:')} ${result.username}`);
        console.log(`  ${chalk.cyan('Role:')} ${result.role}`);
        console.log(`  ${chalk.cyan('Session ID:')} ${result.sessionId}`);
        console.log(`  ${chalk.cyan('Status:')} ${result.status}\n`);
      } else {
        console.error(chalk.red(`❌ Token is invalid: ${result.error}\n`));
        console.error(`  ${chalk.gray('Status:')} ${result.status}\n`);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Refresh token command
authCommand
  .command('refresh')
  .description('Refresh an authentication token')
  .argument('<refreshToken>', 'Refresh token')
  .action(async (refreshToken) => {
    const authManager = getAuthManager();

    console.log(chalk.blue.bold('🔐 Token Refresh\n'));

    try {
      const result = await authManager.refreshToken(refreshToken, {
        ipAddress: 'localhost',
        userAgent: 'devtoolbox-cli',
      });

      if (result.success) {
        console.log(chalk.green('✓ Token refreshed successfully\n'));
        console.log(`  ${chalk.cyan('New Token:')} ${result.token?.substring(0, 20)}...`);
        console.log(`  ${chalk.cyan('New Refresh Token:')} ${result.refreshToken?.substring(0, 20)}...\n`);
        console.log(chalk.gray('Use the new token for subsequent API calls.\n'));
      } else {
        console.error(chalk.red(`\n❌ Token refresh failed: ${result.error}\n`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session info command
authCommand
  .command('session')
  .description('Get session information from token')
  .argument('<token>', 'Authentication token')
  .action(async (token) => {
    const authManager = getAuthManager();

    console.log(chalk.blue.bold('🔐 Session Information\n'));

    try {
      const sessionContext = await authManager.getSessionContext(token, {
        ipAddress: 'localhost',
        userAgent: 'devtoolbox-cli',
      });

      if (sessionContext) {
        console.log(chalk.green('✓ Session found\n'));
        console.log(`  ${chalk.cyan('Session ID:')} ${sessionContext.sessionId}`);
        console.log(`  ${chalk.cyan('User ID:')} ${sessionContext.userId}`);
        console.log(`  ${chalk.cyan('Username:')} ${sessionContext.username}`);
        console.log(`  ${chalk.cyan('Role:')} ${sessionContext.role}`);
        console.log(`  ${chalk.cyan('IP Address:')} ${sessionContext.ipAddress || 'N/A'}`);
        console.log(`  ${chalk.cyan('User Agent:')} ${sessionContext.userAgent || 'N/A'}`);
        console.log(`  ${chalk.cyan('Session Data:')} ${JSON.stringify(sessionContext.sessionData).substring(0, 100)}...\n`);
      } else {
        console.error(chalk.red('\n❌ Session not found or token is invalid\n'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Statistics command
authCommand
  .command('stats')
  .description('Show authentication statistics')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    const authManager = getAuthManager();

    try {
      const stats = await authManager.getStatistics();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(chalk.blue.bold('📊 Authentication Statistics\n'));
        console.log(`  Total Users: ${chalk.cyan(stats.totalUsers)}`);
        console.log(`  Active Users: ${chalk.cyan(stats.activeUsers)}`);
        console.log(`  Total Sessions: ${chalk.cyan(stats.totalSessions)}`);
        console.log(`  Active Sessions: ${chalk.cyan(stats.activeSessions)}`);
        console.log(`  Total Tokens: ${chalk.cyan(stats.totalTokens)}`);
        console.log(`  Active Tokens: ${chalk.cyan(stats.activeTokens)}`);
        console.log(`  Auth Attempts Today: ${chalk.cyan(stats.authAttemptsToday)}`);
        console.log(`  Successful Today: ${chalk.green(stats.successfulAuthToday)}`);
        console.log(`  Failed Today: ${chalk.red(stats.failedAuthToday)}\n`);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
