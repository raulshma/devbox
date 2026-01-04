/**
 * Developer Toolbox CLI - Library Entry Point
 *
 * This file exports the main components for programmatic usage.
 * For CLI usage, the cli.ts file is the entry point.
 */

// Re-export main modules for programmatic usage
export * from './config/index.js';
export * from './errors/index.js';
export * from './plugins/index.js';
export * from './tools/index.js';

// Utils - exclude getLogLevel to avoid conflict with config/helpers
export {
  Table,
  printTable,
  renderTable,
  createSimpleTable,
  logger,
  createChildLogger,
  setLogLevel,
  LogLevel,
  createSpinner,
  discoverFiles,
  discoverByDirectory,
  searchInFiles,
  formatFileSize,
  CommonPatterns,
  detectNodeModules,
  removeNodeModules,
  formatBytes,
  copy,
  move,
  deletePath,
  deleteMultiple,
  copyMultiple,
  moveMultiple,
  ConflictResolver,
  ConflictStrategy,
  createConflictResolver,
  parseConflictStrategy,
  getAvailableStrategies,
  executeRename,
  undoRename,
  convertCase,
  generateNewName,
  applyNumbering,
  parseNumberingFormat,
  getHistorySize,
  clearHistory,
  ParallelProcessor,
  createParallelProcessor,
  executeParallel,
  processSequentially,
} from './utils/index.js';

// Re-export types from utils
export type {
  ColumnAlignment,
  BorderStyle,
  ColumnConfig,
  RowData,
  TableOptions,
  NodeModulesDirectory,
  NodeDetectionResult,
  NodeDetectionOptions,
  CleanupResult,
  CopyOptions,
  MoveOptions,
  DeleteOptions,
  OperationResult,
  ConflictResolutionOptions,
  ConflictResult,
  CaseConversionType,
  RenameOperation,
  RenameResult,
  RenameOptions,
  NumberingFormat,
  ParallelTask,
  TaskResult,
  TaskProcessor,
  ParallelProcessorOptions,
} from './utils/index.js';

export * from './validation/index.js';
export * from './state/index.js';
export * from './audit/index.js';
export * from './auth/index.js';
export * from './storage/index.js';
