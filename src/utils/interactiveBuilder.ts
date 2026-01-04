/**
 * Interactive Command Builder
 *
 * Provides a system for building CLI commands interactively.
 * When a command is invoked with --i flag, users can:
 * - See all available options
 * - Select and set values for options
 * - Preview the built command
 * - Execute when satisfied
 */

import { Command, Option } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getThemeManager } from './theme/index.js';
import ui from './ui.js';

const theme = getThemeManager();

/**
 * Option metadata extracted from Commander.js
 */
export interface OptionMeta {
  flags: string;
  description: string;
  shortFlag?: string;
  longFlag: string;
  required: boolean;
  optional: boolean;
  variadic: boolean;
  mandatory: boolean;
  negate: boolean;
  defaultValue?: any;
  argChoices?: string[];
  envVar?: string;
  isBoolean: boolean;
  argName?: string;
}

/**
 * User's selection for an option
 */
export interface OptionSelection {
  option: OptionMeta;
  value: any;
  enabled: boolean;
}

/**
 * Result of the interactive builder
 */
export interface InteractiveResult {
  execute: boolean;
  options: Record<string, any>;
  commandString: string;
}

/**
 * Extract option metadata from a Commander Option
 */
function extractOptionMeta(opt: Option): OptionMeta {
  const flags = opt.flags;
  const shortMatch = flags.match(/^-([a-zA-Z]),?\s/);
  const longMatch = flags.match(/--([a-zA-Z0-9-]+)/);
  const argMatch = flags.match(/<([^>]+)>|(\[([^\]]+)\])/);

  const isBoolean = !argMatch;
  const isVariadic = flags.includes('...');
  const isOptionalArg = flags.includes('[');
  const isRequiredArg = flags.includes('<') && !flags.includes('[');

  return {
    flags: opt.flags,
    description: opt.description || '',
    shortFlag: shortMatch ? shortMatch[1] : undefined,
    longFlag: longMatch ? longMatch[1] : '',
    required: isRequiredArg,
    optional: isOptionalArg,
    variadic: isVariadic,
    mandatory: opt.mandatory || false,
    negate: opt.negate || false,
    defaultValue: opt.defaultValue,
    argChoices: opt.argChoices,
    envVar: opt.envVar,
    isBoolean,
    argName: argMatch ? (argMatch[1] || argMatch[3]) : undefined,
  };
}

/**
 * Get all options from a command
 */
export function getCommandOptions(command: Command): OptionMeta[] {
  const options: OptionMeta[] = [];
  const cmdOptions = (command as any).options as Option[];

  if (cmdOptions && Array.isArray(cmdOptions)) {
    for (const opt of cmdOptions) {
      if (opt.flags.includes('--i') || opt.flags.includes('--interactive')) {
        continue;
      }
      options.push(extractOptionMeta(opt));
    }
  }

  return options;
}

/**
 * Get icon for option type
 */
function getOptionIcon(opt: OptionMeta): string {
  if (opt.isBoolean) return '◯';
  if (opt.argChoices) return '◆';
  if (opt.longFlag.includes('password') || opt.longFlag.includes('secret')) return '🔒';
  if (opt.longFlag.includes('path') || opt.longFlag.includes('directory') || opt.longFlag.includes('file')) return '📁';
  if (opt.longFlag.includes('parallel') || opt.longFlag.includes('workers')) return '⚡';
  return '◇';
}

/**
 * Format option for display in selection list
 */
