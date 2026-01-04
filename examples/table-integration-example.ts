/**
 * Table Integration Example
 *
 * This example demonstrates how to integrate the Table utility
 * into existing CLI commands for better formatted output.
 */

import { renderTable } from '../utils/Table.js';
import { getGlobalRegistry } from '../tools/index.js';
import chalk from 'chalk';

/**
 * Example: Enhanced tools list command with table output
 */
export async function listToolsAsTable() {
  const registry = getGlobalRegistry();
  const tools = registry.searchTools({});

  if (tools.length === 0) {
    console.log(chalk.gray('No tools found'));
    return;
  }

  console.log(chalk.blue.bold(`\n🔧 Registered Tools (${tools.length})\n`));

  // Use Table utility for formatted output
  renderTable(
    {
      status: {
        header: 'Status',
        minWidth: 8,
        align: 'center',
        color: (text: string) => text === '●' ? chalk.green(text) : chalk.gray(text),
      },
      name: {
        header: 'Name',
        minWidth: 25,
        color: chalk.white.bold,
      },
      id: {
        header: 'ID',
        minWidth: 20,
        color: chalk.gray,
      },
      category: {
        header: 'Category',
        minWidth: 15,
        color: chalk.cyan,
      },
      description: {
        header: 'Description',
        minWidth: 40,
        wrap: true,
      },
    },
    tools.map(tool => ({
      status: tool.metadata.enabled ? '●' : '○',
      name: tool.metadata.name,
      id: tool.metadata.id,
      category: tool.metadata.category,
      description: tool.metadata.description,
    })),
    {
      borderStyle: 'compact',
      padding: 1,
    }
  );
}

/**
 * Example: Display state statistics as a table
 */
export function showStateStatistics() {
  const stats = {
    totalKeys: 42,
    namespaces: 5,
    listeners: 3,
    historySize: 10,
    memoryUsage: 12345,
  };

  console.log(chalk.blue.bold('\n📊 State Statistics\n'));

  renderTable(
    {
      metric: {
        header: 'Metric',
        minWidth: 20,
        color: chalk.cyan,
      },
      value: {
        header: 'Value',
        minWidth: 20,
        align: 'right',
        color: chalk.white.bold,
      },
    },
    [
      { metric: 'Total Keys', value: stats.totalKeys },
      { metric: 'Namespaces', value: stats.namespaces },
      { metric: 'Listeners', value: stats.listeners },
      { metric: 'History Size', value: stats.historySize },
      { metric: 'Memory Usage', value: `${(stats.memoryUsage / 1024).toFixed(2)} KB` },
    ],
    {
      borderStyle: 'ascii',
    }
  );
}

/**
 * Example: Display file operations results
 */
export function showFileOperationsResults() {
  const operations = [
    { name: 'copy', source: '/path/to/source.txt', dest: '/path/to/dest.txt', status: 'Success', duration: '125ms' },
    { name: 'move', source: '/path/to/old.txt', dest: '/path/to/new.txt', status: 'Success', duration: '89ms' },
    { name: 'delete', source: '/path/to/unwanted.txt', dest: 'N/A', status: 'Failed', duration: '45ms' },
  ];

  console.log(chalk.blue.bold('\n📁 File Operations\n'));

  renderTable(
    {
      operation: {
        header: 'Operation',
        minWidth: 12,
        color: chalk.cyan,
      },
      source: {
        header: 'Source',
        minWidth: 25,
        color: chalk.gray,
      },
      destination: {
        header: 'Destination',
        minWidth: 25,
        color: chalk.gray,
      },
      status: {
        header: 'Status',
        minWidth: 10,
        align: 'center',
        color: (text: string) => text === 'Success' ? chalk.green(text) : chalk.red(text),
      },
      duration: {
        header: 'Duration',
        minWidth: 10,
        align: 'right',
        color: chalk.yellow,
      },
    },
    operations,
    {
      borderStyle: 'markdown',
    }
  );
}

/**
 * Example: Display encryption results
 */
export function showEncryptionResults() {
  const results = [
    { file: 'document.pdf', originalSize: '2.5 MB', encryptedSize: '2.6 MB', algorithm: 'AES-256', status: '✓' },
    { file: 'image.jpg', originalSize: '1.8 MB', encryptedSize: '1.9 MB', algorithm: 'AES-256', status: '✓' },
    { file: 'data.json', originalSize: '45 KB', encryptedSize: '52 KB', algorithm: 'AES-256', status: '✓' },
  ];

  console.log(chalk.blue.bold('\n🔒 Encryption Results\n'));

  renderTable(
    {
      file: {
        header: 'File',
        minWidth: 25,
        color: chalk.white,
      },
      originalSize: {
        header: 'Original',
        minWidth: 12,
        align: 'right',
      },
      encryptedSize: {
        header: 'Encrypted',
        minWidth: 12,
        align: 'right',
      },
      algorithm: {
        header: 'Algorithm',
        minWidth: 12,
        color: chalk.cyan,
      },
      status: {
        header: 'Status',
        minWidth: 8,
        align: 'center',
        color: chalk.green,
      },
    },
    results,
    {
      borderStyle: 'compact',
      padding: 1,
    }
  );
}

/**
 * Run all examples
 */
export async function runTableExamples() {
  console.log(chalk.bold('\n' + '='.repeat(80)));
  console.log(chalk.bold('Table Utility Integration Examples'));
  console.log(chalk.bold('='.repeat(80)));

  await listToolsAsTable();
  showStateStatistics();
  showFileOperationsResults();
  showEncryptionResults();

  console.log(chalk.bold('\n' + '='.repeat(80) + '\n'));
}
