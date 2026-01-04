/**
 * Interactive Mode Command
 *
 * Provides a guided menu-driven interface using Inquirer.js
 * for users who prefer interactive prompts over command-line flags
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getThemeManager } from '../utils/theme/index.js';
import ui from '../utils/ui.js';

const theme = getThemeManager();

interface CommandChoice {
  name: string;
  value: string;
  description: string;
}

/**
 * Category definitions for menu organization
 */
const MENU_CATEGORIES = {
  files: {
    icon: '📁',
    label: 'File Operations',
    description: 'Copy, move, delete, and manage files'
  },
  transform: {
    icon: '🔄',
    label: 'Transform & Rename',
    description: 'Rename files and transform content'
  },
  security: {
    icon: '🔐',
    label: 'Security',
    description: 'Encryption, decryption, and secrets'
  },
  cleanup: {
    icon: '🧹',
    label: 'Cleanup',
    description: 'Clean up project artifacts'
  },
  tools: {
    icon: '🛠️',
    label: 'Developer Tools',
    description: 'Regex builder, discovery, and more'
  },
  data: {
    icon: '💾',
    label: 'Data & State',
    description: 'Sessions, state, and storage'
  }
};

/**
 * Menu items organized by category
 */
const MENU_ITEMS = [
  // File Operations
  { category: 'files', value: 'fileops', icon: '📄', label: 'File Operations', desc: 'Copy, move, delete files' },

  // Transform
  { category: 'transform', value: 'rename', icon: '✏️', label: 'Rename Files', desc: 'Batch rename with patterns' },

  // Security
  { category: 'security', value: 'encrypt', icon: '🔒', label: 'Encrypt', desc: 'Encrypt files and directories' },
  { category: 'security', value: 'decrypt', icon: '🔓', label: 'Decrypt', desc: 'Decrypt encrypted files' },
  { category: 'security', value: 'keychain', icon: '🔑', label: 'Keychain', desc: 'Manage secure credentials' },

  // Cleanup
  { category: 'cleanup', value: 'cleanup-node', icon: '📦', label: 'Node.js Cleanup', desc: 'Remove node_modules, caches' },
  { category: 'cleanup', value: 'cleanup-dotnet', icon: '🔷', label: '.NET Cleanup', desc: 'Remove bin, obj folders' },

  // Tools
  { category: 'tools', value: 'regex-builder', icon: '🔧', label: 'Regex Builder', desc: 'Build and test regex patterns' },
  { category: 'tools', value: 'discover', icon: '🔍', label: 'Discover Files', desc: 'Find files by pattern' },

  // Data
  { category: 'data', value: 'state', icon: '💾', label: 'State Management', desc: 'Save and restore state' },
  { category: 'data', value: 'sessions', icon: '📋', label: 'Sessions', desc: 'Manage work sessions' },
];

