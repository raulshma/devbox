/**
 * Help Command
 *
 * Comprehensive help system with examples, usage patterns, and searchable topics
 */

import { Command } from 'commander';
import chalk from 'chalk';

/**
 * Help topic interface
 */
interface HelpTopic {
  id: string;
  title: string;
  category: string;
  description: string;
  examples: HelpExample[];
  relatedTopics?: string[];
  seeAlso?: string[];
}

/**
 * Help example interface
 */
interface HelpExample {
  description: string;
  command: string;
  output?: string;
}

/**
 * Comprehensive help topics database
 */
const helpTopics: HelpTopic[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    category: 'General',
    description: 'Introduction to Developer Toolbox CLI and basic usage',
    examples: [
      {
        description: 'Show general help and available commands',
        command: 'devtoolbox --help',
      },
      {
        description: 'Show help for a specific command',
        command: 'devtools rename --help',
      },
      {
        description: 'List all available topics',
        command: 'devtools help topics',
      },
      {
        description: 'Search for help on a specific topic',
        command: 'devtools help search "file operations"',
      },
    ],
    relatedTopics: ['command-reference', 'common-patterns'],
  },
  {
    id: 'rename',
    title: 'Rename Command',
    category: 'Commands',
    description: 'Advanced file and folder renaming with pattern matching, templates, and batch operations',
    examples: [
      {
        description: 'Simple pattern replacement',
        command: 'devtools rename --pattern "old" --replacement "new"',
      },
      {
        description: 'Use numbered sequence (rename files to file-001.jpg, file-002.jpg, etc.)',
        command: 'devtools rename --pattern ".*" --replacement "file-{counter:03}.jpg"',
      },
      {
        description: 'Case conversion to snake_case',
        command: 'devtools rename --pattern ".*" --case snake',
      },
      {
        description: 'Template-based renaming with date',
        command: 'devtools rename --template "backup-{date}-{name}"',
      },
      {
        description: 'Filter by file type and preview changes',
        command: 'devtools rename --pattern "\\d+" --replacement "" --filter "*.js" --dry-run',
      },
      {
        description: 'Case-insensitive pattern matching',
        command: 'devtools rename --pattern "IMG" --replacement "img" --case-insensitive',
      },
      {
        description: 'Undo the last rename operation',
        command: 'devtools rename --undo',
      },
      {
        description: 'View rename history',
        command: 'devtools rename --history',
      },
    ],
    relatedTopics: ['patterns', 'templates', 'conflict-resolution'],
    seeAlso: ['fileops', 'discover'],
  },
  {
    id: 'encrypt',
    title: 'Encrypt Command',
    category: 'Commands',
    description: 'Encrypt files with AES-256-GCM encryption with password-based keys',
    examples: [
      {
        description: 'Encrypt a single file',
        command: 'devtools encrypt --files document.pdf',
      },
      {
        description: 'Encrypt multiple files',
        command: 'devtools encrypt --files file1.txt file2.txt file3.txt',
      },
      {
        description: 'Encrypt all files in a directory',
        command: 'devtools encrypt --directory ./documents',
      },
      {
        description: 'Encrypt with custom output directory',
        command: 'devtools encrypt --directory ./data --output ./encrypted',
      },
      {
        description: 'Encrypt only specific file types',
        command: 'devtools encrypt --directory ./docs --filter "*.pdf"',
      },
      {
        description: 'Preview encryption without applying',
        command: 'devtools encrypt --directory ./data --dry-run',
      },
      {
        description: 'Use saved password from keychain',
        command: 'devtools encrypt --files secret.txt --use-saved mypassword',
      },
      {
        description: 'Save password to keychain for later use',
        command: 'devtools encrypt --files data.txt --save-password workdata',
      },
    ],
    relatedTopics: ['decrypt', 'keychain', 'security'],
    seeAlso: ['decrypt', 'keychain'],
  },
  {
    id: 'decrypt',
    title: 'Decrypt Command',
    category: 'Commands',
    description: 'Decrypt files that were encrypted with the encrypt command',
    examples: [
      {
        description: 'Decrypt a single encrypted file',
        command: 'devtools decrypt --files document.pdf.enc',
      },
      {
        description: 'Decrypt multiple files',
        command: 'devtools decrypt --files file1.txt.enc file2.txt.enc',
      },
      {
        description: 'Decrypt all files in a directory',
        command: 'devtools decrypt --directory ./encrypted',
      },
      {
        description: 'Decrypt with custom output directory',
        command: 'devtools decrypt --directory ./encrypted --output ./decrypted',
      },
      {
        description: 'Preview decryption without applying',
        command: 'devtools decrypt --directory ./encrypted --dry-run',
      },
      {
        description: 'Use saved password from keychain',
        command: 'devtools decrypt --files secret.txt.enc --use-saved mypassword',
      },
    ],
    relatedTopics: ['encrypt', 'keychain', 'security'],
    seeAlso: ['encrypt', 'keychain'],
  },
  {
    id: 'fileops',
    title: 'File Operations Command',
    category: 'Commands',
    description: 'Advanced copy, move, and delete operations with filtering and conflict resolution',
    examples: [
      {
        description: 'Copy directory recursively',
        command: 'devtools fileops --copy ./source ./dest --recursive',
      },
      {
        description: 'Move directory with progress display',
        command: 'devtools fileops --move ./old ./new',
      },
      {
        description: 'Delete files (moves to trash by default)',
        command: 'devtools fileops --delete file1.txt file2.txt',
      },
      {
        description: 'Copy only TypeScript files',
        command: 'devtools fileops --copy ./src ./dist --filter "*.ts"',
      },
      {
        description: 'Copy with regex pattern filter',
        command: 'devtools fileops --copy ./src ./dist --regex "test.*\\.spec\\.ts"',
      },
      {
        description: 'Preview operations before applying',
        command: 'devtools fileops --copy ./src ./dist --dry-run',
      },
      {
        description: 'Copy with conflict resolution (rename existing files)',
        command: 'devtools fileops --copy ./src ./dest --conflict-strategy rename',
      },
      {
        description: 'Delete files permanently (bypass trash)',
        command: 'devtools fileops --delete temp.txt --no-trash',
      },
      {
        description: 'Copy preserving timestamps and permissions',
        command: 'devtools fileops --copy ./src ./dest --preserve',
      },
    ],
    relatedTopics: ['conflict-resolution', 'patterns', 'discover'],
    seeAlso: ['rename', 'discover'],
  },
  {
    id: 'regex-builder',
    title: 'Regex Builder Command',
    category: 'Commands',
    description: 'Interactive tool to build and test regular expressions with visual feedback',
    examples: [
      {
        description: 'Launch interactive regex builder',
        command: 'devtools regex-builder',
      },
      {
        description: 'Build regex matching email addresses',
        command: 'devtools regex-builder --pattern "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"',
      },
      {
        description: 'Test pattern against sample text',
        command: 'devtools regex-builder --pattern "\\d+" --test "123 abc 456"',
      },
      {
        description: 'Build case-insensitive pattern',
        command: 'devtools regex-builder --pattern "hello" --flags i',
      },
    ],
    relatedTopics: ['patterns'],
    seeAlso: ['rename', 'fileops'],
  },
  {
    id: 'discover',
    title: 'Discover Command',
    category: 'Commands',
    description: 'Discover and analyze files in a directory with powerful filtering options',
    examples: [
      {
        description: 'List all TypeScript files',
        command: 'devtools discover --filter "*.ts"',
      },
      {
        description: 'Find files larger than 1MB',
        command: 'devtools discover --min-size 1MB',
      },
      {
        description: 'Find files modified in the last 7 days',
        command: 'devtools discover --newer "7d"',
      },
      {
        description: 'Group files by extension',
        command: 'devtools discover --group-by extension',
      },
      {
        description: 'Show total sizes by file type',
        command: 'devtools discover --filter "*.js" --show-sizes',
      },
      {
        description: 'Search for files by name pattern',
        command: 'devtools discover --search "test"',
      },
      {
        description: 'Find files matching multiple patterns',
        command: 'devtools discover --include "*.ts,*.tsx" --exclude "node_modules"',
      },
    ],
    relatedTopics: ['patterns', 'fileops'],
    seeAlso: ['fileops', 'rename'],
  },
  {
    id: 'cleanup-node',
    title: 'Cleanup Node Command',
    category: 'Commands',
    description: 'Clean up Node.js project dependencies and temporary files',
    examples: [
      {
        description: 'Interactive cleanup mode',
        command: 'devtools cleanup-node',
      },
      {
        description: 'Clean all Node.js projects in current directory',
        command: 'devtools cleanup-node --all --yes',
      },
      {
        description: 'Clean specific directory',
        command: 'devtools cleanup-node --directory ./myproject',
      },
      {
        description: 'Preview what would be cleaned',
        command: 'devtools cleanup-node --dry-run',
      },
      {
        description: 'Clean only node_modules, keep other files',
        command: 'devtools cleanup-node --clean-modules --yes',
      },
    ],
    relatedTopics: ['cleanup-dotnet'],
    seeAlso: ['cleanup-dotnet'],
  },
  {
    id: 'cleanup-dotnet',
    title: 'Cleanup .NET Command',
    category: 'Commands',
    description: 'Clean up .NET project build artifacts and temporary files',
    examples: [
      {
        description: 'Interactive cleanup mode',
        command: 'devtools cleanup-dotnet',
      },
      {
        description: 'Clean all .NET projects in current directory',
        command: 'devtools cleanup-dotnet --all --yes',
      },
      {
        description: 'Clean specific directory',
        command: 'devtools cleanup-dotnet --directory ./mysolution',
      },
      {
        description: 'Preview what would be cleaned',
        command: 'devtools cleanup-dotnet --dry-run',
      },
      {
        description: 'Clean only bin and obj folders',
        command: 'devtools cleanup-dotnet --clean-artifacts --yes',
      },
    ],
    relatedTopics: ['cleanup-node'],
    seeAlso: ['cleanup-node'],
  },
  {
    id: 'state',
    title: 'State Command',
    category: 'Commands',
    description: 'Manage application state, configuration, and user preferences',
    examples: [
      {
        description: 'View all state information',
        command: 'devtools state',
      },
      {
        description: 'Get a specific state value',
        command: 'devtools state get preferences.theme',
      },
      {
        description: 'Set a state value',
        command: 'devtools state set preferences.theme dark',
      },
      {
        description: 'List all state keys',
        command: 'devtools state list',
      },
      {
        description: 'Reset state to defaults',
        command: 'devtools state reset',
      },
      {
        description: 'Export state to JSON file',
        command: 'devtools state export state-backup.json',
      },
      {
        description: 'Import state from JSON file',
        command: 'devtools state import state-backup.json',
      },
    ],
    relatedTopics: ['config'],
  },
  {
    id: 'sessions',
    title: 'Sessions Command',
    category: 'Commands',
    description: 'Manage persistent sessions for storing and recalling workflow states',
    examples: [
      {
        description: 'List all sessions',
        command: 'devtools sessions list',
      },
      {
        description: 'Create a new session',
        command: 'devtools sessions create my-workflow',
      },
      {
        description: 'Save current state to a session',
        command: 'devtools sessions save my-workflow',
      },
      {
        description: 'Load a saved session',
        command: 'devtools sessions load my-workflow',
      },
      {
        description: 'Delete a session',
        command: 'devtools sessions delete my-workflow',
      },
      {
        description: 'Show session details',
        command: 'devtools sessions info my-workflow',
      },
    ],
    relatedTopics: ['state'],
  },
  {
    id: 'audit',
    title: 'Audit Command',
    category: 'Commands',
    description: 'View and analyze audit logs of all operations performed by the CLI',
    examples: [
      {
        description: 'View recent audit logs',
        command: 'devtools audit',
      },
      {
        description: 'View logs for a specific operation',
        command: 'devtools audit --operation file_rename',
      },
      {
        description: 'View logs from the last 24 hours',
        command: 'devtools audit --since "24h"',
      },
      {
        description: 'View only failed operations',
        command: 'devtools audit --status failed',
      },
      {
        description: 'Export audit logs to JSON',
        command: 'devtools audit --export audit-logs.json',
      },
      {
        description: 'View statistics summary',
        command: 'devtools audit --stats',
      },
    ],
    relatedTopics: ['state'],
  },
  {
    id: 'keychain',
    title: 'Keychain Command',
    category: 'Commands',
    description: 'Manage passwords and secrets securely in OS keychain/credential manager',
    examples: [
      {
        description: 'List all stored passwords',
        command: 'devtools keychain list',
      },
      {
        description: 'Store a password',
        command: 'devtools keychain set mypassword',
      },
      {
        description: 'Retrieve a stored password',
        command: 'devtools keychain get mypassword',
      },
      {
        description: 'Delete a stored password',
        command: 'devtools keychain delete mypassword',
      },
      {
        description: 'Check if keychain is available',
        command: 'devtools keychain check',
      },
    ],
    relatedTopics: ['encrypt', 'decrypt', 'security'],
    seeAlso: ['encrypt', 'decrypt'],
  },
  {
    id: 'theme',
    title: 'Theme Command',
    category: 'Commands',
    description: 'Customize CLI appearance with themes and color schemes',
    examples: [
      {
        description: 'List all available themes',
        command: 'devtools theme list',
      },
      {
        description: 'Set a theme',
        command: 'devtools theme set ocean',
      },
      {
        description: 'Enable/disable color output',
        command: 'devtools theme --color-output false',
      },
      {
        description: 'Set theme mode (light/dark/auto)',
        command: 'devtools theme --mode dark',
      },
      {
        description: 'Preview all themes',
        command: 'devtools theme preview',
      },
    ],
    relatedTopics: ['config'],
  },
  {
    id: 'tools',
    title: 'Tools Command',
    category: 'Commands',
    description: 'Manage the tool registry and execute registered tools',
    examples: [
      {
        description: 'List all registered tools',
        command: 'devtools tools list',
      },
      {
        description: 'Show tool information',
        command: 'devtools tools info <toolId>',
      },
      {
        description: 'Search for tools',
        command: 'devtools tools search "file"',
      },
      {
        description: 'Enable a tool',
        command: 'devtools tools enable <toolId>',
      },
      {
        description: 'Disable a tool',
        command: 'devtools tools disable <toolId>',
      },
      {
        description: 'Execute a tool',
        command: 'devtools tools execute <toolId> [args...]',
      },
      {
        description: 'Show tool registry statistics',
        command: 'devtools tools stats',
      },
      {
        description: 'List all tool categories',
        command: 'devtools tools categories',
      },
    ],
    relatedTopics: ['plugins'],
  },
  {
    id: 'plugins',
    title: 'Plugins Command',
    category: 'Commands',
    description: 'Manage CLI plugins to extend functionality',
    examples: [
      {
        description: 'List all loaded plugins',
        command: 'devtools plugin list',
      },
      {
        description: 'Show plugin information',
        command: 'devtools plugin info <pluginId>',
      },
      {
        description: 'Reload all plugins',
        command: 'devtools plugin reload',
      },
    ],
    relatedTopics: ['tools'],
  },
  {
    id: 'interactive',
    title: 'Interactive Mode',
    category: 'Modes',
    description: 'Launch an interactive shell for running multiple commands',
    examples: [
      {
        description: 'Start interactive mode',
        command: 'devtools interactive',
      },
      {
        description: 'Interactive mode alias',
        command: 'devtools i',
      },
    ],
  },
  {
    id: 'api',
    title: 'API Server Command',
    category: 'Commands',
    description: 'Start a REST API server for programmatic access',
    examples: [
      {
        description: 'Start API server on default port (3000)',
        command: 'devtools api',
      },
      {
        description: 'Start on custom port',
        command: 'devtools api --port 8080',
      },
      {
        description: 'Start in production mode',
        command: 'devtools api --production',
      },
    ],
  },
  {
    id: 'patterns',
    title: 'Working with Patterns',
    category: 'Guides',
    description: 'Understanding glob patterns and regular expressions for file matching',
    examples: [
      {
        description: 'Match all TypeScript files',
        command: '--filter "*.ts"',
        output: 'Matches: file.ts, src/app.ts, but NOT src/app.tsx',
      },
      {
        description: 'Match files in subdirectories',
        command: '--filter "**/*.js"',
        output: 'Matches: app.js, src/app.js, src/lib/app.js',
      },
      {
        description: 'Match multiple patterns',
        command: '--filter "*.{ts,tsx,js,jsx}"',
        output: 'Matches: app.ts, app.tsx, app.js, app.jsx',
      },
      {
        description: 'Regex pattern for numbers',
        command: '--pattern "\\d+"',
        output: 'Matches: file123.txt, 456data.txt',
      },
      {
        description: 'Case-insensitive pattern',
        command: '--pattern "hello" --flags i',
        output: 'Matches: hello.txt, Hello.txt, HELLO.txt',
      },
    ],
    relatedTopics: ['regex-builder', 'templates'],
  },
  {
    id: 'templates',
    title: 'Rename Templates',
    category: 'Guides',
    description: 'Using templates for advanced renaming operations',
    examples: [
      {
        description: 'Add date prefix',
        command: '--template "{date}-{name}"',
        output: 'myfile.txt → 2024-01-08-myfile.txt',
      },
      {
        description: 'Sequential numbering',
        command: '--template "file-{counter:03}-{name}"',
        output: 'a.txt → file-001-a.txt, b.txt → file-002-b.txt',
      },
      {
        description: 'Extension manipulation',
        command: '--template "{name}.backup{ext}"',
        output: 'file.txt → file.backup.txt',
      },
      {
        description: 'Case conversion with template',
        command: '--template "{name:upper}"',
        output: 'myfile.txt → MYFILE.txt',
      },
      {
        description: 'Custom date format',
        command: '--template "archive-{date:YYYY-MM-DD}-{name}"',
        output: 'doc.pdf → archive-2024-01-08-doc.pdf',
      },
    ],
    relatedTopics: ['patterns', 'rename'],
  },
  {
    id: 'conflict-resolution',
    title: 'Conflict Resolution Strategies',
    category: 'Guides',
    description: 'Handling file name conflicts during copy, move, and rename operations',
    examples: [
      {
        description: 'Skip existing files (default)',
        command: '--conflict-strategy skip',
        output: 'Existing files are left unchanged',
      },
      {
        description: 'Overwrite existing files',
        command: '--conflict-strategy overwrite',
        output: 'Existing files are replaced',
      },
      {
        description: 'Rename with counter',
        command: '--conflict-strategy rename',
        output: 'file.txt → file_1.txt, file_2.txt, etc.',
      },
      {
        description: 'Keep newer file by timestamp',
        command: '--conflict-strategy keep-newer',
        output: 'File with newer modification time is kept',
      },
      {
        description: 'Keep older file by timestamp',
        command: '--conflict-strategy keep-older',
        output: 'File with older modification time is kept',
      },
      {
        description: 'Create backup of existing file',
        command: '--conflict-strategy backup',
        output: 'Existing.txt → Existing.txt.bak',
      },
      {
        description: 'Skip if files are identical',
        command: '--conflict-strategy skip-identical',
        output: 'Skips only if content is identical',
      },
    ],
    relatedTopics: ['fileops', 'rename'],
  },
  {
    id: 'security',
    title: 'Security Best Practices',
    category: 'Guides',
    description: 'Guidelines for secure file handling and password management',
    examples: [
      {
        description: 'Use keychain to avoid typing passwords',
        command: 'devtools encrypt --files data.txt --save-password workdata',
      },
      {
        description: 'Enable backups before encryption',
        command: 'devtools encrypt --directory ./docs --backup',
      },
      {
        description: 'Preview operations before permanent changes',
        command: 'devtools fileops --delete temp.txt --dry-run',
      },
      {
        description: 'Use dry-run mode for testing',
        command: 'devtools rename --pattern ".*" --template "{counter:03}-{name}" --dry-run',
      },
    ],
    relatedTopics: ['encrypt', 'decrypt', 'keychain'],
  },
  {
    id: 'common-patterns',
    title: 'Common Usage Patterns',
    category: 'Guides',
    description: 'Frequently used command combinations and workflows',
    examples: [
      {
        description: 'Batch rename photos by date',
        command: 'devtools rename --directory ./photos --template "photo-{date:YYYY-MM-DD}-{counter:03}{ext}"',
      },
      {
        description: 'Clean and organize project files',
        command: 'devtools discover --filter "*.log" && devtools fileops --delete $(devtools discover --filter "*.log" --format json)',
      },
      {
        description: 'Backup important files with encryption',
        command: 'devtools encrypt --directory ./documents --output ./backup --save-password documents',
      },
      {
        description: 'Find and organize large files',
        command: 'devtools discover --min-size 10MB --sort-by size --show-sizes',
      },
      {
        description: 'Prepare project for sharing',
        command: 'devtools cleanup-node --all --yes && devtools encrypt --directory ./src --filter "*.env"',
      },
    ],
    relatedTopics: ['getting-started'],
  },
  {
    id: 'config',
    title: 'Configuration',
    category: 'Reference',
    description: 'Understanding and customizing CLI configuration',
    examples: [
      {
        description: 'View current configuration',
        command: 'devtools state list',
      },
      {
        description: 'Set theme preference',
        command: 'devtools state set preferences.theme dark',
      },
      {
        description: 'Set color theme',
        command: 'devtools state set preferences.colorTheme ocean',
      },
      {
        description: 'Disable color output',
        command: 'devtools state set preferences.colorOutput false',
      },
    ],
    relatedTopics: ['theme', 'state'],
  },
];

