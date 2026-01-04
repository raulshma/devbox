/**
 * Hello World Plugin
 *
 * A simple example plugin that demonstrates the plugin system
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { IPlugin, PluginCommand, PluginContext, PluginMetadata } from '../../src/plugins/types.js';

/**
 * Hello World Plugin Class
 */
export class HelloWorldPlugin implements IPlugin {
  metadata: PluginMetadata = {
    id: 'hello-world',
    name: 'Hello World Plugin',
    version: '1.0.0',
    description: 'A simple example plugin that demonstrates the plugin system',
    author: 'Developer Toolbox',
  };

  private context?: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    context.logger.info('Hello World Plugin initialized');
  }

  getCommands(): PluginCommand[] {
    return [
      {
        command: new Command('hello')
          .description('Say hello to the world')
          .option('-n, --name <name>', 'Name to greet', 'World')
          .action((options) => {
            console.log(chalk.green.bold(`\n👋 Hello, ${options.name}!\n`));
            if (this.context) {
              this.context.logger.debug(`Greeted ${options.name}`);
            }
          }),
      },
      {
        command: new Command('goodbye')
          .description('Say goodbye')
          .option('-n, --name <name>', 'Name to say goodbye to', 'World')
          .action((options) => {
            console.log(chalk.blue.bold(`\n👋 Goodbye, ${options.name}!\n`));
            if (this.context) {
              this.context.logger.debug(`Said goodbye to ${options.name}`);
            }
          }),
      },
    ];
  }

  async cleanup(): Promise<void> {
    if (this.context) {
      this.context.logger.info('Hello World Plugin cleaned up');
    }
  }
}

// Export the plugin class
export default HelloWorldPlugin;