function formatOptionForList(opt: OptionMeta, currentValue?: any): string {
  const icon = getOptionIcon(opt);
  const hasValue = currentValue !== undefined && currentValue !== null && currentValue !== false;

  const flagPart = opt.shortFlag
    ? chalk.cyan(`-${opt.shortFlag}`) + chalk.gray(',') + chalk.cyan(`--${opt.longFlag}`)
    : chalk.cyan(`    --${opt.longFlag}`);

  const typePart = opt.isBoolean
    ? chalk.gray(' (flag)')
    : opt.argChoices
      ? chalk.yellow(` [${opt.argChoices.slice(0, 3).join('|')}${opt.argChoices.length > 3 ? '...' : ''}]`)
      : opt.argName
        ? chalk.yellow(` <${opt.argName}>`)
        : '';

  let valuePart = '';
  if (hasValue) {
    const displayValue = typeof currentValue === 'string' && currentValue.length > 20
      ? currentValue.substring(0, 17) + '...'
      : currentValue;
    valuePart = ' ' + chalk.green('= ' + JSON.stringify(displayValue));
  } else if (opt.defaultValue !== undefined) {
    valuePart = ' ' + chalk.gray(`[${opt.defaultValue}]`);
  }

  const statusIcon = hasValue ? chalk.green('●') : chalk.gray('○');

  return `${statusIcon} ${icon} ${flagPart}${typePart}${valuePart}`;
}


/**
 * Prompt user for option value based on option type
 */
async function promptForOptionValue(opt: OptionMeta, currentValue?: any): Promise<any> {
  console.log();
  console.log(ui.box([
    chalk.bold.white(`--${opt.longFlag}`),
    theme.muted(opt.description || 'No description available')
  ], { style: 'rounded', title: '📝 Configure Option' }));

  if (opt.argChoices && opt.argChoices.length > 0) {
    const { value } = await inquirer.prompt([
      {
        type: 'list',
        name: 'value',
        message: `Select value:`,
        choices: [
          ...opt.argChoices.map(c => ({
            name: c === currentValue ? chalk.green(`● ${c}`) : `  ${c}`,
            value: c
          })),
          new inquirer.Separator(),
          { name: chalk.gray('  (clear value)'), value: null },
        ],
        default: currentValue || opt.defaultValue,
        pageSize: 10,
      },
    ]);
    return value;
  }

  if (opt.isBoolean) {
    const { value } = await inquirer.prompt([
      {
        type: 'list',
        name: 'value',
        message: `Enable this option?`,
        choices: [
          { name: chalk.green('● Yes'), value: true },
          { name: chalk.gray('○ No'), value: false },
        ],
        default: currentValue ?? opt.defaultValue ?? false,
      },
    ]);
    return value;
  }

  if (opt.variadic) {
    const { values } = await inquirer.prompt([
      {
        type: 'input',
        name: 'values',
        message: `Enter values (comma-separated):`,
        default: Array.isArray(currentValue) ? currentValue.join(', ') : '',
      },
    ]);
    if (!values.trim()) return undefined;
    return values.split(',').map((v: string) => v.trim()).filter((v: string) => v);
  }

  // Password-like options
  if (opt.longFlag.includes('password') || opt.longFlag.includes('secret') || opt.longFlag.includes('key')) {
    const { value } = await inquirer.prompt([
      {
        type: 'password',
        name: 'value',
        message: `Enter value:`,
        mask: '●',
      },
    ]);
    return value || undefined;
  }

  // Number-like options
  if (opt.argName?.includes('number') || opt.longFlag.includes('parallel') ||
      opt.longFlag.includes('workers') || opt.longFlag.includes('depth') ||
      opt.longFlag.includes('size') || opt.longFlag.includes('threshold') ||
      opt.longFlag.includes('port') || opt.longFlag.includes('timeout')) {
    const { value } = await inquirer.prompt([
      {
        type: 'input',
        name: 'value',
        message: `Enter number:`,
        default: currentValue?.toString() || opt.defaultValue?.toString() || '',
        validate: (input: string) => {
          if (!input.trim()) return true;
          return !isNaN(Number(input)) || 'Please enter a valid number';
        },
      },
    ]);
    return value.trim() ? Number(value) : undefined;
  }

  // Path-like options
  if (opt.longFlag.includes('directory') || opt.longFlag.includes('path') ||
      opt.longFlag.includes('output') || opt.longFlag.includes('file') ||
      opt.longFlag.includes('input')) {
    const { value } = await inquirer.prompt([
      {
        type: 'input',
        name: 'value',
        message: `Enter path:`,
        default: currentValue || opt.defaultValue || '',
      },
    ]);
    return value.trim() || undefined;
  }

  // Default text input
  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message: `Enter value:`,
      default: currentValue?.toString() || opt.defaultValue?.toString() || '',
    },
  ]);
  return value.trim() || undefined;
}

