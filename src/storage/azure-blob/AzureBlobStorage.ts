/**
 * Azure Blob Storage Implementation
 * Provides Azure Blob Storage operations for file management
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  AzureBlobStorageOptions,
  BlobUploadOptions,
  BlobDownloadOptions,
  BlobListOptions,
  BlobDeleteOptions,
  BlobCopyOptions,
  UploadResult,
  DownloadResult,
  ListResult,
  DeleteResult,
  CopyResult,
  AzureBlobStorageStatistics,
  ContainerInfo,
  BlobInfo,
  UploadProgress,
  DownloadProgress,
} from './types.js';

/**
 * Azure Blob Storage Class
 *
 * Note: This is a mock implementation for demonstration purposes.
 * In production, you would install @azure/storage-blob package:
 * npm install @azure/storage-blob
 *
 * And use:
 * import { BlobServiceClient, ContainerClient, BlobClient } from '@azure/storage-blob';
 */
export class AzureBlobStorage {
  private options: Required<AzureBlobStorageOptions>;
  private isInitialized: boolean = false;
  private mockBlobs: Map<string, Map<string, BlobInfo & { data?: Buffer }>> = new Map(); // container -> blobName -> blobInfo

  constructor(options: AzureBlobStorageOptions) {
    // Note: For testing/mocking purposes, we allow initialization without credentials
    // In production with real Azure SDK, you would uncomment the validation:
    // if (!options.accountName && !options.connectionString) {
    //   throw new Error('Either accountName or connectionString must be provided');
    // }

    this.options = {
      accountName: options.accountName || '',
      accountKey: options.accountKey || '',
      connectionString: options.connectionString || '',
      containerName: options.containerName || 'default-container',
      createContainerIfNotExists: options.createContainerIfNotExists ?? true,
      debug: options.debug ?? false,
    };
  }

