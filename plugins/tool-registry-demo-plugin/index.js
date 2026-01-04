/**
 * Tool Registry Demo Plugin
 *
 * Demonstrates the tool registry system by registering example tools
 */

const { Command } = require('commander');

/**
 * File Counter Tool
 * Counts files in a directory
 */
class FileCounterTool {
  constructor() {
    this.metadata = {
      id: 'file-counter',
      name: 'File Counter',
      category: 'file',
      version: '1.0.0',
      description: 'Counts files in a directory',
      author: 'Developer Toolbox',
      tags: ['file', 'count', 'directory'],
      enabled: true,
    };
  }

  async initialize() {
    console.log('File Counter Tool initialized');
  }

  validate(context) {
    if (context.args.length === 0) {
      return {
        valid: false,
        error: 'Directory path is required',
      };
    }
    return { valid: true };
  }

  async execute(context) {
    const { execSync } = require('child_process');
    const dir = context.args[0];

    try {
      const result = execSync(`find "${dir}" -type f | wc -l`, {
        encoding: 'utf-8',
      });
      const count = parseInt(result.trim(), 10);

      return {
        success: true,
        data: {
          directory: dir,
          fileCount: count,
        },
        exitCode: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        exitCode: 1,
      };
    }
  }

  getHelp() {
    return `
Usage: file-counter <directory>

Counts the number of files in the specified directory and its subdirectories.

Examples:
  file-counter /path/to/dir
  file-counter .
    `;
  }

  async cleanup() {
    console.log('File Counter Tool cleaned up');
  }
}

/**
 * String Case Converter Tool
 * Converts text to different cases
 */
class StringCaseConverterTool {
  constructor() {
    this.metadata = {
      id: 'case-converter',
      name: 'String Case Converter',
      category: 'utility',
      version: '1.0.0',
      description: 'Converts text between different cases (upper, lower, title)',
      author: 'Developer Toolbox',
      tags: ['string', 'text', 'utility'],
      enabled: true,
    };
  }

  validate(context) {
    if (!context.args[0]) {
      return {
        valid: false,
        error: 'Text input is required',
      };
    }

    const validCases = ['upper', 'lower', 'title'];
    const targetCase = context.options.case || 'upper';

    if (!validCases.includes(targetCase)) {
      return {
        valid: false,
        error: `Invalid case type. Must be one of: ${validCases.join(', ')}`,
      };
    }

    return { valid: true };
  }

  async execute(context) {
    const text = context.args[0];
    const targetCase = context.options.case || 'upper';

    try {
      let result;
      switch (targetCase) {
        case 'upper':
          result = text.toUpperCase();
          break;
        case 'lower':
          result = text.toLowerCase();
          break;
        case 'title':
          result = text
            .toLowerCase()
            .replace(/\b\w/g, (char) => char.toUpperCase());
          break;
        default:
          result = text;
      }

      return {
        success: true,
        data: {
          original: text,
          converted: result,
          case: targetCase,
        },
        exitCode: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        exitCode: 1,
      };
    }
  }

  getHelp() {
    return `
Usage: case-converter <text> [--case=<type>]

Converts text to different cases.

Options:
  --case=<type>  Target case: upper, lower, or title (default: upper)

Examples:
  case-converter "hello world" --case=upper
  case-converter "HELLO WORLD" --case=lower
  case-converter "hello world" --case=title
    `;
  }
}

/**
 * JSON Formatter Tool
 * Formats and validates JSON
 */
class JsonFormatterTool {
  constructor() {
    this.metadata = {
      id: 'json-formatter',
      name: 'JSON Formatter',
      category: 'utility',
      version: '1.0.0',
      description: 'Formats and validates JSON data',
      author: 'Developer Toolbox',
      tags: ['json', 'format', 'validate'],
      enabled: true,
    };
  }

  validate(context) {
    if (!context.args[0]) {
      return {
        valid: false,
        error: 'JSON string is required',
      };
    }
    return { valid: true };
  }

  async execute(context) {
    const jsonInput = context.args[0];
    const indent = parseInt(context.options.indent || '2', 10);

    try {
      const parsed = JSON.parse(jsonInput);
      const formatted = JSON.stringify(parsed, null, indent);

      return {
        success: true,
        data: {
          original: jsonInput,
          formatted: formatted,
          valid: true,
        },
        exitCode: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: `Invalid JSON: ${error.message}`,
        exitCode: 1,
      };
    }
  }

  getHelp() {
    return `
Usage: json-formatter <json-string> [--indent=<spaces>]

Formats and validates JSON data.

Options:
  --indent=<spaces>  Number of spaces for indentation (default: 2)

Examples:
  json-formatter '{"name":"test","value":123}'
  json-formatter '{"name":"test"}' --indent=4
    `;
  }
}

/**
 * Tool Registry Demo Plugin
 */
class ToolRegistryDemoPlugin {
  constructor() {
    this.metadata = {
      id: 'tool-registry-demo',
      name: 'Tool Registry Demo Plugin',
      version: '1.0.0',
      description: 'Demonstrates the tool registry system by registering example tools',
      author: 'Developer Toolbox',
    };
    this.context = null;
    this.tools = [];
  }

  async initialize(context) {
    this.context = context;
    context.logger.info('Tool Registry Demo Plugin initialized');

    // Register tools with the global registry
    // This will be done through the plugin's getCommands
    // which provides a command to register the tools
  }

  getCommands() {
    return [
      {
        command: new Command('register-demo-tools')
          .description('Register demo tools with the tool registry')
          .action(async () => {
            const { getGlobalRegistry } = await import('../../dist/tools/index.js');
            const registry = getGlobalRegistry();

            const fileCounter = new FileCounterTool();
            const caseConverter = new StringCaseConverterTool();
            const jsonFormatter = new JsonFormatterTool();

            const results = [];
            results.push(await registry.registerTool(fileCounter));
            results.push(await registry.registerTool(caseConverter));
            results.push(await registry.registerTool(jsonFormatter));

            const successCount = results.filter(r => r.success).length;
            console.log(`\n✓ Registered ${successCount} demo tools\n`);

            if (successCount > 0) {
              console.log('Try these commands:');
              console.log('  dtb tools list');
              console.log('  dtb tools info file-counter');
              console.log('  dtb tools execute file-counter .');
              console.log('  dtb tools execute case-converter "hello world" --case=title');
              console.log('  dtb tools execute json-formatter \'{"name":"test"}\'');
            }
          }),
      },
      {
        command: new Command('unregister-demo-tools')
          .description('Unregister demo tools from the tool registry')
          .action(async () => {
            const { getGlobalRegistry } = await import('../../dist/tools/index.js');
            const registry = getGlobalRegistry();

            const toolIds = ['file-counter', 'case-converter', 'json-formatter'];
            let successCount = 0;

            for (const toolId of toolIds) {
              const result = await registry.unregisterTool(toolId);
              if (result.success) {
                successCount++;
              }
            }

            console.log(`\n✓ Unregistered ${successCount} demo tools\n`);
          }),
      },
    ];
  }

  async cleanup() {
    if (this.context) {
      this.context.logger.info('Tool Registry Demo Plugin cleaned up');
    }
  }
}

// Export the plugin class
module.exports = ToolRegistryDemoPlugin;