/**
 * Build the command string from selected options
 */
function buildCommandString(commandName: string, selections: Map<string, any>): string {
  const parts = ['dtb', commandName];

  for (const [flag, value] of selections) {
    if (value === undefined || value === null || value === false) {
      continue;
    }

    if (value === true) {
      parts.push(`--${flag}`);
    } else if (Array.isArray(value)) {
      for (const v of value) {
        parts.push(`--${flag}`, `"${v}"`);
      }
    } else if (typeof value === 'string' && value.includes(' ')) {
      parts.push(`--${flag}`, `"${value}"`);
    } else {
      parts.push(`--${flag}`, String(value));
    }
  }

  return parts.join(' ');
}

/**
 * Display current command preview
 */
function displayCommandPreview(commandName: string, selections: Map<string, any>): void {
  const cmdString = buildCommandString(commandName, selections);

  console.log();
  console.log(ui.box([
    chalk.gray('$') + ' ' + chalk.white(cmdString)
  ], { style: 'rounded', title: '📋 Command Preview', borderColor: theme.info.bind(theme) }));
}

/**
 * Group options by category for better organization
 */
function categorizeOptions(options: OptionMeta[]): Map<string, OptionMeta[]> {
  const categories = new Map<string, OptionMeta[]>();

  const categoryPatterns: [string, RegExp, string][] = [
    ['📁 Input/Output', /file|directory|path|output|input/i, 'io'],
    ['⚡ Processing', /parallel|worker|batch|stream|chunk|threshold|timeout/i, 'processing'],
    ['🔍 Filtering', /filter|pattern|include|exclude|min|max|newer|older|depth/i, 'filtering'],
    ['🔐 Security', /password|encrypt|decrypt|key|secret|keychain|auth/i, 'security'],
    ['⚙️ Behavior', /dry-run|backup|recursive|force|verbose|quiet|yes|no/i, 'behavior'],
    ['🎨 Display', /format|color|theme|style|json|table/i, 'display'],
  ];

  for (const opt of options) {
    let assigned = false;
    const searchText = `${opt.longFlag} ${opt.description}`;

    for (const [label, pattern] of categoryPatterns) {
      if (pattern.test(searchText)) {
        if (!categories.has(label)) {
          categories.set(label, []);
        }
        categories.get(label)!.push(opt);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      const label = '📦 General';
      if (!categories.has(label)) {
        categories.set(label, []);
      }
      categories.get(label)!.push(opt);
    }
  }

  return categories;
}


/**
 * Main interactive builder function
 */
export async function runInteractiveBuilder(command: Command): Promise<InteractiveResult> {
  const commandName = command.name();
  const commandDescription = command.description();
  const options = getCommandOptions(command);
  const selections = new Map<string, any>();

  // Display header
  console.log();
  console.log(ui.commandHeader(`Interactive: ${commandName}`, commandDescription));
  console.log(ui.hint('Select options to configure, then execute when ready'));
  console.log();

  const categorizedOptions = categorizeOptions(options);

  let running = true;

  while (running) {
    // Build choices for the main menu
    const choices: any[] = [];
    let optionCount = 0;
    let configuredCount = 0;

    // Add categorized options
    for (const [category, categoryOptions] of categorizedOptions) {
      choices.push(new inquirer.Separator(
        chalk.dim('─'.repeat(2)) + ' ' + chalk.bold.white(category) + ' ' + chalk.dim('─'.repeat(35 - category.length))
      ));

      for (const opt of categoryOptions) {
        const currentValue = selections.get(opt.longFlag);
        const hasValue = currentValue !== undefined && currentValue !== null && currentValue !== false;

        if (hasValue) configuredCount++;
        optionCount++;

        choices.push({
          name: '  ' + formatOptionForList(opt, currentValue),
          value: { type: 'option', option: opt },
          short: `--${opt.longFlag}`,
        });
      }
    }

    // Add action choices
    choices.push(new inquirer.Separator(chalk.dim('─'.repeat(50))));

    const statsText = configuredCount > 0
      ? chalk.green(` (${configuredCount}/${optionCount} configured)`)
      : '';

    choices.push({
      name: chalk.green('  ▶  Execute command') + statsText,
      value: { type: 'execute' },
      short: 'Execute',
    });
    choices.push({
      name: chalk.cyan('  👁  Preview command'),
      value: { type: 'preview' },
      short: 'Preview',
    });
    choices.push({
      name: chalk.yellow('  🔄 Reset all options'),
      value: { type: 'reset' },
      short: 'Reset',
    });
    choices.push({
      name: chalk.red('  ✖  Cancel'),
      value: { type: 'cancel' },
      short: 'Cancel',
    });

    // Show current command preview
    displayCommandPreview(commandName, selections);

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: theme.primary('Select an option to configure:'),
        choices,
        pageSize: 20,
        loop: false,
      },
    ]);

    switch (action.type) {
      case 'option': {
        const opt = action.option as OptionMeta;
        const currentValue = selections.get(opt.longFlag);
        const newValue = await promptForOptionValue(opt, currentValue);

        if (newValue === undefined || newValue === null || newValue === false ||
            (Array.isArray(newValue) && newValue.length === 0)) {
          selections.delete(opt.longFlag);
          console.log(theme.muted(`\n  Cleared --${opt.longFlag}`));
        } else {
          selections.set(opt.longFlag, newValue);
          console.log(theme.success(`\n  ✓ Set --${opt.longFlag}`));
        }
        break;
      }

      case 'execute': {
        displayCommandPreview(commandName, selections);

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: chalk.bold('Execute this command?'),
            default: true,
          },
        ]);

        if (confirm) {
          running = false;
          const optionsObj: Record<string, any> = {};
          for (const [key, value] of selections) {
            const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            optionsObj[camelKey] = value;
          }

          console.log();
          console.log(ui.status('running', 'Executing command...'));

          return {
            execute: true,
            options: optionsObj,
            commandString: buildCommandString(commandName, selections),
          };
        }
        break;
      }

      case 'preview': {
        displayCommandPreview(commandName, selections);

        // Show detailed breakdown
        if (selections.size > 0) {
          console.log();
          console.log(chalk.bold.white('  Configured options:'));
          for (const [key, value] of selections) {
            const displayValue = typeof value === 'string' && (key.includes('password') || key.includes('secret'))
              ? '●●●●●●●●'
              : JSON.stringify(value);
            console.log(`    ${theme.muted(key)}: ${theme.text(displayValue)}`);
          }
        }

        await inquirer.prompt([
          {
            type: 'input',
            name: 'continue',
            message: theme.muted('Press Enter to continue...'),
          },
        ]);
        break;
      }

      case 'reset': {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Reset all options?',
            default: false,
          },
        ]);

        if (confirm) {
          selections.clear();
          console.log(theme.warning('\n  ✓ All options reset'));
        }
        break;
      }

      case 'cancel': {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Cancel interactive mode?',
            default: false,
          },
        ]);

        if (confirm) {
          running = false;
          console.log(theme.muted('\n  Cancelled'));
          return {
            execute: false,
            options: {},
            commandString: '',
          };
        }
        break;
      }
    }
  }

  return {
    execute: false,
    options: {},
    commandString: '',
  };
}

