/**
 * API Plugin Management Command
 *
 * CLI command to start the REST API server for dynamic plugin management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createApiServer } from '../api/index.js';
import { PluginManager } from '../plugins/PluginManager.js';

// Store reference to API server for cleanup
let apiServer: Awaited<ReturnType<typeof createApiServer>> | null = null;

/**
 * Create the API command
 */
export const apiCommand = new Command('api')
  .description('Start the REST API server for plugin management')
  .alias('serve')
  .option('-p, --port <number>', 'Port to run the API server on', '3000')
  .option('-h, --host <string>', 'Host to bind the API server to', 'localhost')
  .option('--no-cors', 'Disable CORS')
  .option('-k, --api-key <string>', 'API key for authentication')
  .option('--no-rate-limit', 'Disable rate limiting')
  .option('--rate-limit-max <number>', 'Max requests per minute', '60')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔌 Plugin API Server\n'));

    // Parse options
    const port = parseInt(options.port, 10);
    const host = options.host;
    const enableCors = options.cors !== false;
    const apiKey = options.apiKey;
    const enableRateLimit = options.rateLimit !== false;
    const rateLimitMax = parseInt(options.rateLimitMax, 10);

    // Validate port
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(chalk.red('Error: Invalid port number. Must be between 1 and 65535.'));
      process.exit(1);
    }

    // Validate rate limit
    if (isNaN(rateLimitMax) || rateLimitMax < 1) {
      console.error(chalk.red('Error: Invalid rate limit. Must be a positive number.'));
      process.exit(1);
    }

    try {
      // Get the global plugin manager from the CLI context
      // Note: This assumes the CLI has already initialized the plugin manager
      // We'll need to access it from the global scope or pass it in

      // For now, we'll create a new instance
      // In production, this should be shared with the CLI
      console.log(chalk.yellow('Note: Starting with a new plugin manager instance.'));
      console.log(chalk.gray('For production, integrate with the CLI plugin manager.\n'));

      // Create a minimal plugin manager
      // This will be replaced by the actual plugin manager from the CLI
      const { createPluginSystem } = await import('../plugins/index.js');
      const pluginManager = await createPluginSystem(
        new Command(),
        { autoLoad: true }
      );

      // Create and start API server
      apiServer = await createApiServer(pluginManager, {
        port,
        host,
        enableCors,
        apiKey,
        enableRateLimit,
        rateLimitMax,
      });

      console.log(chalk.green('✓ API Server started successfully'));
      console.log(chalk.cyan(`\nAvailable endpoints:`));
      console.log(chalk.gray(`  GET    /api/health           - Health check`));
      console.log(chalk.gray(`  GET    /api/plugins          - List all plugins`));
      console.log(chalk.gray(`  GET    /api/plugins/:id      - Get plugin details`));
      console.log(chalk.gray(`  POST   /api/plugins/load     - Load a plugin`));
      console.log(chalk.gray(`  DELETE /api/plugins/:id      - Unload a plugin`));
      console.log(chalk.gray(`  POST   /api/plugins/reload   - Reload plugins`));
      console.log(chalk.gray(`  GET    /api/stats            - Get statistics`));
      console.log(chalk.cyan(`\nPress Ctrl+C to stop the server\n`));

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n\n🛑 Shutting down API server...'));
        if (apiServer) {
          await apiServer.stop();
        }
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log(chalk.yellow('\n\n🛑 Shutting down API server...'));
        if (apiServer) {
          await apiServer.stop();
        }
        process.exit(0);
      });

      // Keep the process running
      await new Promise(() => {
        // Never resolve, keep process alive
      });

    } catch (error) {
      console.error(chalk.red('Error starting API server:'));
      console.error(error);
      process.exit(1);
    }
  });

/**
 * Stop the API server (if running)
 */
export async function stopApiServer(): Promise<void> {
  if (apiServer) {
    await apiServer.stop();
    apiServer = null;
  }
}
