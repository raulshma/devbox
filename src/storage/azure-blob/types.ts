/**
 * Azure Blob Storage Types
 * Type definitions for Azure Blob Storage operations
 */

import { Readable } from 'stream';

/**
 * Azure Blob Storage configuration options
 */
export interface AzureBlobStorageOptions {
  /**
   * Azure Storage account name
   */
  accountName: string;

  /**
   * Azure Storage account key or connection string
   */
  accountKey?: string;

  /**
   * Azure Storage connection string (alternative to accountName/accountKey)
   */
  connectionString?: string;

  /**
   * Default container name
   */
  containerName?: string;

  /**
   * Create container if it doesn't exist
   */
  createContainerIfNotExists?: boolean;

  /**
   * Enable detailed logging
   */
  debug?: boolean;
}

/**
 * Blob upload options
 */
export interface BlobUploadOptions {
  /**
   * Blob name (path within container)
   */
  blobName: string;

  /**
   * Container name (overrides default)
   */
  containerName?: string;

  /**
   * Content type (MIME type)
   */
  contentType?: string;

  /**
   * Content encoding
   */
  contentEncoding?: string;

  /**
   * Content language
   */
  contentLanguage?: string;

  /**
   * Cache control
   */
  cacheControl?: string;

  /**
   * Metadata (custom key-value pairs)
   */
  metadata?: Record<string, string>;

  /**
   * Tags (for blob indexing)
   */
  tags?: Record<string, string>;

  /**
   * Tier (access tier)
   */
  tier?: 'Hot' | 'Cool' | 'Archive' | 'Cold';

  /**
   * Upload in parallel chunks
   */
  parallelUpload?: boolean;

  /**
   * Chunk size for parallel upload (in bytes)
   */
  chunkSize?: number;

  /**
   * Progress callback
   */
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * Blob download options
 */
export interface BlobDownloadOptions {
  /**
   * Blob name (path within container)
   */
  blobName: string;

  /**
   * Container name (overrides default)
   */
  containerName?: string;

  /**
   * Local file path to save downloaded blob
   */
  filePath?: string;

  /**
   * Range start (for partial downloads)
   */
  rangeStart?: number;

  /**
   * Range end (for partial downloads)
   */
  rangeEnd?: number;

  /**
   * Progress callback
   */
  onProgress?: (progress: DownloadProgress) => void;
}

/**
 * Blob list options
 */
export interface BlobListOptions {
  /**
   * Container name (overrides default)
   */
  containerName?: string;

  /**
   * Filter by prefix
   */
  prefix?: string;

  /**
   * Filter by delimiter
   */
  delimiter?: string;

  /**
   * Maximum number of results
   */
  maxResults?: number;

  /**
   * Continuation token for pagination
   */
  continuationToken?: string;

  /**
   * Include metadata
   */
  includeMetadata?: boolean;

  /**
   * Include snapshots
   */
  includeSnapshots?: boolean;

  /**
   * Include uncommitted blobs
   */
  includeUncommittedBlobs?: boolean;

  /**
   * Include copy details
   */
  includeCopy?: boolean;

  /**
   * Include deleted blobs
   */
  includeDeleted?: boolean;

  /**
   * Include tags
   */
  includeTags?: boolean;

  /**
   * Include versions
   */
  includeVersions?: boolean;

  /**
   * Include legal hold
   */
  includeLegalHold?: boolean;

  /**
   * Include access control
   */
  includeAccessControl?: boolean;
}

/**
 * Blob delete options
 */
export interface BlobDeleteOptions {
  /**
   * Blob name (path within container)
   */
  blobName: string;

  /**
   * Container name (overrides default)
   */
  containerName?: string;

  /**
   * Delete snapshot
   */
  snapshot?: string;

  /**
   * Delete all snapshots
   */
  deleteSnapshots?: 'include' | 'only';

  /**
   * Soft delete (if enabled)
   */
  deleteDisposition?: 'permanent' | 'soft';
}

/**
 * Blob copy options
 */
export interface BlobCopyOptions {
  /**
   * Source blob name
   */
  sourceBlobName: string;

  /**
   * Destination blob name
   */
  destinationBlobName: string;

  /**
   * Source container name (overrides default)
   */
  sourceContainerName?: string;

  /**
   * Destination container name (overrides default)
   */
  destinationContainerName?: string;

  /**
   * Source snapshot ID
   */
  sourceSnapshot?: string;

  /**
   * Metadata for destination blob
   */
  metadata?: Record<string, string>;

  /**
   * Tags for destination blob
   */
  tags?: Record<string, string>;

  /**
   * Tier for destination blob
   */
  tier?: 'Hot' | 'Cool' | 'Archive' | 'Cold';

  /**
   * Rehydrate priority (for restoring from archive)
   */
  rehydratePriority?: 'High' | 'Standard';
}

/**
 * Container information
 */
export interface ContainerInfo {
  /**
   * Container name
   */
  name: string;

  /**
   * Container public access level
   */
  publicAccess: 'container' | 'blob' | 'private';

  /**
   * Last modified date
   */
  lastModified: Date;

  /**
   * ETag
   */
  etag: string;

  /**
   * Has immutability policy
   */
  hasImmutabilityPolicy: boolean;

  /**
   * Has legal hold
   */
  hasLegalHold: boolean;

  /**
   * Lease status
   */
  leaseStatus: 'locked' | 'unlocked';

  /**
   * Lease state
   */
  leaseState: 'available' | 'leased' | 'expired' | 'breaking' | 'broken';