export const interactiveCommand = new Command('interactive')
  .description('Launch interactive mode with guided menus')
  .alias('menu')
  .action(async () => {
    // Display welcome banner
    console.log(ui.cliBanner());
    console.log();
    console.log(ui.hint('Use arrow keys to navigate, Enter to select'));
    console.log(ui.hint('Add -i to any command for interactive mode (e.g., dtb encrypt -i)'));
    console.log();

    let running = true;

    while (running) {
      // Build categorized menu choices
      const choices: any[] = [];

      // Group items by category
      const categories = new Map<string, typeof MENU_ITEMS>();
      for (const item of MENU_ITEMS) {
        if (!categories.has(item.category)) {
          categories.set(item.category, []);
        }
        categories.get(item.category)!.push(item);
      }

      // Add items with category separators
      for (const [categoryKey, items] of categories) {
        const category = MENU_CATEGORIES[categoryKey as keyof typeof MENU_CATEGORIES];
        choices.push(new inquirer.Separator(
          chalk.dim('─'.repeat(3)) + ' ' +
          chalk.bold.white(`${category.icon} ${category.label}`) + ' ' +
          chalk.dim('─'.repeat(30 - category.label.length))
        ));

        for (const item of items) {
          choices.push({
            name: `  ${item.icon}  ${chalk.white(item.label.padEnd(18))} ${theme.muted(item.desc)}`,
            value: item.value,
            short: item.label
          });
        }
      }

      // Add exit option
      choices.push(new inquirer.Separator(chalk.dim('─'.repeat(44))));
      choices.push({
        name: `  ${chalk.red('✖')}  ${chalk.red('Exit')}`,
        value: 'exit',
        short: 'Exit'
      });

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: theme.primary('What would you like to do?'),
          choices,
          pageSize: 20,
          loop: false
        },
      ]);

      if (action === 'exit') {
        console.log();
        console.log(ui.box([
          theme.success('✓') + ' Thanks for using Developer Toolbox!',
          '',
          theme.muted('Run ') + chalk.cyan('dtb --help') + theme.muted(' for more commands')
        ], { style: 'rounded', borderColor: theme.success.bind(theme) }));
        console.log();
        running = false;
        continue;
      }

      // Execute the selected command with interactive prompts
      await executeInteractiveCommand(action);
    }
  });


async function executeInteractiveCommand(command: string): Promise<void> {
  const item = MENU_ITEMS.find(i => i.value === command);
  const title = item ? `${item.icon} ${item.label}` : command.toUpperCase();

  console.log();
  console.log(ui.commandHeader(title, item?.desc));

  switch (command) {
    case 'fileops':
      await interactiveFileOps();
      break;
    case 'rename':
      await interactiveRename();
      break;
    case 'regex-builder':
      console.log(ui.box([
        theme.warning('⚠') + '  Regex Builder works best in direct mode',
        '',
        ui.commandExample('dtb regex-builder', 'Launch the interactive regex builder')
      ], { style: 'rounded', title: 'Tip' }));
      break;
    case 'encrypt':
      await interactiveEncrypt();
      break;
    case 'decrypt':
      await interactiveDecrypt();
      break;
    case 'cleanup-node':
      await interactiveCleanupNode();
      break;
    case 'cleanup-dotnet':
      await interactiveCleanupDotnet();
      break;
    case 'discover':
      await interactiveDiscover();
      break;
    case 'state':
      await interactiveState();
      break;
    case 'sessions':
      await interactiveSessions();
      break;
    case 'keychain':
      await interactiveKeychain();
      break;
  }

  // Pause before returning to menu
  console.log();
  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: theme.muted('Press Enter to return to menu...'),
  }]);
}

async function interactiveFileOps(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'operation',
      message: 'Select operation:',
      choices: [
        { name: `${theme.success('📋')} Copy files/directories`, value: 'copy' },
        { name: `${theme.warning('📦')} Move files/directories`, value: 'move' },
        { name: `${theme.error('🗑️')} Delete files/directories`, value: 'delete' },
      ],
    },
    {
      type: 'input',
      name: 'source',
      message: 'Source path:',
      when: (answers: any) => answers.operation !== 'delete',
      validate: (input: string) => input.trim().length > 0 || 'Source path is required',
    },
    {
      type: 'input',
      name: 'destination',
      message: 'Destination path:',
      when: (answers: any) => answers.operation !== 'delete',
      validate: (input: string) => input.trim().length > 0 || 'Destination path is required',
    },
    {
      type: 'input',
      name: 'deletePath',
      message: 'Path to delete:',
      when: (answers: any) => answers.operation === 'delete',
      validate: (input: string) => input.trim().length > 0 || 'Path is required',
    },
    {
      type: 'confirm',
      name: 'recursive',
      message: 'Process directories recursively?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Preview changes without applying (dry-run)?',
      default: true,
    },
  ]);

  displayConfiguration(answers);
}