/**
 * Check if interactive mode is requested
 */
export function isInteractiveMode(args: string[]): boolean {
  return args.includes('-i') || args.includes('--interactive');
}

/**
 * Remove interactive flag from args
 */
export function removeInteractiveFlag(args: string[]): string[] {
  return args.filter(arg => arg !== '-i' && arg !== '--interactive');
}


/**
 * Add interactive mode support to a command
 */
export function withInteractiveMode(command: Command): Command {
  command.option('-i, --interactive', 'Run in interactive mode to build command step by step');

  const originalAction = (command as any)._actionHandler;

  if (!originalAction) {
    return command;
  }

  command.action(async (...args: any[]) => {
    const cmdInstance = args[args.length - 1] as Command;
    const options = args[args.length - 2] as Record<string, any>;

    if (options.interactive || options.i) {
      const result = await runInteractiveBuilder(command);

      if (!result.execute) {
        return;
      }

      console.log();

      const mergedOptions = { ...options, ...result.options };
      delete mergedOptions.interactive;
      delete mergedOptions.i;

      const newArgs = [...args.slice(0, -2), mergedOptions, cmdInstance];
      return originalAction.apply(command, newArgs);
    }

    return originalAction.apply(command, args);
  });

  return command;
}

/**
 * Quick interactive mode - simplified version for common use cases
 */
