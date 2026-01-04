/**
 * Utilities Index
 *
 * Central export point for all utility modules
 */

export { Table, printTable, renderTable, createSimpleTable } from './Table.js';
export type {
  ColumnAlignment,
  BorderStyle,
  ColumnConfig,
  RowData,
  TableOptions,
} from './Table.js';

export { logger, createChildLogger, setLogLevel, getLogLevel, LogLevel } from './logger.js';
export { createSpinner } from './spinner.js';
export { discoverFiles, discoverByDirectory, searchInFiles, formatFileSize, CommonPatterns } from './fileDiscovery.js';
export {
  detectNodeModules,
  removeNodeModules,
  formatBytes,
} from './nodeDetector.js';
export type {
  NodeModulesDirectory,
  NodeDetectionResult,
  NodeDetectionOptions,
  CleanupResult,
} from './nodeDetector.js';
export {
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
} from './fileOperations.js';
export type {
  CopyOptions,
  MoveOptions,
  DeleteOptions,
  OperationResult,
  ConflictResolutionOptions,
  ConflictResult,
} from './fileOperations.js';
export {
  executeRename,
  undoRename,
  convertCase,
  generateNewName,
  applyNumbering,
  parseNumberingFormat,
  getHistorySize,
  clearHistory,
} from './rename.js';
export type {
  CaseConversionType,
  RenameOperation,
  RenameResult,
  RenameOptions,
  NumberingFormat,
} from './rename.js';
export {
  ParallelProcessor,
  createParallelProcessor,
  executeParallel,
  processSequentially,
} from './parallelProcessor.js';
export type {
  ParallelTask,
  TaskResult,
  TaskProcessor,
  ParallelProcessorOptions,
} from './parallelProcessor.js';
export {
  runInteractiveBuilder,
  withInteractiveMode,
  getCommandOptions,
  isInteractiveMode,
  removeInteractiveFlag,
  runQuickInteractiveBuilder,
} from './interactiveBuilder.js';
export type {
  OptionMeta,
  OptionSelection,
  InteractiveResult,
} from './interactiveBuilder.js';

// UI Components
export { default as ui } from './ui.js';
export {
  banner,
  box,
  divider,
  badge,
  progressBar,
  status,
  list,
  keyValueList,
  sectionHeader,
  hint,
  commandExample,
  menuItem,
  cliBanner,
  commandHeader,
  resultSummary,
  actionPrompt,
} from './ui.js';
export type { BoxStyle, BadgeType } from './ui.js';
