/**
 * Regex Builder Command
 *
 * Interactive regex pattern builder for power rename and file filtering
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { validateRegexPattern, previewRegexMatches, extractCaptureGroups } from '../utils/rename.js';

export const regexBuilderCommand = new Command('regex-builder')
  .description('Interactive regex pattern builder for power rename and file filtering')
  .alias('rb')
  .option('-t, --test-files <files...>', 'Test files to validate pattern against')
  .option('-p, --pattern <pattern>', 'Starting regex pattern')
  .option('-r, --replacement <replacement>', 'Replacement string')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔧 Regex Pattern Builder\n'));
    console.log(chalk.gray('Build and test regex patterns interactively\n'));

    let currentPattern = options.pattern || '';
    let currentReplacement = options.replacement || '';
    let currentFlags = 'g';
    let testFiles = options.testFiles || [];

    // If no test files provided, prompt for them or use defaults
    if (testFiles.length === 0) {
      const { useDefaults } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useDefaults',
          message: 'Use default test files?',
          default: true,
        },
      ]);

      if (useDefaults) {
        testFiles = [
          'file-001.txt',
          'file-002.txt',
          'image-001.jpg',
          'document-final.pdf',
          'test_file_v1.js',
          'MyComponent.tsx',
          'data-2024-01-15.csv',
          'screenshot.png',
        ];
      } else {
        const { customFiles } = await inquirer.prompt([
          {
            type: 'input',
            name: 'customFiles',
            message: 'Enter test filenames (comma-separated):',
            validate: (input: string) => input.trim().length > 0 || 'At least one file is required',
          },
        ]);
        testFiles = customFiles.split(',').map((f: string) => f.trim());
      }
    }

    console.log(chalk.gray('\nTest files:'));
    testFiles.forEach((file: string, i: number) => {
      console.log(chalk.gray(`  ${i + 1}. ${file}`));
    });
    console.log();

    let building = true;

    while (building) {
      // Step 1: Pattern input
      if (!currentPattern) {
        const { pattern } = await inquirer.prompt([
          {
            type: 'input',
            name: 'pattern',
            message: 'Enter your regex pattern:',
            validate: (input: string) => {
              if (!input.trim()) return 'Pattern is required';
              const validation = validateRegexPattern(input, currentFlags);
              if (!validation.valid) {
                return `Invalid pattern: ${validation.error}`;
              }
              return true;
            },
          },
        ]);
        currentPattern = pattern;
      }

      // Step 2: Flags selection
      const { flags } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'flags',
          message: 'Select regex flags:',
          choices: [
            { name: 'Global (g) - Find all matches', value: 'g', checked: currentFlags.includes('g') },
            { name: 'Case Insensitive (i) - Ignore case', value: 'i', checked: currentFlags.includes('i') },
            { name: 'Multiline (m) - Treat ^ and $ per line', value: 'm', checked: currentFlags.includes('m') },
            { name: 'Dotall (s) - Dot matches newlines', value: 's', checked: currentFlags.includes('s') },
            { name: 'Unicode (u) - Unicode support', value: 'u', checked: currentFlags.includes('u') },
            { name: 'Sticky (y) - Match at exact position', value: 'y', checked: currentFlags.includes('y') },
          ],
        },
      ]);
      currentFlags = flags.length > 0 ? flags.join('') : 'g';

      // Step 3: Test the pattern
      console.log(chalk.blue.bold('\n📊 Pattern Test Results\n'));
      console.log(chalk.white(`Pattern: ${chalk.cyan(currentPattern)}`));
      console.log(chalk.white(`Flags: ${chalk.cyan(currentFlags)}\n`));

      try {
        const results = previewRegexMatches(testFiles, currentPattern, '', currentFlags);

        // Display results in a table
        console.log(chalk.gray('─'.repeat(80)));
        console.log(chalk.gray('Filename'.padEnd(30)) + chalk.gray('Matched') + chalk.gray('  Match Details'));
        console.log(chalk.gray('─'.repeat(80)));

        let matchCount = 0;
        results.forEach((result) => {
          const status = result.matched ? chalk.green('✓') : chalk.red('✗');
          console.log(status + ' ' + result.originalName.substring(0, 29).padEnd(30));

          if (result.matched) {
            matchCount++;
            console.log(chalk.gray('  Match:'), chalk.cyan(result.matchPattern || ''));
            if (Object.keys(result.groups).length > 0) {
              console.log(chalk.gray('  Groups:'));
              Object.entries(result.groups).forEach(([key, value]) => {
                if (value) {
                  console.log(chalk.gray(`    ${key}: ${chalk.yellow(value)}`));
                }
              });
            }
          } else {
            console.log(chalk.gray('  No match'));
          }
          console.log();
        });

        console.log(chalk.gray('─'.repeat(80)));
        console.log(chalk.blue(`Matched: ${matchCount}/${testFiles.length} files\n`));

        // Step 4: Action menu
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: '➕ Add replacement string', value: 'add-replacement' },
              { name: '✏️  Modify pattern', value: 'modify-pattern' },
              { name: '🔄 Change flags', value: 'change-flags' },
              { name: '📝 Use different test files', value: 'change-files' },
              { name: '💾 Export pattern', value: 'export' },
              { name: '❌ Exit', value: 'exit' },
            ],
          },
        ]);

        switch (action) {
          case 'add-replacement':
            const { replacement } = await inquirer.prompt([
              {
                type: 'input',
                name: 'replacement',
                message: 'Enter replacement string (use $1, $2 for capture groups):',
                default: currentReplacement,
              },
            ]);
            currentReplacement = replacement;

            // Show preview with replacement
            console.log(chalk.blue.bold('\n🔄 Preview with Replacement\n'));
            console.log(chalk.white(`Replacement: ${chalk.cyan(currentReplacement)}\n`));

            const replacementResults = previewRegexMatches(testFiles, currentPattern, currentReplacement, currentFlags);

            console.log(chalk.gray('─'.repeat(80)));
            console.log(chalk.gray('Filename'.padEnd(30)) + chalk.gray('→') + chalk.gray(' New Filename'));
            console.log(chalk.gray('─'.repeat(80)));

            replacementResults.forEach((result) => {
              if (result.matched) {
                console.log(chalk.gray(result.originalName.substring(0, 30).padEnd(30)));
                console.log(chalk.gray('→'));
                console.log(chalk.green(result.newFilename));
              } else {
                console.log(chalk.gray(result.originalName.substring(0, 30).padEnd(30)));
                console.log(chalk.gray('→'));
                console.log(chalk.gray('(unchanged)'));
              }
              console.log();
            });

            console.log(chalk.gray('─'.repeat(80)));
            break;

          case 'modify-pattern':
            currentPattern = '';
            break;

          case 'change-flags':
            // Continue loop to show flags selection again
            break;

          case 'change-files':
            const { newFiles } = await inquirer.prompt([
              {
                type: 'input',
                name: 'newFiles',
                message: 'Enter new test filenames (comma-separated):',
                validate: (input: string) => input.trim().length > 0 || 'At least one file is required',
              },
            ]);
            testFiles = newFiles.split(',').map((f: string) => f.trim());
            console.log(chalk.gray('\nTest files updated:\n'));
            testFiles.forEach((file: string, i: number) => {
              console.log(chalk.gray(`  ${i + 1}. ${file}`));
            });
            console.log();
            break;

          case 'export':
            console.log(chalk.green.bold('\n💾 Export Pattern\n'));
            console.log(chalk.white('Pattern:    ') + chalk.cyan(currentPattern));
            console.log(chalk.white('Flags:      ') + chalk.cyan(currentFlags));
            if (currentReplacement) {
              console.log(chalk.white('Replacement:') + chalk.cyan(currentReplacement));
            }
            console.log();
            console.log(chalk.gray('CLI Usage:'));
            console.log(chalk.gray(`  dtb rename --pattern "${currentPattern}" --flags "${currentFlags}"`));
            if (currentReplacement) {
              console.log(chalk.gray(`  dtb rename --pattern "${currentPattern}" --replacement "${currentReplacement}"`));
            }
            console.log();
            break;

          case 'exit':
            building = false;
            break;
        }
      } catch (error) {
        console.log(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
        console.log(chalk.yellow('\nPlease try again with a different pattern.\n'));

        // Clear the invalid pattern
        currentPattern = '';
      }
    }

    console.log(chalk.green('\n✓ Regex builder closed\n'));
  });