async function interactiveRename(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'directory',
      message: 'Directory to process:',
      default: '.',
    },
    {
      type: 'input',
      name: 'pattern',
      message: 'Regex pattern to match:',
      validate: (input: string) => input.trim().length > 0 || 'Pattern is required',
    },
    {
      type: 'input',
      name: 'replacement',
      message: 'Replacement string:',
      validate: (input: string) => input.trim().length > 0 || 'Replacement is required',
    },
    {
      type: 'list',
      name: 'caseConversion',
      message: 'Case conversion:',
      choices: [
        { name: 'None', value: null },
        { name: 'lowercase', value: 'lower' },
        { name: 'UPPERCASE', value: 'upper' },
        { name: 'camelCase', value: 'camel' },
        { name: 'kebab-case', value: 'kebab' },
        { name: 'snake_case', value: 'snake' },
        { name: 'PascalCase', value: 'pascal' },
      ],
    },
    {
      type: 'input',
      name: 'filter',
      message: 'Filter by extension (e.g., .ts, .js):',
    },
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Preview changes without applying?',
      default: true,
    },
  ]);

  displayConfiguration(answers);
}

async function interactiveEncrypt(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'input',
      message: 'File or directory to encrypt:',
      validate: (input: string) => input.trim().length > 0 || 'Input path is required',
    },
    {
      type: 'password',
      name: 'password',
      message: 'Encryption password:',
      mask: '●',
      validate: (input: string) => input.length >= 8 || 'Password must be at least 8 characters',
    },
    {
      type: 'password',
      name: 'confirmPassword',
      message: 'Confirm password:',
      mask: '●',
      validate: (input: string, answers: any) =>
        input === answers.password || 'Passwords do not match',
    },
    {
      type: 'list',
      name: 'algorithm',
      message: 'Encryption algorithm:',
      choices: [
        { name: `${theme.success('★')} AES-256-GCM (Recommended)`, value: 'aes-256-gcm' },
        { name: '  AES-192-GCM', value: 'aes-192-gcm' },
        { name: '  AES-128-GCM', value: 'aes-128-gcm' },
      ],
      default: 'aes-256-gcm',
    },
    {
      type: 'confirm',
      name: 'recursive',
      message: 'Encrypt directories recursively?',
      default: false,
    },
  ]);

  // Don't show password in config
  const displayAnswers = { ...answers, password: '●●●●●●●●', confirmPassword: undefined };
  displayConfiguration(displayAnswers);
}

async function interactiveDecrypt(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'input',
      message: 'Encrypted file or directory:',
      validate: (input: string) => input.trim().length > 0 || 'Input path is required',
    },
    {
      type: 'password',
      name: 'password',
      message: 'Decryption password:',
      mask: '●',
      validate: (input: string) => input.length >= 1 || 'Password is required',
    },
    {
      type: 'confirm',
      name: 'recursive',
      message: 'Decrypt directories recursively?',
      default: false,
    },
  ]);

  const displayAnswers = { ...answers, password: '●●●●●●●●' };
  displayConfiguration(displayAnswers);
}


async function interactiveCleanupNode(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'directory',
      message: 'Directory to clean:',
      default: '.',
    },
    {
      type: 'checkbox',
      name: 'targets',
      message: 'Select what to clean:',
      choices: [
        { name: '📦 node_modules directories', value: 'node_modules', checked: true },
        { name: '📄 package-lock.json files', value: 'package-lock.json' },
        { name: '🗂️  npm cache', value: 'cache' },
        { name: '📁 .npm directory', value: '.npm' },
        { name: '📁 dist directories', value: 'dist' },
        { name: '📁 .next directories', value: '.next' },
      ],
      validate: (input: string[]) => input.length > 0 || 'Select at least one target',
    },
    {
      type: 'number',
      name: 'depth',
      message: 'Maximum search depth:',
      default: 10,
      validate: (input: number) => input > 0 || 'Enter a valid number',
    },
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Preview changes without deleting?',
      default: true,
    },
  ]);

  displayConfiguration(answers);
  displayCleanupWarning(answers.dryRun);
}