export async function runQuickInteractiveBuilder(
  command: Command,
  priorityOptions: string[] = []
): Promise<InteractiveResult> {
  const commandName = command.name();
  const commandDescription = command.description();
  const allOptions = getCommandOptions(command);
  const selections = new Map<string, any>();

  console.log();
  console.log(ui.commandHeader(`Quick Setup: ${commandName}`, commandDescription));

  // Separate priority options from others
  const priorityOpts = allOptions.filter(opt =>
    priorityOptions.includes(opt.longFlag) || opt.mandatory
  );
  const otherOpts = allOptions.filter(opt =>
    !priorityOptions.includes(opt.longFlag) && !opt.mandatory
  );

  // First, prompt for priority/mandatory options
  if (priorityOpts.length > 0) {
    console.log(chalk.bold.yellow('\n📌 Required Options\n'));

    for (const opt of priorityOpts) {
      const value = await promptForOptionValue(opt);
      if (value !== undefined && value !== null && value !== false) {
        selections.set(opt.longFlag, value);
      }
    }
  }

  // Ask if user wants to configure additional options
  if (otherOpts.length > 0) {
    console.log();
    const { configureMore } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'configureMore',
        message: 'Configure additional options?',
        default: false,
      },
    ]);

    if (configureMore) {
      const { selectedOptions } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedOptions',
          message: 'Select options to configure:',
          choices: otherOpts.map(opt => ({
            name: `${getOptionIcon(opt)} --${opt.longFlag}: ${opt.description}`,
            value: opt,
            short: `--${opt.longFlag}`,
          })),
          pageSize: 15,
        },
      ]);

      for (const opt of selectedOptions) {
        const value = await promptForOptionValue(opt);
        if (value !== undefined && value !== null && value !== false) {
          selections.set(opt.longFlag, value);
        }
      }
    }
  }

  // Show final command and confirm
  displayCommandPreview(commandName, selections);

  const { execute } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'execute',
      message: chalk.bold('Execute this command?'),
      default: true,
    },
  ]);

  if (!execute) {
    console.log(theme.muted('\n  Cancelled'));
    return {
      execute: false,
      options: {},
      commandString: '',
    };
  }

  const optionsObj: Record<string, any> = {};
  for (const [key, value] of selections) {
    const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    optionsObj[camelKey] = value;
  }

  return {
    execute: true,
    options: optionsObj,
    commandString: buildCommandString(commandName, selections),
  };
}