/**
 * Search help topics by query
 */
function searchTopics(query: string): HelpTopic[] {
  const lowerQuery = query.toLowerCase();
  return helpTopics.filter(
    (topic) =>
      topic.title.toLowerCase().includes(lowerQuery) ||
      topic.description.toLowerCase().includes(lowerQuery) ||
      topic.id.toLowerCase().includes(lowerQuery) ||
      topic.category.toLowerCase().includes(lowerQuery) ||
      topic.examples.some(
        (example) =>
          example.description.toLowerCase().includes(lowerQuery) ||
          example.command.toLowerCase().includes(lowerQuery)
      )
  );
}

/**
 * Get topic by ID
 */
function getTopic(id: string): HelpTopic | undefined {
  return helpTopics.find((topic) => topic.id === id);
}

/**
 * Get topics by category
 */
function getTopicsByCategory(category: string): HelpTopic[] {
  return helpTopics.filter((topic) => topic.category.toLowerCase() === category.toLowerCase());
}

/**
 * Get all categories
 */
function getCategories(): string[] {
  const categories = new Set(helpTopics.map((topic) => topic.category));
  return Array.from(categories).sort();
}

/**
 * Format a help topic for display
 */
function formatTopic(topic: HelpTopic): string {
  let output = '';

  output += chalk.blue.bold(`\n📚 ${topic.title}\n`);
  output += chalk.gray(`Category: ${topic.category}\n`);
  output += chalk.gray(`Topic ID: ${topic.id}\n\n`);

  output += chalk.white.bold('Description:\n');
  output += chalk.white(`  ${topic.description}\n\n`);

  if (topic.examples.length > 0) {
    output += chalk.white.bold('Examples:\n');
    topic.examples.forEach((example, index) => {
      output += chalk.cyan(`  ${index + 1}. ${example.description}\n`);
      output += chalk.gray(`     ${example.command}\n`);
      if (example.output) {
        output += chalk.gray(`     Output: ${example.output}\n`);
      }
      output += '\n';
    });
  }

  if (topic.relatedTopics && topic.relatedTopics.length > 0) {
    output += chalk.white.bold('Related Topics:\n');
    topic.relatedTopics.forEach((relatedId) => {
      const related = getTopic(relatedId);
      if (related) {
        output += chalk.gray(`  • ${related.title} (${relatedId})\n`);
      }
    });
    output += '\n';
  }

  if (topic.seeAlso && topic.seeAlso.length > 0) {
    output += chalk.white.bold('See Also:\n');
    topic.seeAlso.forEach((cmd) => {
      output += chalk.gray(`  • devtools ${cmd} --help\n`);
    });
    output += '\n';
  }

  return output;
}