async function interactiveCleanupDotnet(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'directory',
      message: 'Directory to clean:',
      default: '.',
    },
    {
      type: 'checkbox',
      name: 'targets',
      message: 'Select what to clean:',
      choices: [
        { name: '📁 bin directories', value: 'bin', checked: true },
        { name: '📁 obj directories', value: 'obj', checked: true },
        { name: '📁 .vs directory', value: '.vs' },
        { name: '📦 NuGet packages cache', value: 'nuget' },
        { name: '📁 TestResults', value: 'TestResults' },
      ],
      validate: (input: string[]) => input.length > 0 || 'Select at least one target',
    },
    {
      type: 'confirm',
      name: 'recursive',
      message: 'Search recursively?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Preview changes without deleting?',
      default: true,
    },
  ]);

  displayConfiguration(answers);
  displayCleanupWarning(answers.dryRun);
}

async function interactiveDiscover(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'path',
      message: 'Directory to search:',
      default: '.',
    },
    {
      type: 'input',
      name: 'pattern',
      message: 'File pattern (glob):',
      default: '*.*',
    },
    {
      type: 'checkbox',
      name: 'fileTypes',
      message: 'Quick select file types:',
      choices: [
        { name: '📘 TypeScript (*.ts, *.tsx)', value: '*.ts,*.tsx' },
        { name: '📙 JavaScript (*.js, *.jsx)', value: '*.js,*.jsx' },
        { name: '🐍 Python (*.py)', value: '*.py' },
        { name: '📋 JSON (*.json)', value: '*.json' },
        { name: '📝 Markdown (*.md)', value: '*.md' },
        { name: '🎨 CSS/SCSS (*.css, *.scss)', value: '*.css,*.scss' },
      ],
    },
    {
      type: 'confirm',
      name: 'recursive',
      message: 'Search recursively?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'showHidden',
      message: 'Include hidden files?',
      default: false,
    },
    {
      type: 'list',
      name: 'output',
      message: 'Output format:',
      choices: [
        { name: 'List', value: 'list' },
        { name: 'Tree', value: 'tree' },
        { name: 'JSON', value: 'json' },
      ],
    },
  ]);

  displayConfiguration(answers);
}

async function interactiveState(): Promise<void> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'State management action:',
      choices: [
        { name: `${theme.success('💾')} Save current state`, value: 'save' },
        { name: `${theme.info('📥')} Load saved state`, value: 'load' },
        { name: `${theme.primary('📋')} List saved states`, value: 'list' },
        { name: `${theme.error('🗑️')} Delete state`, value: 'delete' },
      ],
    },
  ]);

  switch (action) {
    case 'save': {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'State name:',
          validate: (input: string) => input.trim().length > 0 || 'Name is required',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description (optional):',
        },
        {
          type: 'checkbox',
          name: 'include',
          message: 'What to include:',
          choices: [
            { name: 'Configuration', value: 'config', checked: true },
            { name: 'Environment variables', value: 'env' },
            { name: 'Recent commands', value: 'history' },
          ],
        },
      ]);
      displayConfiguration({ action: 'save', ...answers });
      break;
    }

    case 'load': {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'State name to load:',
          validate: (input: string) => input.trim().length > 0 || 'Name is required',
        },
      ]);
      displayConfiguration({ action: 'load', ...answers });
      break;
    }

    case 'list':
      console.log(ui.box([
        theme.muted('Listing all saved states...'),
        '',
        theme.muted('Run: ') + chalk.cyan('dtb state list')
      ], { title: 'State List' }));
      break;

    case 'delete': {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'State name to delete:',
          validate: (input: string) => input.trim().length > 0 || 'Name is required',
        },
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure? This cannot be undone.',
          default: false,
        },
      ]);
      if (answers.confirm) {
        displayConfiguration({ action: 'delete', name: answers.name });
      } else {
        console.log(theme.muted('\nCancelled.'));
      }
      break;
    }
  }
}

