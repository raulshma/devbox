/**
 * Keychain Command
 *
 * Manage passwords stored in the OS keychain for encryption operations
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { promptPassword, promptPasswordWithConfirmation, validatePassword } from '../utils/password.js';
import { Encryption } from '../config/helpers.js';
import {
  storePassword,
  retrievePassword,
  deletePassword,
  listCredentials,
  isKeychainAvailable,
  generateAccountName,
  DEFAULT_SERVICE_NAME,
} from '../utils/keychain.js';

export const keychainCommand = new Command('keychain')
  .description('Manage passwords stored in the OS keychain')
  .alias('kc');

/**
 * List all stored passwords
 */
keychainCommand
  .command('list')
  .description('List all stored passwords in the keychain')
  .option('--keychain-service <service>', 'Custom keychain service name')
  .action(async (options) => {
    const keychainService = options.keychainService || Encryption.getKeychainService();

    console.log(chalk.blue.bold('🔑 Keychain - Stored Passwords\n'));
    console.log(chalk.gray(`Service: ${keychainService}\n`));

    // Check if keychain is available
    const available = await isKeychainAvailable();
    if (!available) {
      console.error(chalk.red('❌ OS keychain is not available on this system'));
      process.exit(1);
    }

    const result = await listCredentials({ service: keychainService });

    if (!result.success) {
      console.error(chalk.red(`❌ Failed to list credentials: ${result.error}`));
      process.exit(1);
    }

    if (!result.data || result.data.length === 0) {
      console.log(chalk.yellow('No passwords stored in keychain.'));
      console.log(chalk.gray('\nUse "devtoolbox encrypt --save-password <name>" to save a password.\n'));
      return;
    }

    console.log(chalk.white(`Found ${result.data.length} stored password(s):\n`));

    for (const cred of result.data) {
      // Extract the friendly name from the account name
      const displayName = cred.account.replace(/^encrypt:/, '');
      console.log(chalk.green(`  • ${displayName}`));
      console.log(chalk.gray(`    Account: ${cred.account}`));
      console.log(chalk.gray(`    Password: ${'*'.repeat(8)} (hidden)`));
      console.log();
    }

    console.log(chalk.gray('Use --use-saved "<name>" with encrypt/decrypt commands to use these passwords.\n'));
  });

/**
 * Store a new password
 */
keychainCommand
  .command('store <name>')
  .description('Store a new password in the keychain')
  .option('--keychain-service <service>', 'Custom keychain service name')
  .option('--skip-validation', 'Skip password strength validation')
  .action(async (name, options) => {
    const keychainService = options.keychainService || Encryption.getKeychainService();

    console.log(chalk.blue.bold('🔑 Keychain - Store Password\n'));

    // Check if keychain is available
    const available = await isKeychainAvailable();
    if (!available) {
      console.error(chalk.red('❌ OS keychain is not available on this system'));
      process.exit(1);
    }

    const accountName = generateAccountName(name, 'encrypt');

    // Check if password already exists
    const existingResult = await retrievePassword(accountName, { service: keychainService });
    if (existingResult.success) {
      console.log(chalk.yellow(`⚠️  A password with name "${name}" already exists.`));
      console.log(chalk.yellow('   It will be overwritten.\n'));
    }

    // Prompt for password with confirmation
    let password: string;
    try {
      password = await promptPasswordWithConfirmation('Enter password to store: ');
      console.log();
    } catch (error) {
      if (error instanceof Error && error.message.includes('do not match')) {
        console.error(chalk.red('\n❌ Passwords do not match'));
      } else {
        console.error(chalk.red('\n❌ Password entry cancelled'));
      }
      process.exit(1);
    }

    // Validate password strength unless skipped
    if (!options.skipValidation) {
      const validation = validatePassword(password);
      if (!validation.valid) {
        console.error(chalk.red.bold('❌ Password validation failed:'));
        validation.errors.forEach((error) => {
          console.error(chalk.red(`  • ${error}`));
        });
        console.error(chalk.yellow('\nUse --skip-validation to bypass password strength checks.\n'));
        process.exit(1);
      }

      // Show password strength
      const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
      const strengthColors = [
        chalk.red,
        chalk.red,
        chalk.yellow,
        chalk.yellow,
        chalk.green,
        chalk.green,
      ];
      console.log(strengthColors[validation.strength](`🔒 Password Strength: ${strengthLabels[validation.strength]} (${validation.score}/100)\n`));
    }

    // Store the password
    const result = await storePassword(accountName, password, { service: keychainService });

    if (result.success) {
      console.log(chalk.green(`✓ Password stored successfully as "${name}"`));
      console.log(chalk.gray(`\nUsage:`));
      console.log(chalk.gray(`  Encrypt: devtoolbox encrypt --use-saved "${name}" -f <files...>`));
      console.log(chalk.gray(`  Decrypt: devtoolbox decrypt --use-saved "${name}" -f <files...>\n`));
    } else {
      console.error(chalk.red(`❌ Failed to store password: ${result.error}`));
      process.exit(1);
    }
  });

