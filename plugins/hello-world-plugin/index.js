/**
 * Hello World Plugin
 *
 * A simple example plugin that demonstrates the plugin system
 */

const { Command } = require('commander');

/**
 * Hello World Plugin Class
 */
class HelloWorldPlugin {
  constructor() {
    this.metadata = {
      id: 'hello-world',
      name: 'Hello World Plugin',
      version: '1.0.0',
      description: 'A simple example plugin that demonstrates the plugin system',
      author: 'Developer Toolbox',
    };
    this.context = null;
  }

  async initialize(context) {
    this.context = context;
    context.logger.info('Hello World Plugin initialized');
  }

  getCommands() {
    return [
      {
        command: new Command('hello')
          .description('Say hello to the world')
          .option('-n, --name <name>', 'Name to greet', 'World')
          .action((options) => {
            console.log(`\n👋 Hello, ${options.name}!\n`);
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
            console.log(`\n👋 Goodbye, ${options.name}!\n`);
            if (this.context) {
              this.context.logger.debug(`Said goodbye to ${options.name}`);
            }
          }),
      },
    ];
  }

  async cleanup() {
    if (this.context) {
      this.context.logger.info('Hello World Plugin cleaned up');
    }
  }
}

// Export the plugin class
module.exports = HelloWorldPlugin;