async function interactiveSessions(): Promise<void> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Session action:',
      choices: [
        { name: `${theme.success('➕')} Create new session`, value: 'create' },
        { name: `${theme.info('📋')} List sessions`, value: 'list' },
        { name: `${theme.primary('▶️')} Resume session`, value: 'resume' },
        { name: `${theme.error('🗑️')} Delete session`, value: 'delete' },
      ],
    },
  ]);

  switch (action) {
    case 'create': {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Session name:',
          validate: (input: string) => input.trim().length > 0 || 'Name is required',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description (optional):',
        },
      ]);
      displayConfiguration({ action: 'create', ...answers });
      break;
    }

    case 'list':
      console.log(ui.box([
        theme.muted('Listing all sessions...'),
        '',
        theme.muted('Run: ') + chalk.cyan('dtb sessions list')
      ], { title: 'Sessions' }));
      break;

    case 'resume':
    case 'delete': {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'id',
          message: `Session ID to ${action}:`,
          validate: (input: string) => input.trim().length > 0 || 'ID is required',
        },
      ]);
      displayConfiguration({ action, ...answers });
      break;
    }
  }
}

async function interactiveKeychain(): Promise<void> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Keychain action:',
      choices: [
        { name: `${theme.success('➕')} Store credential`, value: 'set' },
        { name: `${theme.info('🔍')} Retrieve credential`, value: 'get' },
        { name: `${theme.primary('📋')} List credentials`, value: 'list' },
        { name: `${theme.error('🗑️')} Delete credential`, value: 'delete' },
      ],
    },
  ]);

  switch (action) {
    case 'set': {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'service',
          message: 'Service name:',
          validate: (input: string) => input.trim().length > 0 || 'Service is required',
        },
        {
          type: 'input',
          name: 'account',
          message: 'Account/username:',
          validate: (input: string) => input.trim().length > 0 || 'Account is required',
        },
        {
          type: 'password',
          name: 'password',
          message: 'Password/secret:',
          mask: '●',
          validate: (input: string) => input.length > 0 || 'Password is required',
        },
      ]);
      displayConfiguration({ action: 'set', service: answers.service, account: answers.account, password: '●●●●●●●●' });
      break;
    }

    case 'get':
    case 'delete': {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'service',
          message: 'Service name:',
          validate: (input: string) => input.trim().length > 0 || 'Service is required',
        },
        {
          type: 'input',
          name: 'account',
          message: 'Account/username:',
          validate: (input: string) => input.trim().length > 0 || 'Account is required',
        },
      ]);
      displayConfiguration({ action, ...answers });
      break;
    }

    case 'list':
      console.log(ui.box([
        theme.muted('Listing stored credentials...'),
        '',
        theme.muted('Run: ') + chalk.cyan('dtb keychain list')
      ], { title: 'Keychain' }));
      break;
  }
}

/**
 * Display configuration summary
 */
function displayConfiguration(config: Record<string, any>): void {
  const filteredConfig = Object.fromEntries(
    Object.entries(config).filter(([_, v]) => v !== undefined && v !== null && v !== '')
  );

  console.log();
  console.log(ui.box([
    chalk.bold.white('Configuration Summary'),
    '',
    ...Object.entries(filteredConfig).map(([key, value]) => {
      const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
      return `${theme.muted(key.padEnd(16))} ${theme.text(displayValue)}`;
    }),
  ], { style: 'rounded', title: '⚙️ Settings' }));

  console.log();
  console.log(ui.hint('This is a preview. Actual execution coming soon!'));
}

/**
 * Display cleanup warning
 */
function displayCleanupWarning(isDryRun: boolean): void {
  if (!isDryRun) {
    console.log();
    console.log(ui.box([
      theme.warning('⚠') + '  ' + chalk.bold.yellow('Warning'),
      '',
      'Files will be permanently deleted.',
      'Consider running with dry-run first.'
    ], { style: 'rounded', borderColor: theme.warning.bind(theme) }));
  }
}