  /**
   * Initialize the storage
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.options.debug) {
      console.log('[AzureBlobStorage] Initializing with options:', {
        accountName: this.options.accountName,
        containerName: this.options.containerName,
        createContainerIfNotExists: this.options.createContainerIfNotExists,
      });
    }

    // In production, you would initialize Azure Blob Service Client here
    // Example:
    // const blobServiceClient = BlobServiceClient.fromConnectionString(
    //   this.options.connectionString
    // );
    //
    // if (this.options.createContainerIfNotExists) {
    //   const containerClient = blobServiceClient.getContainerClient(this.options.containerName);
    //   await containerClient.createIfNotExists();
    // }

    // Initialize mock storage
    if (!this.mockBlobs.has(this.options.containerName)) {
      this.mockBlobs.set(this.options.containerName, new Map());
    }

    this.isInitialized = true;

    if (this.options.debug) {
      console.log('[AzureBlobStorage] Initialization complete');
    }
  }

  /**
   * Upload a file to Azure Blob Storage
   */
  async uploadFile(filePath: string, options: BlobUploadOptions): Promise<UploadResult> {
    this.ensureInitialized();

    const containerName = options.containerName || this.options.containerName;
    const blobName = options.blobName;

    if (this.options.debug) {
      console.log(`[AzureBlobStorage] Uploading file: ${filePath} -> ${containerName}/${blobName}`);
    }

    try {
      // Read file content
      const fileContent = await fs.readFile(filePath);
      const contentLength = fileContent.length;

      // Get file stats
      const stats = await fs.stat(filePath);
      const etag = this.generateETag(fileContent);
      const now = new Date();

      // In production, you would use Azure SDK:
      // const blobServiceClient = BlobServiceClient.fromConnectionString(this.options.connectionString);
      // const containerClient = blobServiceClient.getContainerClient(containerName);
      // const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      // await blockBlobClient.uploadData(fileContent, {
      //   blobHTTPHeaders: { blobContentType: options.contentType },
      //   metadata: options.metadata,
      //   tags: options.tags,
      //   tier: options.tier,
      // });

      // Mock implementation
      const containerBlobs = this.mockBlobs.get(containerName) || new Map();
      this.mockBlobs.set(containerName, containerBlobs);

      containerBlobs.set(blobName, {
        name: blobName,
        containerName,
        contentLength,
        contentType: options.contentType || this.getContentType(filePath),
        lastModified: now,
        createdOn: now,
        etag,
        blobType: 'BlockBlob',
        accessTier: options.tier,
        isServerEncrypted: true,
        metadata: options.metadata,
        tags: options.tags,
        data: fileContent,
      });

      if (this.options.debug) {
        console.log(`[AzureBlobStorage] Upload complete: ${blobName} (${contentLength} bytes)`);
      }

      return {
        success: true,
        blobName,
        containerName,
        contentLength,
        etag,
        lastModified: now,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AzureBlobStorage] Upload failed:`, errorMessage);

      return {
        success: false,
        blobName,
        containerName,
        contentLength: 0,
        etag: '',
        lastModified: new Date(),
        error: errorMessage,
      };
    }
  }

  /**
   * Upload buffer/data to Azure Blob Storage
   */
  async uploadData(data: Buffer | string, options: BlobUploadOptions): Promise<UploadResult> {
    this.ensureInitialized();

    const containerName = options.containerName || this.options.containerName;
    const blobName = options.blobName;

    if (this.options.debug) {
      console.log(`[AzureBlobStorage] Uploading data -> ${containerName}/${blobName}`);
    }

    try {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const contentLength = buffer.length;
      const etag = this.generateETag(buffer);
      const now = new Date();

      // Mock implementation
      const containerBlobs = this.mockBlobs.get(containerName) || new Map();
      this.mockBlobs.set(containerName, containerBlobs);

      containerBlobs.set(blobName, {
        name: blobName,
        containerName,
        contentLength,
        contentType: options.contentType || 'application/octet-stream',
        lastModified: now,
        createdOn: now,
        etag,
        blobType: 'BlockBlob',
        accessTier: options.tier,
        isServerEncrypted: true,
        metadata: options.metadata,
        tags: options.tags,
        data: buffer,
      });

      if (this.options.debug) {
        console.log(`[AzureBlobStorage] Upload complete: ${blobName} (${contentLength} bytes)`);
      }

      return {
        success: true,
        blobName,
        containerName,
        contentLength,
        etag,
        lastModified: now,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AzureBlobStorage] Upload failed:`, errorMessage);

      return {
        success: false,
        blobName,
        containerName,
        contentLength: 0,
        etag: '',
        lastModified: new Date(),
        error: errorMessage,
      };
    }
  }

  /**
   * Download a blob from Azure Blob Storage
   */
  async downloadBlob(options: BlobDownloadOptions): Promise<DownloadResult> {
    this.ensureInitialized();

    const containerName = options.containerName || this.options.containerName;
    const blobName = options.blobName;

    if (this.options.debug) {
      console.log(`[AzureBlobStorage] Downloading blob: ${containerName}/${blobName}`);
    }

    try {
      // In production, you would use Azure SDK:
      // const blobServiceClient = BlobServiceClient.fromConnectionString(this.options.connectionString);
      // const containerClient = blobServiceClient.getContainerClient(containerName);
      // const blobClient = containerClient.getBlobClient(blobName);
      // const downloadResponse = await blobClient.download();

      // Mock implementation
      const containerBlobs = this.mockBlobs.get(containerName);
      if (!containerBlobs) {
        throw new Error(`Container not found: ${containerName}`);
      }

      const blob = containerBlobs.get(blobName);
      if (!blob) {
        throw new Error(`Blob not found: ${blobName}`);
      }

      // Save to file if filePath is provided
      if (options.filePath) {
        await fs.mkdir(path.dirname(options.filePath), { recursive: true });
        await fs.writeFile(options.filePath, blob.data || Buffer.alloc(0));

        if (this.options.debug) {
          console.log(`[AzureBlobStorage] Download complete: saved to ${options.filePath}`);
        }

        return {
          success: true,
          blobName,
          containerName,
          contentLength: blob.contentLength,
          contentType: blob.contentType,
          filePath: options.filePath,
        };
      }

      // Return stream (mock - in production use actual stream)
      if (this.options.debug) {
        console.log(`[AzureBlobStorage] Download complete: ${blob.contentLength} bytes`);
      }

      return {
        success: true,
        blobName,
        containerName,
        contentLength: blob.contentLength,
        contentType: blob.contentType,
        stream: undefined as any, // In production, return actual stream from Azure SDK
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AzureBlobStorage] Download failed:`, errorMessage);

      return {
        success: false,
        blobName,
        containerName,
        contentLength: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * List blobs in a container
   */
  async listBlobs(options: BlobListOptions = {}): Promise<ListResult> {
    this.ensureInitialized();

    const containerName = options.containerName || this.options.containerName;

    if (this.options.debug) {
      console.log(`[AzureBlobStorage] Listing blobs in container: ${containerName}`);
    }

    try {
      // In production, you would use Azure SDK:
      // const blobServiceClient = BlobServiceClient.fromConnectionString(this.options.connectionString);
      // const containerClient = blobServiceClient.getContainerClient(containerName);
      // let iterator = containerClient.listBlobsFlat({
      //   prefix: options.prefix,
      //   delimiter: options.delimiter,
      //   include: [...]
      // });

      // Mock implementation
      const containerBlobs = this.mockBlobs.get(containerName);
      if (!containerBlobs) {
        return {
          success: true,
          containerName,
          blobs: [],
          totalCount: 0,
        };
      }

      let blobs = Array.from(containerBlobs.values());

      // Apply filters
      if (options.prefix) {
        blobs = blobs.filter(blob => blob.name.startsWith(options.prefix!));
      }

      // Apply pagination
      if (options.maxResults) {
        blobs = blobs.slice(0, options.maxResults);
      }

      // Remove data field from output
      const blobInfos = blobs.map(({ data, ...rest }) => rest);

      if (this.options.debug) {
        console.log(`[AzureBlobStorage] Listed ${blobInfos.length} blob(s)`);
      }

      return {
        success: true,
        containerName,
        blobs: blobInfos,
        totalCount: blobInfos.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AzureBlobStorage] List failed:`, errorMessage);

      return {
        success: false,
        containerName,
        blobs: [],
        totalCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Delete a blob
   */
  async deleteBlob(options: BlobDeleteOptions): Promise<DeleteResult> {
    this.ensureInitialized();

    const containerName = options.containerName || this.options.containerName;
    const blobName = options.blobName;

    if (this.options.debug) {
      console.log(`[AzureBlobStorage] Deleting blob: ${containerName}/${blobName}`);
    }

    try {
      // In production, you would use Azure SDK:
      // const blobServiceClient = BlobServiceClient.fromConnectionString(this.options.connectionString);
      // const containerClient = blobServiceClient.getContainerClient(containerName);
      // const blobClient = containerClient.getBlobClient(blobName);
      // await blobClient.delete({ deleteSnapshots: options.deleteSnapshots });

      // Mock implementation
      const containerBlobs = this.mockBlobs.get(containerName);
      if (!containerBlobs) {
        throw new Error(`Container not found: ${containerName}`);
      }

      const deleted = containerBlobs.delete(blobName);

      if (this.options.debug) {
        console.log(`[AzureBlobStorage] Blob deleted: ${blobName}`);
      }

      return {
        success: true,
        blobName,
        containerName,
        deleted,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AzureBlobStorage] Delete failed:`, errorMessage);

      return {
        success: false,
        blobName,
        containerName,
        deleted: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Copy a blob
   */
  async copyBlob(options: BlobCopyOptions): Promise<CopyResult> {
    this.ensureInitialized();

    const sourceContainerName = options.sourceContainerName || this.options.containerName;
    const destinationContainerName = options.destinationContainerName || this.options.containerName;

    if (this.options.debug) {
      console.log(`[AzureBlobStorage] Copying blob: ${sourceContainerName}/${options.sourceBlobName} -> ${destinationContainerName}/${options.destinationBlobName}`);
    }

    try {
      // In production, you would use Azure SDK:
      // const blobServiceClient = BlobServiceClient.fromConnectionString(this.options.connectionString);
      // const sourceContainerClient = blobServiceClient.getContainerClient(sourceContainerName);
      // const sourceBlobClient = sourceContainerClient.getBlobClient(options.sourceBlobName);
      // const destContainerClient = blobServiceClient.getContainerClient(destinationContainerName);
      // const destBlobClient = destContainerClient.getBlobClient(options.destinationBlobName);
      // const copyPoller = await destBlobClient.beginCopyFromURL(sourceBlobClient.url);
      // await copyPoller.pollUntilDone();

      // Mock implementation
      const sourceContainerBlobs = this.mockBlobs.get(sourceContainerName);
      if (!sourceContainerBlobs) {
        throw new Error(`Source container not found: ${sourceContainerName}`);
      }

      const sourceBlob = sourceContainerBlobs.get(options.sourceBlobName);
      if (!sourceBlob) {
        throw new Error(`Source blob not found: ${options.sourceBlobName}`);
      }

      const destContainerBlobs = this.mockBlobs.get(destinationContainerName) || new Map();
      this.mockBlobs.set(destinationContainerName, destContainerBlobs);

      const now = new Date();
      const copyId = `copy-${Date.now()}`;

      destContainerBlobs.set(options.destinationBlobName, {
        ...sourceBlob,
        name: options.destinationBlobName,
        containerName: destinationContainerName,
        lastModified: now,
        data: sourceBlob.data,
      });

      if (this.options.debug) {
        console.log(`[AzureBlobStorage] Blob copied: ${copyId}`);
      }

      return {
        success: true,
        sourceBlobName: options.sourceBlobName,
        sourceContainerName,
        destinationBlobName: options.destinationBlobName,
        destinationContainerName,
        copyId,
        copyStatus: 'success',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AzureBlobStorage] Copy failed:`, errorMessage);

      return {
        success: false,
        sourceBlobName: options.sourceBlobName,
        sourceContainerName,
        destinationBlobName: options.destinationBlobName,
        destinationContainerName,
        error: errorMessage,
      };
    }
  }

  /**
   * Get storage statistics
   */
  async getStatistics(): Promise<AzureBlobStorageStatistics> {
    this.ensureInitialized();

    let totalBlobs = 0;
    let totalStorageUsed = 0;
    const blobsByContainer: Record<string, number> = {};
    const storageByContainer: Record<string, number> = {};

    for (const [containerName, blobs] of this.mockBlobs.entries()) {
      const containerBlobCount = blobs.size;
      let containerStorageUsed = 0;

      for (const blob of blobs.values()) {
        containerStorageUsed += blob.contentLength;
      }

      totalBlobs += containerBlobCount;
      totalStorageUsed += containerStorageUsed;

      blobsByContainer[containerName] = containerBlobCount;
      storageByContainer[containerName] = containerStorageUsed;
    }

    return {
      totalContainers: this.mockBlobs.size,
      totalBlobs,
      totalStorageUsed,
      blobsByContainer,
      storageByContainer,
    };
  }

  /**
   * Check if a blob exists
   */
  async blobExists(blobName: string, containerName?: string): Promise<boolean> {
    this.ensureInitialized();

    const container = containerName || this.options.containerName;
    const containerBlobs = this.mockBlobs.get(container);

    return containerBlobs?.has(blobName) ?? false;
  }

  /**
   * Get blob properties
   */
  async getBlobProperties(blobName: string, containerName?: string): Promise<BlobInfo | null> {
    this.ensureInitialized();

    const container = containerName || this.options.containerName;
    const containerBlobs = this.mockBlobs.get(container);

    if (!containerBlobs) {
      return null;
    }

    const blob = containerBlobs.get(blobName);
    if (!blob) {
      return null;
    }

    // Return blob info without data
    const { data, ...blobInfo } = blob;
    return blobInfo;
  }

  /**
   * Close the storage connection
   */
  async close(): Promise<void> {
    this.mockBlobs.clear();
    this.isInitialized = false;

    if (this.options.debug) {
      console.log('[AzureBlobStorage] Closed');
    }
  }

  /**
   * Generate mock ETag
   */
  private generateETag(data: Buffer): string {
    // Simple hash for mock ETag
    const hash = data.reduce((acc, byte) => acc + byte, 0);
    return `"${hash.toString(16)}"`;
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Ensure storage is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('AzureBlobStorage is not initialized. Call initialize() first.');
    }
  }
}

// Singleton instance
let instance: AzureBlobStorage | null = null;

/**
 * Get the singleton storage instance
 */
export function getAzureBlobStorage(options?: AzureBlobStorageOptions): AzureBlobStorage | null {
  if (!instance && options) {
    instance = new AzureBlobStorage(options);
  }
  return instance;
}

/**
 * Initialize the Azure Blob Storage system
 */
export async function initializeAzureBlobStorage(options: AzureBlobStorageOptions): Promise<AzureBlobStorage> {
  const storage = new AzureBlobStorage(options);
  await storage.initialize();
  instance = storage;
  return storage;
}
