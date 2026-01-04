/**
 * Azure Blob Storage Command
 *
 * Command-line interface for Azure Blob Storage operations
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  AzureBlobStorage,
  initializeAzureBlobStorage,
} from '../storage/azure-blob/index.js';
import type { AzureBlobStorageOptions } from '../storage/azure-blob/types.js';

/**
 * Upload command
 */
const uploadCommand = new Command('upload')
  .description('Upload a file to Azure Blob Storage')
  .argument('<file>', 'File path to upload')
  .option('-n, --blob-name <name>', 'Blob name (path within container)')
  .option('-c, --container <name>', 'Container name')
  .option('-a, --account <name>', 'Azure Storage account name')
  .option('-k, --account-key <key>', 'Azure Storage account key')
  .option('-s, --connection-string <string>', 'Azure Storage connection string')
  .option('--content-type <type>', 'Content type (MIME type)')
  .option('--tier <tier>', 'Access tier (Hot, Cool, Archive, Cold)')
  .option('--metadata <json>', 'Metadata as JSON string')
  .option('--dry-run', 'Preview the upload without executing')
  .addHelpText('after', '\nExamples:\n' +
    '  $ azure-blob upload myfile.txt --blob-name documents/myfile.txt\n' +
    '  $ azure-blob upload myfile.txt --container mycontainer --blob-name data/file.txt\n' +
    '  $ azure-blob upload myfile.txt --tier Cool --metadata \'{"author":"John"}\'\n' +
    '  $ azure-blob upload myfile.txt --connection-string "DefaultEndpointsProtocol=https;..."\n')
  .action(async (file, options) => {
    try {
      console.log(chalk.blue.bold('☁️  Azure Blob Storage - Upload File\n'));

      // Validate file exists
      try {
        await fs.access(file);
      } catch {
        console.error(chalk.red(`✗ File not found: ${file}`));
        process.exit(1);
      }

      // Get blob name
      const blobName = options.blobName || path.basename(file);

      // Build Azure storage options
      const storageOptions: AzureBlobStorageOptions = {
        accountName: options.account,
        accountKey: options.accountKey,
        connectionString: options.connectionString,
        containerName: options.container || 'default-container',
        createContainerIfNotExists: true,
        debug: false,
      };

      if (options.dryRun) {
        console.log(chalk.yellow('⚠️  Dry-run mode: No actual upload will be performed\n'));
        console.log(chalk.cyan(`📁 File: ${file}`));
        console.log(chalk.cyan(`📦 Blob: ${storageOptions.containerName}/${blobName}`));
        if (options.contentType) {
          console.log(chalk.cyan(`📝 Content-Type: ${options.contentType}`));
        }
        if (options.tier) {
          console.log(chalk.cyan(`🏷️  Tier: ${options.tier}`));
        }
        if (options.metadata) {
          console.log(chalk.cyan(`📋 Metadata: ${options.metadata}`));
        }
        console.log(chalk.gray('\n(Dry-run complete - no changes made)'));
        return;
      }

      // Initialize storage
      const spinner = chalk.cyan('⏳ Initializing Azure Blob Storage...');
      console.log(spinner);
      const storage = await initializeAzureBlobStorage(storageOptions);
      console.log(chalk.green('✓ Connected to Azure Blob Storage\n'));

      // Parse metadata if provided
      let metadata: Record<string, string> | undefined;
      if (options.metadata) {
        try {
          metadata = JSON.parse(options.metadata);
        } catch {
          console.error(chalk.red('✗ Invalid JSON in metadata option'));
          process.exit(1);
        }
      }

      // Upload file
      console.log(chalk.cyan(`⏳ Uploading ${file} → ${storageOptions.containerName}/${blobName}`));

      const result = await storage.uploadFile(file, {
        blobName,
        containerName: options.container,
        contentType: options.contentType,
        tier: options.tier as any,
        metadata,
      });

      if (result.success) {
        console.log(chalk.green(`✓ Upload successful!\n`));
        console.log(chalk.gray(`  Blob: ${result.containerName}/${result.blobName}`));
        console.log(chalk.gray(`  Size: ${result.contentLength} bytes`));
        console.log(chalk.gray(`  ETag: ${result.etag}`));
        console.log(chalk.gray(`  Last Modified: ${result.lastModified.toISOString()}`));
      } else {
        console.error(chalk.red(`✗ Upload failed: ${result.error}`));
        process.exit(1);
      }

      // Close storage
      await storage.close();
    } catch (error) {
      console.error(chalk.red(`✗ Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

/**
 * Download command
 */
const downloadCommand = new Command('download')
  .description('Download a blob from Azure Blob Storage')
  .argument('<blob-name>', 'Blob name to download')
  .option('-f, --file <path>', 'Local file path to save the blob')
  .option('-c, --container <name>', 'Container name')
  .option('-a, --account <name>', 'Azure Storage account name')
  .option('-k, --account-key <key>', 'Azure Storage account key')
  .option('-s, --connection-string <string>', 'Azure Storage connection string')
  .addHelpText('after', '\nExamples:\n' +
    '  $ azure-blob download documents/myfile.txt --file myfile.txt\n' +
    '  $ azure-blob download data/file.txt --container mycontainer --file ./downloads/file.txt\n')
  .action(async (blobName, options) => {
    try {
      console.log(chalk.blue.bold('☁️  Azure Blob Storage - Download Blob\n'));

      // Get file path
      const filePath = options.file || path.basename(blobName);

      // Build Azure storage options
      const storageOptions: AzureBlobStorageOptions = {
        accountName: options.account,
        accountKey: options.accountKey,
        connectionString: options.connectionString,
        containerName: options.container || 'default-container',
        createContainerIfNotExists: true,
        debug: false,
      };

      // Initialize storage
      const spinner = chalk.cyan('⏳ Initializing Azure Blob Storage...');
      console.log(spinner);
      const storage = await initializeAzureBlobStorage(storageOptions);
      console.log(chalk.green('✓ Connected to Azure Blob Storage\n'));

      // Download blob
      console.log(chalk.cyan(`⏳ Downloading ${storageOptions.containerName}/${blobName} → ${filePath}`));

      const result = await storage.downloadBlob({
        blobName,
        containerName: options.container,
        filePath,
      });

      if (result.success) {
        console.log(chalk.green(`✓ Download successful!\n`));
        console.log(chalk.gray(`  Blob: ${result.containerName}/${result.blobName}`));
        console.log(chalk.gray(`  Size: ${result.contentLength} bytes`));
        if (result.contentType) {
          console.log(chalk.gray(`  Content-Type: ${result.contentType}`));
        }
        console.log(chalk.gray(`  Saved to: ${result.filePath}`));
      } else {
        console.error(chalk.red(`✗ Download failed: ${result.error}`));
        process.exit(1);
      }

      // Close storage
      await storage.close();
    } catch (error) {
      console.error(chalk.red(`✗ Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

/**
 * List command
 */
const listCommand = new Command('list')
  .description('List blobs in a container')
  .option('-c, --container <name>', 'Container name')
  .option('-a, --account <name>', 'Azure Storage account name')
  .option('-k, --account-key <key>', 'Azure Storage account key')
  .option('-s, --connection-string <string>', 'Azure Storage connection string')
  .option('-p, --prefix <prefix>', 'Filter blobs by prefix')
  .option('-m, --max-results <number>', 'Maximum number of results', '100')
  .addHelpText('after', '\nExamples:\n' +
    '  $ azure-blob list\n' +
    '  $ azure-blob list --container mycontainer\n' +
    '  $ azure-blob list --prefix "documents/" --max-results 50\n')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('☁️  Azure Blob Storage - List Blobs\n'));

      // Build Azure storage options
      const storageOptions: AzureBlobStorageOptions = {
        accountName: options.account,
        accountKey: options.accountKey,
        connectionString: options.connectionString,
        containerName: options.container || 'default-container',
        createContainerIfNotExists: true,
        debug: false,
      };

      // Initialize storage
      const spinner = chalk.cyan('⏳ Initializing Azure Blob Storage...');
      console.log(spinner);
      const storage = await initializeAzureBlobStorage(storageOptions);
      console.log(chalk.green('✓ Connected to Azure Blob Storage\n'));

      // List blobs
      console.log(chalk.cyan(`⏳ Listing blobs in ${storageOptions.containerName}`));

      const result = await storage.listBlobs({
        containerName: options.container,
        prefix: options.prefix,
        maxResults: parseInt(options.maxResults, 10),
      });

      if (result.success) {
        console.log(chalk.green(`✓ Found ${result.totalCount} blob(s)\n`));

        if (result.blobs.length === 0) {
          console.log(chalk.gray('  (No blobs found)'));
        } else {
          result.blobs.forEach((blob, index) => {
            console.log(chalk.cyan(`  ${index + 1}. ${blob.name}`));
            console.log(chalk.gray(`     Size: ${blob.contentLength} bytes`));
            if (blob.contentType) {
              console.log(chalk.gray(`     Type: ${blob.contentType}`));
            }
            console.log(chalk.gray(`     Modified: ${blob.lastModified.toISOString()}`));
            if (blob.accessTier) {
              console.log(chalk.gray(`     Tier: ${blob.accessTier}`));
            }
            console.log('');
          });
        }
      } else {
        console.error(chalk.red(`✗ List failed: ${result.error}`));
        process.exit(1);
      }

      // Close storage
      await storage.close();
    } catch (error) {
      console.error(chalk.red(`✗ Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

/**
 * Delete command
 */
const deleteCommand = new Command('delete')
  .description('Delete a blob from Azure Blob Storage')
  .argument('<blob-name>', 'Blob name to delete')
  .option('-c, --container <name>', 'Container name')
  .option('-a, --account <name>', 'Azure Storage account name')
  .option('-k, --account-key <key>', 'Azure Storage account key')
  .option('-s, --connection-string <string>', 'Azure Storage connection string')
  .option('-y, --yes', 'Skip confirmation prompt')
  .addHelpText('after', '\nExamples:\n' +
    '  $ azure-blob delete documents/myfile.txt\n' +
    '  $ azure-blob delete data/file.txt --container mycontainer --yes\n')
  .action(async (blobName, options) => {
    try {
      console.log(chalk.blue.bold('☁️  Azure Blob Storage - Delete Blob\n'));

      // Build Azure storage options
      const storageOptions: AzureBlobStorageOptions = {
        accountName: options.account,
        accountKey: options.accountKey,
        connectionString: options.connectionString,
        containerName: options.container || 'default-container',
        createContainerIfNotExists: true,
        debug: false,
      };

      // Confirm deletion unless --yes is provided
      if (!options.yes) {
        console.log(chalk.yellow(`⚠️  You are about to delete: ${storageOptions.containerName}/${blobName}`));
        console.log(chalk.gray('This action cannot be undone!\n'));

        // In a real CLI, you would use inquirer for prompts
        // For simplicity, we require --yes flag
        console.log(chalk.gray('Please use the --yes flag to confirm deletion.'));
        console.log(chalk.gray('Example: azure-blob delete myfile.txt --yes\n'));
        process.exit(0);
      }

      // Initialize storage
      const spinner = chalk.cyan('⏳ Initializing Azure Blob Storage...');
      console.log(spinner);
      const storage = await initializeAzureBlobStorage(storageOptions);
      console.log(chalk.green('✓ Connected to Azure Blob Storage\n'));

      // Delete blob
      console.log(chalk.cyan(`⏳ Deleting ${storageOptions.containerName}/${blobName}`));

      const result = await storage.deleteBlob({
        blobName,
        containerName: options.container,
      });

      if (result.success) {
        console.log(chalk.green(`✓ Blob deleted successfully!\n`));
        console.log(chalk.gray(`  Blob: ${result.containerName}/${result.blobName}`));
      } else {
        console.error(chalk.red(`✗ Delete failed: ${result.error}`));
        process.exit(1);
      }

      // Close storage
      await storage.close();
    } catch (error) {
      console.error(chalk.red(`✗ Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

/**
 * Copy command
 */
const copyCommand = new Command('copy')
  .description('Copy a blob within Azure Blob Storage')
  .argument('<source>', 'Source blob name')
  .argument('<destination>', 'Destination blob name')
  .option('-c, --container <name>', 'Container name (for both source and destination)')
  .option('--source-container <name>', 'Source container name')
  .option('--dest-container <name>', 'Destination container name')
  .option('-a, --account <name>', 'Azure Storage account name')
  .option('-k, --account-key <key>', 'Azure Storage account key')
  .option('-s, --connection-string <string>', 'Azure Storage connection string')
  .addHelpText('after', '\nExamples:\n' +
    '  $ azure-blob copy documents/old.txt documents/new.txt\n' +
    '  $ azure-blob copy file.txt backup/file.txt --dest-container backups\n')
  .action(async (source, destination, options) => {
    try {
      console.log(chalk.blue.bold('☁️  Azure Blob Storage - Copy Blob\n'));

      // Build Azure storage options
      const storageOptions: AzureBlobStorageOptions = {
        accountName: options.account,
        accountKey: options.accountKey,
        connectionString: options.connectionString,
        containerName: options.container || 'default-container',
        createContainerIfNotExists: true,
        debug: false,
      };

      // Initialize storage
      const spinner = chalk.cyan('⏳ Initializing Azure Blob Storage...');
      console.log(spinner);
      const storage = await initializeAzureBlobStorage(storageOptions);
      console.log(chalk.green('✓ Connected to Azure Blob Storage\n'));

      // Copy blob
      const sourceContainer = options.sourceContainer || options.container || storageOptions.containerName;
      const destContainer = options.destContainer || options.container || storageOptions.containerName;

      console.log(chalk.cyan(`⏳ Copying ${sourceContainer}/${source} → ${destContainer}/${destination}`));

      const result = await storage.copyBlob({
        sourceBlobName: source,
        destinationBlobName: destination,
        sourceContainerName: sourceContainer,
        destinationContainerName: destContainer,
      });

      if (result.success) {
        console.log(chalk.green(`✓ Blob copied successfully!\n`));
        console.log(chalk.gray(`  Source: ${result.sourceContainerName}/${result.sourceBlobName}`));
        console.log(chalk.gray(`  Destination: ${result.destinationContainerName}/${result.destinationBlobName}`));
        if (result.copyId) {
          console.log(chalk.gray(`  Copy ID: ${result.copyId}`));
        }
      } else {
        console.error(chalk.red(`✗ Copy failed: ${result.error}`));
        process.exit(1);
      }

      // Close storage
      await storage.close();
    } catch (error) {
      console.error(chalk.red(`✗ Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

/**
 * Stats command
 */
const statsCommand = new Command('stats')
  .description('Get storage statistics')
  .option('-a, --account <name>', 'Azure Storage account name')
  .option('-k, --account-key <key>', 'Azure Storage account key')
  .option('-s, --connection-string <string>', 'Azure Storage connection string')
  .addHelpText('after', '\nExamples:\n' +
    '  $ azure-blob stats\n' +
    '  $ azure-blob stats --connection-string "DefaultEndpointsProtocol=https;..."\n')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('☁️  Azure Blob Storage - Statistics\n'));

      // Build Azure storage options
      const storageOptions: AzureBlobStorageOptions = {
        accountName: options.account,
        accountKey: options.accountKey,
        connectionString: options.connectionString,
        containerName: 'default-container',
        createContainerIfNotExists: true,
        debug: false,
      };

      // Initialize storage
      const spinner = chalk.cyan('⏳ Initializing Azure Blob Storage...');
      console.log(spinner);
      const storage = await initializeAzureBlobStorage(storageOptions);
      console.log(chalk.green('✓ Connected to Azure Blob Storage\n'));

      // Get statistics
      const stats = await storage.getStatistics();

      console.log(chalk.cyan('📊 Storage Statistics\n'));
      console.log(chalk.gray(`  Total Containers: ${stats.totalContainers}`));
      console.log(chalk.gray(`  Total Blobs: ${stats.totalBlobs}`));
      console.log(chalk.gray(`  Total Storage Used: ${formatBytes(stats.totalStorageUsed)}\n`));

      if (Object.keys(stats.blobsByContainer).length > 0) {
        console.log(chalk.cyan('📦 By Container:\n'));
        for (const [container, count] of Object.entries(stats.blobsByContainer)) {
          const storageUsed = stats.storageByContainer[container];
          console.log(chalk.gray(`  ${container}:`));
          console.log(chalk.gray(`    Blobs: ${count}`));
          console.log(chalk.gray(`    Storage: ${formatBytes(storageUsed)}`));
        }
      }

      // Close storage
      await storage.close();
    } catch (error) {
      console.error(chalk.red(`✗ Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

/**
 * Export all Azure Blob Storage commands
 */
export const azureBlobCommand = new Command('azure-blob')
  .description('Azure Blob Storage operations')
  .alias('azblob');

azureBlobCommand.addCommand(uploadCommand);
azureBlobCommand.addCommand(downloadCommand);
azureBlobCommand.addCommand(listCommand);
azureBlobCommand.addCommand(deleteCommand);
azureBlobCommand.addCommand(copyCommand);
azureBlobCommand.addCommand(statsCommand);

export { azureBlobCommand as default };

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