/**
 * Help command
 */
export const helpCommand = new Command('help')
  .description('Show help and examples for commands and topics')
  .argument('[topic]', 'Help topic or command to show help for')
  .option('-s, --search <query>', 'Search for help topics')
  .option('-l, --list', 'List all available help topics')
  .option('-c, --category <category>', 'List topics in a specific category')
  .action(async (topic, options) => {
    // Handle search option
    if (options.search) {
      const results = searchTopics(options.search);

      if (results.length === 0) {
        console.log(chalk.yellow(`\nNo help topics found matching "${options.search}"\n`));
        console.log(chalk.gray('Try: devtools help --list to see all available topics\n'));
        return;
      }

      console.log(
        chalk.blue.bold(`\n🔍 Search Results for "${options.search}" (${results.length} found)\n`)
      );

      results.forEach((result) => {
        console.log(chalk.white.bold(`  • ${result.title}`));
        console.log(chalk.gray(`    ID: ${result.id}`));
        console.log(chalk.gray(`    ${result.description}\n`));
      });

      console.log(chalk.gray(`Use: devtools help <topic-id> to view full details\n`));
      return;
    }

    // Handle list option
    if (options.list) {
      const categories = getCategories();

      console.log(chalk.blue.bold('\n📚 All Help Topics\n'));

      categories.forEach((category) => {
        const topics = getTopicsByCategory(category);
        console.log(chalk.white.bold(`\n${category} (${topics.length})\n`));

        topics.forEach((t) => {
          console.log(chalk.cyan(`  • ${t.title}`));
          console.log(chalk.gray(`    ID: ${t.id}`));
          console.log(chalk.gray(`    ${t.description.substring(0, 80)}${t.description.length > 80 ? '...' : ''}\n`));
        });
      });

      console.log(chalk.gray(`\nUse: devtools help <topic-id> to view full details\n`));
      return;
    }

    // Handle category option
    if (options.category) {
      const topics = getTopicsByCategory(options.category);

      if (topics.length === 0) {
        console.log(chalk.yellow(`\nCategory "${options.category}" not found\n`));
        console.log(chalk.gray('Available categories:'));
        getCategories().forEach((cat) => console.log(chalk.gray(`  • ${cat}`)));
        console.log();
        return;
      }

      console.log(chalk.blue.bold(`\n📚 ${options.category} Topics (${topics.length})\n`));

      topics.forEach((t) => {
        console.log(formatTopic(t));
      });

      return;
    }

    // Handle specific topic
    if (topic) {
      // Try to find by ID first
      let helpTopic = getTopic(topic);

      // If not found, try to find by title or command name
      if (!helpTopic) {
        const results = searchTopics(topic);
        if (results.length === 1) {
          helpTopic = results[0];
        } else if (results.length > 1) {
          console.log(chalk.yellow(`\nMultiple topics found matching "${topic}"\n`));
          results.forEach((result) => {
            console.log(chalk.white.bold(`  • ${result.title}`));
            console.log(chalk.gray(`    ID: ${result.id}\n`));
          });
          console.log(chalk.gray(`Use: devtools help <topic-id> for more details\n`));
          return;
        }
      }

      if (helpTopic) {
        console.log(formatTopic(helpTopic));
        return;
      }

      console.log(chalk.red(`\nHelp topic not found: ${topic}\n`));
      console.log(chalk.gray('Try: devtools help --list to see all available topics\n'));
      return;
    }

    // Show general help
    console.log(chalk.blue.bold('\n📚 Developer Toolbox CLI - Help System\n'));
    console.log(chalk.white('Comprehensive help with examples and usage patterns.\n'));

    console.log(chalk.white.bold('Usage:\n'));
    console.log(chalk.gray('  devtools help                    Show this help message'));
    console.log(chalk.gray('  devtools help <topic>            Show help for a specific topic'));
    console.log(chalk.gray('  devtools help --search <query>    Search for help topics'));
    console.log(chalk.gray('  devtools help --list             List all available topics'));
    console.log(chalk.gray('  devtools help --category <cat>    List topics in category\n'));

    console.log(chalk.white.bold('Quick Start:\n'));
    console.log(chalk.cyan('  Getting Started:'));
    console.log(chalk.gray('    devtools help getting-started\n'));
    console.log(chalk.cyan('  Popular Topics:'));
    console.log(chalk.gray('    devtools help rename          File renaming with patterns'));
    console.log(chalk.gray('    devtools help encrypt         File encryption'));
    console.log(chalk.gray('    devtools help fileops         Advanced file operations'));
    console.log(chalk.gray('    devtools help discover        File discovery and analysis\n'));

    console.log(chalk.white.bold('Categories:\n'));
    const categories = getCategories();
    categories.forEach((cat) => {
      const count = getTopicsByCategory(cat).length;
      console.log(chalk.gray(`  • ${cat.padEnd(20)} (${count} topics)`));
    });
    console.log();

    console.log(chalk.gray('For more information, visit: https://github.com/yourusername/devtoolbox\n'));
  });

export default helpCommand;
