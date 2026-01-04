/**
 * Global State Manager
 * Manages runtime state for the Developer Toolbox CLI
 * This is separate from configuration - it holds transient application state
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  StateChangeEvent,
  StateChangeListener,
  StateHistoryEntry,
  StateOptions,
  StateSnapshot,
  StateStatistics,
  StateQueryFilter,
  BatchOperation,
  BatchResult,
} from './types.js';

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T;
  }
  if (obj instanceof Object) {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        (clonedObj as any)[key] = deepClone((obj as any)[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * Deep merge objects
 */
function deepMerge<T>(target: any, source: any): T {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output as T;
}

function isObject(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Calculate approximate memory size of an object
 */
function calculateSize(obj: unknown): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

/**
 * Global State Manager Class
 */
export class GlobalStateManager {
  private state: Record<string, unknown> = {};
  private listeners: Map<string, Set<StateChangeListener>> = new Map();
  private globalListeners: Set<StateChangeListener> = new Set();
  private history: StateHistoryEntry[] = [];
  private historyIndex: number = -1;
  private options: Required<StateOptions>;
  private lastModified: Date | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor(options: StateOptions = {}) {
    this.options = {
      enableHistory: options.enableHistory ?? true,
      maxHistorySize: options.maxHistorySize ?? 100,
      enablePersistence: options.enablePersistence ?? false,
      persistencePath: options.persistencePath ?? '.devtoolbox-state.json',
      autoSaveInterval: options.autoSaveInterval ?? 0,
      debug: options.debug ?? false,
      maxStateSize: options.maxStateSize ?? 0,
    };
  }

  /**
   * Initialize the state manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.options.debug) {
      console.log('[GlobalStateManager] Initializing with options:', this.options);
    }

    // Load persisted state if enabled
    if (this.options.enablePersistence) {
      await this.loadPersistedState();
    }

    // Setup auto-save if enabled
    if (this.options.autoSaveInterval > 0) {
      this.setupAutoSave();
    }

    this.isInitialized = true;
    this.lastModified = new Date();

    if (this.options.debug) {
      console.log('[GlobalStateManager] Initialization complete');
    }
  }

  /**
   * Get a value from state using dot notation
   */
  get<T = unknown>(key: string): T | undefined {
    const keys = key.split('.');
    let value: any = this.state;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return deepClone(value) as T;
  }

  /**
   * Set a value in state using dot notation
   */
  async set<T = unknown>(key: string, value: T, metadata?: Record<string, unknown>): Promise<void> {
    const oldValue = this.get(key);

    // Check state size limit
    if (this.options.maxStateSize > 0) {
      const newSize = calculateSize({ ...this.state, [key]: value });
      if (newSize > this.options.maxStateSize) {
        throw new Error(`State size limit exceeded: ${newSize} > ${this.options.maxStateSize} bytes`);
      }
    }

    // Store in history if enabled
    if (this.options.enableHistory) {
      this.addToHistory(key, oldValue, value);
    }

    // Set the value
    this.setSilently(this.state, key, value);
    this.lastModified = new Date();

    // Emit change event
    this.emitChange(key, oldValue, value, metadata);

    // Auto-save if enabled
    if (this.options.enablePersistence && this.options.autoSaveInterval === 0) {
      await this.savePersistedState();
    }

    if (this.options.debug) {
      console.log(`[GlobalStateManager] Set: ${key} =`, value);
    }
  }

  /**
   * Delete a value from state
   */
  async delete(key: string): Promise<boolean> {
    const oldValue = this.get(key);
    if (oldValue === undefined) {
      return false;
    }

    // Store in history if enabled
    if (this.options.enableHistory) {
      this.addToHistory(key, oldValue, undefined);
    }

    // Delete the value
    const keys = key.split('.');
    let current: any = this.state;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        return false;
      }
      current = current[keys[i]];
    }

    delete current[keys[keys.length - 1]];
    this.lastModified = new Date();

    // Emit change event
    this.emitChange(key, oldValue, undefined);

    // Auto-save if enabled
    if (this.options.enablePersistence && this.options.autoSaveInterval === 0) {
      await this.savePersistedState();
    }

    if (this.options.debug) {
      console.log(`[GlobalStateManager] Deleted: ${key}`);
    }

    return true;
  }

  /**
   * Merge an object into state
   */
  async merge(partialState: Record<string, unknown>, metadata?: Record<string, unknown>): Promise<void> {
    const oldState = deepClone(this.state);

    // Check state size limit
    if (this.options.maxStateSize > 0) {
      const newSize = calculateSize(deepMerge(this.state, partialState));
      if (newSize > this.options.maxStateSize) {
        throw new Error(`State size limit exceeded: ${newSize} > ${this.options.maxStateSize} bytes`);
      }
    }

    // Store in history if enabled
    if (this.options.enableHistory) {
      this.addToHistory('*', oldState, deepMerge(this.state, partialState));
    }

    // Perform merge
    this.state = deepMerge(this.state, partialState);
    this.lastModified = new Date();

    // Emit change events for top-level keys
    for (const key of Object.keys(partialState)) {
      this.emitChange(key, oldState[key], (this.state as any)[key], metadata);
    }

    // Auto-save if enabled
    if (this.options.enablePersistence && this.options.autoSaveInterval === 0) {
      await this.savePersistedState();
    }

    if (this.options.debug) {
      console.log('[GlobalStateManager] Merged:', partialState);
    }
  }

  /**
   * Check if a key exists in state
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Get all keys in state (optionally filtered by pattern)
   */
  keys(pattern?: string): string[] {
    const allKeys = this.getAllKeys(this.state, '');
    if (!pattern) {
      return allKeys;
    }

    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);

    return allKeys.filter(key => regex.test(key));
  }

  /**
   * Query state with filters
   */
  query(filter: StateQueryFilter): Record<string, unknown> {
    let results: Record<string, unknown> = {};

    const allKeys = this.keys(filter.keyPattern);

    for (const key of allKeys) {
      const value = this.get(key);

      // Apply namespace filter
      if (filter.namespace && !key.startsWith(filter.namespace + '.')) {
        continue;
      }

      // Apply value type filter
      if (filter.valueType) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== filter.valueType) {
          continue;
        }
      }

      // Apply custom predicate
      if (filter.predicate && !filter.predicate(key, value)) {
        continue;
      }

      results[key] = value;
    }

    return results;
  }

  /**
   * Execute a batch of operations
   */
  async batch(operations: BatchOperation[]): Promise<BatchResult> {
    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const op of operations) {
      try {
        switch (op.type) {
          case 'set':
            await this.set(op.key, op.value);
            break;
          case 'delete':
            await this.delete(op.key);
            break;
          case 'merge':
            if (op.value && typeof op.value === 'object') {
              await this.merge({ [op.key]: op.value });
            }
            break;
        }
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          key: op.key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Execute a batch of operations in parallel using worker threads
   */
  async batchParallel(operations: BatchOperation[], concurrency?: number): Promise<BatchResult> {
    // Dynamic import to avoid circular dependencies
    const { executeParallel } = await import('../utils/parallelProcessor.js');

    // Convert operations to parallel tasks
    const tasks = operations.map((op, index) => ({
      id: `batch-op-${index}`,
      input: op,
      metadata: { index },
    }));

    // Execute in parallel with concurrency control
    const processor = async (operation: BatchOperation) => {
      switch (operation.type) {
        case 'set':
          await this.set(operation.key, operation.value);
          return { success: true };
        case 'delete':
          await this.delete(operation.key);
          return { success: true };
        case 'merge':
          if (operation.value && typeof operation.value === 'object') {
            await this.merge({ [operation.key]: operation.value });
          }
          return { success: true };
        default:
          throw new Error(`Unknown operation type: ${(operation as any).type}`);
      }
    };

    const results = await executeParallel(tasks, processor, {
      maxWorkers: concurrency,
      taskTimeout: 30000,
      debug: this.options.debug,
    });

    // Aggregate results
    const batchResult: BatchResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const result of results) {
      if (result.success) {
        batchResult.successful++;
      } else {
        batchResult.failed++;
        const originalOp = operations[parseInt(result.id.split('-')[2])];
        batchResult.errors.push({
          key: originalOp.key,
          error: result.error || 'Unknown error',
        });
      }
    }

    return batchResult;
  }

  /**
   * Register a listener for a specific key
   */
  on(key: string, listener: StateChangeListener): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => this.off(key, listener);
  }

  /**
   * Register a global listener for all changes
   */
  onAny(listener: StateChangeListener): () => void {
    this.globalListeners.add(listener);
    return () => this.offAny(listener);
  }

  /**
   * Remove a listener for a specific key
   */
  off(key: string, listener: StateChangeListener): void {
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.delete(listener);
      if (keyListeners.size === 0) {
        this.listeners.delete(key);
      }
    }
  }

  /**
   * Remove a global listener
   */
  offAny(listener: StateChangeListener): void {
    this.globalListeners.delete(listener);
  }

  /**
   * Create a snapshot of the current state
   */
  createSnapshot(metadata?: { description?: string; tags?: string[] }): StateSnapshot {
    return {
      version: '1.0.0',
      timestamp: new Date(),
      data: deepClone(this.state),
      metadata,
    };
  }

  /**
   * Restore state from a snapshot
   */
  async restoreSnapshot(snapshot: StateSnapshot): Promise<void> {
    if (this.options.enableHistory) {
      this.addToHistory('*', deepClone(this.state), snapshot.data as Record<string, unknown>);
    }

    this.state = deepClone(snapshot.data) as Record<string, unknown>;
    this.lastModified = new Date();

    // Emit change for entire state
    this.emitChange('*', deepClone(this.state), this.state);

    // Auto-save if enabled
    if (this.options.enablePersistence && this.options.autoSaveInterval === 0) {
      await this.savePersistedState();
    }
  }

  /**
   * Undo the last state change
   */
  async undo(): Promise<boolean> {
    if (!this.options.enableHistory || this.historyIndex < 0) {
      return false;
    }

    const entry = this.history[this.historyIndex];
    this.historyIndex--;

    if (entry.key === '*') {
      this.state = deepClone(entry.previousValue as Record<string, unknown>);
    } else {
      this.setSilently(this.state, entry.key, entry.previousValue);
    }

    this.lastModified = new Date();

    if (this.options.debug) {
      console.log('[GlobalStateManager] Undo:', entry);
    }

    return true;
  }

  /**
   * Redo the last undone change
   */
  async redo(): Promise<boolean> {
    if (!this.options.enableHistory || this.historyIndex >= this.history.length - 1) {
      return false;
    }

    this.historyIndex++;
    const entry = this.history[this.historyIndex];

    if (entry.key === '*') {
      this.state = deepClone(entry.newValue as Record<string, unknown>);
    } else {
      this.setSilently(this.state, entry.key, entry.newValue);
    }

    this.lastModified = new Date();

    if (this.options.debug) {
      console.log('[GlobalStateManager] Redo:', entry);
    }

    return true;
  }

  /**
   * Clear all state (resets to empty object)
   */
  async clear(): Promise<void> {
    const oldState = deepClone(this.state);

    if (this.options.enableHistory) {
      this.addToHistory('*', oldState, {});
    }

    this.state = {};
    this.lastModified = new Date();

    this.emitChange('*', oldState, {});

    // Auto-save if enabled
    if (this.options.enablePersistence && this.options.autoSaveInterval === 0) {
      await this.savePersistedState();
    }
  }

  /**
   * Get statistics about the current state
   */
  getStatistics(): StateStatistics {
    const allKeys = this.keys();
    const namespaces = new Set(allKeys.map(k => k.split('.')[0]));

    return {
      totalKeys: allKeys.length,
      namespaceCount: namespaces.size,
      listenerCount: this.globalListeners.size +
        Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0),
      historySize: this.history.length,
      memoryUsage: calculateSize(this.state),
      lastModified: this.lastModified,
    };
  }

  /**
   * Save state to file
   */
  async save(filePath?: string): Promise<void> {
    const savePath = filePath || this.options.persistencePath;
    const dir = path.dirname(savePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      savePath,
      JSON.stringify(this.state, null, 2),
      'utf-8'
    );

    if (this.options.debug) {
      console.log('[GlobalStateManager] Saved state to:', savePath);
    }
  }

  /**
   * Cleanup and destroy the state manager
   */
  async destroy(): Promise<void> {
    // Clear auto-save timer
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    // Save state if persistence is enabled
    if (this.options.enablePersistence) {
      await this.savePersistedState();
    }

    // Clear all listeners
    this.listeners.clear();
    this.globalListeners.clear();

    // Clear state
    this.state = {};
    this.history = [];
    this.historyIndex = -1;
    this.isInitialized = false;

    if (this.options.debug) {
      console.log('[GlobalStateManager] Destroyed');
    }
  }

  /**
   * Set a value without emitting events or history
   */
  private setSilently(obj: any, key: string, value: any): void {
    const keys = key.split('.');
    let current: any = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current) || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Emit a change event
   */
  private emitChange<T>(
    key: string,
    oldValue: T | undefined,
    newValue: T | undefined,
    metadata?: Record<string, unknown>
  ): void {
    const event: StateChangeEvent<T> = {
      key,
      oldValue,
      newValue: newValue as T,
      timestamp: new Date(),
      metadata,
    };

    // Notify global listeners
    for (const listener of this.globalListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[GlobalStateManager] Error in global listener:', error);
      }
    }

    // Notify key-specific listeners
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      for (const listener of keyListeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`[GlobalStateManager] Error in listener for key "${key}":`, error);
        }
      }
    }
  }

  /**
   * Add an entry to history
   */
  private addToHistory<T>(key: string, oldValue: T | undefined, newValue: T | undefined): void {
    // Remove any redo history
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add new entry
    this.history.push({
      key,
      previousValue: deepClone(oldValue),
      newValue: deepClone(newValue),
      timestamp: new Date(),
    });
    this.historyIndex = this.history.length - 1;

    // Trim history if needed
    if (this.history.length > this.options.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  /**
   * Get all keys from an object with dot notation
   */
  private getAllKeys(obj: any, prefix: string): string[] {
    let keys: string[] = [];

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          keys = keys.concat(this.getAllKeys(value, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
    }

    return keys;
  }

  /**
   * Setup auto-save timer
   */
  private setupAutoSave(): void {
    this.autoSaveTimer = setInterval(async () => {
      if (this.options.enablePersistence) {
        await this.savePersistedState();
      }
    }, this.options.autoSaveInterval);
  }

  /**
   * Save persisted state
   */
  private async savePersistedState(): Promise<void> {
    try {
      await this.save();
    } catch (error) {
      console.error('[GlobalStateManager] Failed to save state:', error);
    }
  }

  /**
   * Load persisted state
   */
  private async loadPersistedState(): Promise<void> {
    try {
      const content = await fs.readFile(this.options.persistencePath, 'utf-8');
      const persistedState = JSON.parse(content);
      this.state = persistedState as Record<string, unknown>;

      if (this.options.debug) {
        console.log('[GlobalStateManager] Loaded state from:', this.options.persistencePath);
      }
    } catch (error) {
      // File doesn't exist or can't be read - start with empty state
      if ((error as any).code !== 'ENOENT') {
        console.warn('[GlobalStateManager] Failed to load persisted state:', error);
      }
    }
  }
}

// Singleton instance
let instance: GlobalStateManager | null = null;

/**
 * Get the singleton state manager instance
 */
export function getGlobalStateManager(options?: StateOptions): GlobalStateManager {
  if (!instance) {
    instance = new GlobalStateManager(options);
  }
  return instance;
}

/**
 * Initialize the global state system
 */
export async function initializeGlobalState(options?: StateOptions): Promise<GlobalStateManager> {
  const manager = getGlobalStateManager(options);
  await manager.initialize();
  return manager;
}