  /**
   * Metadata
   */
  metadata?: Record<string, string>;
}

/**
 * Blob information
 */
export interface BlobInfo {
  /**
   * Blob name
   */
  name: string;

  /**
   * Container name
   */
  containerName: string;

  /**
   * Content type
   */
  contentType?: string;

  /**
   * Content length (in bytes)
   */
  contentLength: number;

  /**
   * Content encoding
   */
  contentEncoding?: string;

  /**
   * Content language
   */
  contentLanguage?: string;

  /**
   * Cache control
   */
  cacheControl?: string;

  /**
   * Last modified date
   */
  lastModified: Date;

  /**
   * Creation date
   */
  createdOn?: Date;

  /**
   * ETag
   */
  etag: string;

  /**
   * Blob type
   */
  blobType: 'BlockBlob' | 'AppendBlob' | 'PageBlob';

  /**
   * Access tier
   */
  accessTier?: 'Hot' | 'Cool' | 'Archive' | 'Cold';

  /**
   * Access tier change date
   */
  accessTierChangeDate?: Date;

  /**
   * Is current version
   */
  isCurrentVersion?: boolean;

  /**
   * Version ID
   */
  versionId?: string;

  /**
   * Is deleted
   */
  isDeleted?: boolean;

  /**
   * Is server encrypted
   */
  isServerEncrypted: boolean;

  /**
   * Metadata
   */
  metadata?: Record<string, string>;

  /**
   * Tags
   */
  tags?: Record<string, string>;

  /**
   * Snapshot ID
   */
  snapshot?: string;

  /**
   * Lease status
   */
  leaseStatus?: 'locked' | 'unlocked';

  /**
   * Has legal hold
   */
  hasLegalHold?: boolean;
}

/**
 * Upload progress information
 */
export interface UploadProgress {
  /**
   * Bytes uploaded
   */
  uploadedBytes: number;

  /**
   * Total bytes
   */
  totalBytes: number;

  /**
   * Progress percentage (0-100)
   */
  percentage: number;

  /**
   * Upload speed (bytes/second)
   */
  speed?: number;

  /**
   * Estimated time remaining (seconds)
   */
  eta?: number;
}

/**
 * Download progress information
 */
export interface DownloadProgress {
  /**
   * Bytes downloaded
   */
  downloadedBytes: number;

  /**
   * Total bytes
   */
  totalBytes: number;

  /**
   * Progress percentage (0-100)
   */
  percentage: number;

  /**
   * Download speed (bytes/second)
   */
  speed?: number;

  /**
   * Estimated time remaining (seconds)
   */
  eta?: number;
}

/**
 * Upload result
 */
export interface UploadResult {
  /**
   * Success flag
   */
  success: boolean;

  /**
   * Blob name
   */
  blobName: string;

  /**
   * Container name
   */
  containerName: string;

  /**
   * Content length (in bytes)
   */
  contentLength: number;

  /**
   * ETag
   */
  etag: string;

  /**
   * Last modified date
   */
  lastModified: Date;

  /**
   * Version ID
   */
  versionId?: string;

  /**
   * Error message (if failed)
   */
  error?: string;
}

/**
 * Download result
 */
export interface DownloadResult {
  /**
   * Success flag
   */
  success: boolean;

  /**
   * Blob name
   */
  blobName: string;

  /**
   * Container name
   */
  containerName: string;

  /**
   * Content length (in bytes)
   */
  contentLength: number;

  /**
   * Content type
   */
  contentType?: string;

  /**
   * Local file path (if saved)
   */
  filePath?: string;

  /**
   * Data stream (if not saved)
   */
  stream?: Readable;

  /**
   * Error message (if failed)
   */
  error?: string;
}

/**
 * List result
 */
export interface ListResult {
  /**
   * Success flag
   */
  success: boolean;

  /**
   * Container name
   */
  containerName: string;

  /**
   * List of blobs
   */
  blobs: BlobInfo[];

  /**
   * Continuation token (for pagination)
   */
  continuationToken?: string;

  /**
   * Total count
   */
  totalCount: number;

  /**
   * Error message (if failed)
   */
  error?: string;
}

/**
 * Delete result
 */
export interface DeleteResult {
  /**
   * Success flag
   */
  success: boolean;

  /**
   * Blob name
   */
  blobName: string;

  /**
   * Container name
   */
  containerName: string;

  /**
   * Was deleted
   */
  deleted: boolean;

  /**
   * Error message (if failed)
   */
  error?: string;
}

/**
 * Copy result
 */
export interface CopyResult {
  /**
   * Success flag
   */
  success: boolean;

  /**
   * Source blob name
   */
  sourceBlobName: string;

  /**
   * Source container name
   */
  sourceContainerName: string;

  /**
   * Destination blob name
   */
  destinationBlobName: string;

  /**
   * Destination container name
   */
  destinationContainerName: string;

  /**
   * Copy ID
   */
  copyId?: string;

  /**
   * Copy status
   */
  copyStatus?: 'pending' | 'success' | 'aborted' | 'failed';

  /**
   * Error message (if failed)
   */
  error?: string;
}

/**
 * Storage statistics
 */
export interface AzureBlobStorageStatistics {
  /**
   * Total number of containers
   */
  totalContainers: number;

  /**
   * Total number of blobs across all containers
   */
  totalBlobs: number;

  /**
   * Total storage used (in bytes)
   */
  totalStorageUsed: number;

  /**
   * Blob count by container
   */
  blobsByContainer: Record<string, number>;

  /**
   * Storage used by container (in bytes)
   */
  storageByContainer: Record<string, number>;
}
