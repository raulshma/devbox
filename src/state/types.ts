/**
 * Global State Management Types
 * Types for runtime state management (separate from persistent configuration)
 */

/**
 * Generic state change event
 */
export interface StateChangeEvent<T = unknown> {
  /** The key that changed (dot notation) */
  key: string;
  /** The old value */
  oldValue: T | undefined;
  /** The new value */
  newValue: T;
  /** Timestamp of the change */
  timestamp: Date;
  /** Optional metadata about the change */
  metadata?: Record<string, unknown>;
}

/**
 * State change listener type
 */
export type StateChangeListener<T = unknown> = (event: StateChangeEvent<T>) => void;

/**
 * State namespace for organizing related state
 */
export interface StateNamespace {
  /** Namespace name */
  name: string;
  /** State data within this namespace */
  data: Record<string, unknown>;
  /** Metadata about the namespace */
  metadata?: {
    created?: Date;
    lastModified?: Date;
    description?: string;
  };
}

/**
 * State history entry for undo/redo functionality
 */
export interface StateHistoryEntry<T = unknown> {
  /** The key that was changed */
  key: string;
  /** Previous value (for undo) */
  previousValue: T | undefined;
  /** New value (for redo) */
  newValue: T;
  /** Timestamp of the change */
  timestamp: Date;
  /** Optional action description */
  description?: string;
}

/**
 * State statistics for monitoring
 */
export interface StateStatistics {
  /** Total number of keys in state */
  totalKeys: number;
  /** Number of namespaces */
  namespaceCount: number;
  /** Number of active listeners */
  listenerCount: number;
  /** Number of history entries (if tracking enabled) */
  historySize: number;
  /** Memory usage estimate (bytes) */
  memoryUsage: number;
  /** State last modified timestamp */
  lastModified: Date | null;
}

/**
 * State management options
 */
export interface StateOptions {
  /** Enable history tracking for undo/redo */
  enableHistory?: boolean;
  /** Maximum history entries to keep (default: 100) */
  maxHistorySize?: number;
  /** Enable state persistence */
  enablePersistence?: boolean;
  /** Persistence file path */
  persistencePath?: string;
  /** Auto-save interval in milliseconds (0 = disabled) */
  autoSaveInterval?: number;
  /** Enable debug mode for state operations */
  debug?: boolean;
  /** Maximum state size in bytes (0 = unlimited) */
  maxStateSize?: number;
}

/**
 * State snapshot for export/import
 */
export interface StateSnapshot {
  /** Snapshot version */
  version: string;
  /** Timestamp when snapshot was created */
  timestamp: Date;
  /** State data */
  data: Record<string, unknown>;
  /** Snapshot metadata */
  metadata?: {
    description?: string;
    tags?: string[];
    [key: string]: unknown;
  };
}

/**
 * State query filter
 */
export interface StateQueryFilter {
  /** Key pattern to match (supports wildcards) */
  keyPattern?: string;
  /** Namespace filter */
  namespace?: string;
  /** Value type filter */
  valueType?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Custom predicate function */
  predicate?: (key: string, value: unknown) => boolean;
}

/**
 * Batch state operation
 */
export interface BatchOperation {
  /** Operation type */
  type: 'set' | 'delete' | 'merge';
  /** Target key */
  key: string;
  /** Value (for set and merge operations) */
  value?: unknown;
}

/**
 * Batch operation result
 */
export interface BatchResult {
  /** Number of successful operations */
  successful: number;
  /** Number of failed operations */
  failed: number;
  /** List of errors */
  errors: Array<{
    key: string;
    error: string;
  }>;
}