/**
 * Delete a stored password
 */
keychainCommand
  .command('delete <name>')
  .description('Delete a password from the keychain')
  .option('--keychain-service <service>', 'Custom keychain service name')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (name, options) => {
    const keychainService = options.keychainService || Encryption.getKeychainService();

    console.log(chalk.blue.bold('🔑 Keychain - Delete Password\n'));

    // Check if keychain is available
    const available = await isKeychainAvailable();
    if (!available) {
      console.error(chalk.red('❌ OS keychain is not available on this system'));
      process.exit(1);
    }

    const accountName = generateAccountName(name, 'encrypt');

    // Check if password exists
    const existingResult = await retrievePassword(accountName, { service: keychainService });
    if (!existingResult.success) {
      console.error(chalk.red(`❌ No password found with name "${name}"`));
      process.exit(1);
    }

    // Confirm deletion unless --yes is provided
    if (!options.yes) {
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(chalk.yellow(`Are you sure you want to delete password "${name}"? (y/N): `), resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log(chalk.gray('\nOperation cancelled.\n'));
        return;
      }
      console.log();
    }

    // Delete the password
    const result = await deletePassword(accountName, { service: keychainService });

    if (result.success) {
      console.log(chalk.green(`✓ Password "${name}" deleted from keychain\n`));
    } else {
      console.error(chalk.red(`❌ Failed to delete password: ${result.error}`));
      process.exit(1);
    }
  });

/**
 * Test keychain availability
 */
keychainCommand
  .command('test')
  .description('Test if OS keychain is available and working')
  .action(async () => {
    console.log(chalk.blue.bold('🔑 Keychain - Availability Test\n'));

    const available = await isKeychainAvailable();

    if (available) {
      console.log(chalk.green('✓ OS keychain is available and working'));
      console.log(chalk.gray('\nYou can use the following features:'));
      console.log(chalk.gray('  • Store passwords: devtoolbox keychain store <name>'));
      console.log(chalk.gray('  • Use saved passwords: devtoolbox encrypt --use-saved <name>'));
      console.log(chalk.gray('  • Save during encryption: devtoolbox encrypt --save-password <name>'));
      console.log(chalk.gray('\nPlatform-specific backend:'));

      const os = await import('os');
      const platform = os.platform();
      switch (platform) {
        case 'darwin':
          console.log(chalk.gray('  • macOS: Keychain Access'));
          break;
        case 'win32':
          console.log(chalk.gray('  • Windows: Credential Manager'));
          break;
        case 'linux':
          console.log(chalk.gray('  • Linux: Secret Service API (libsecret)'));
          break;
        default:
          console.log(chalk.gray(`  • ${platform}: Native keychain`));
      }
      console.log();
    } else {
      console.error(chalk.red('❌ OS keychain is not available'));
      console.error(chalk.yellow('\nPossible reasons:'));
      console.error(chalk.yellow('  • On Linux: libsecret is not installed'));
      console.error(chalk.yellow('  • The keychain service is not running'));
      console.error(chalk.yellow('  • Insufficient permissions\n'));
      process.exit(1);
    }
  });

/**
 * Show a stored password (for debugging/verification)
 */
keychainCommand
  .command('show <name>')
  .description('Show a stored password (use with caution)')
  .option('--keychain-service <service>', 'Custom keychain service name')
  .action(async (name, options) => {
    const keychainService = options.keychainService || Encryption.getKeychainService();

    console.log(chalk.blue.bold('🔑 Keychain - Show Password\n'));
    console.log(chalk.yellow('⚠️  Warning: This will display the password in plain text.\n'));

    // Check if keychain is available
    const available = await isKeychainAvailable();
    if (!available) {
      console.error(chalk.red('❌ OS keychain is not available on this system'));
      process.exit(1);
    }

    const accountName = generateAccountName(name, 'encrypt');
    const result = await retrievePassword(accountName, { service: keychainService });

    if (result.success && result.data) {
      console.log(chalk.white(`Password for "${name}":`));
      console.log(chalk.cyan(`  ${result.data}`));
      console.log();
    } else {
      console.error(chalk.red(`❌ No password found with name "${name}"`));
      process.exit(1);
    }
  });
