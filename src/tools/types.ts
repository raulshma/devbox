/**
 * Tool Registry System Types
 *
 * Defines the core types and interfaces for the tool registry system
 * that allows registering and discovering available tools
 */

import { Command } from 'commander';

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  /** Whether the execution was successful */
  success: boolean;

  /** Result data */
  data?: unknown;

  /** Error message if execution failed */
  error?: string;

  /** Exit code */
  exitCode: number;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /** Arguments passed to the tool */
  args: string[];

  /** Options/flags passed to the tool */
  options: Record<string, unknown>;

  /** Working directory */
  cwd: string;

  /** Environment variables */
  env: Record<string, string>;
}

/**
 * Tool category
 */
export type ToolCategory =
  | 'file'
  | 'code'
  | 'git'
  | 'build'
  | 'test'
  | 'deploy'
  | 'utility'
  | 'api'
  | 'database'
  | 'other';

/**
 * Tool metadata
 */
export interface ToolMetadata {
  /** Unique tool identifier */
  id: string;

  /** Tool display name */
  name: string;

  /** Tool category */
  category: ToolCategory;

  /** Tool version */
  version?: string;

  /** Tool description */
  description: string;

  /** Tool author/owner */
  author?: string;

  /** Tags for searchability */
  tags: string[];

  /** Tool documentation URL */
  docsUrl?: string;

  /** Repository URL */
  repoUrl?: string;

  /** Whether the tool is currently enabled */
  enabled: boolean;

  /** Minimum required CLI version */
  minVersion?: string;

  /** Tool dependencies (other tools) */
  dependencies?: string[];
}

/**
 * Tool definition interface
 */
export interface ITool {
  /** Tool metadata */
  metadata: ToolMetadata;

  /**
   * Execute the tool
   * @param context Execution context
   * @returns Execution result
   */
  execute(context: ToolExecutionContext): Promise<ToolExecutionResult> | ToolExecutionResult;

  /**
   * Validate input before execution
   * @param context Execution context
   * @returns Validation result with optional error message
   */
  validate?(context: ToolExecutionContext): { valid: boolean; error?: string };

  /**
   * Get help text for the tool
   */
  getHelp?(): string;

  /**
   * Initialize the tool (called when registered)
   */
  initialize?(): void | Promise<void>;

  /**
   * Cleanup the tool (called when unregistered)
   */
  cleanup?(): void | Promise<void>;
}

/**
 * Tool command wrapper
 */
export interface ToolCommand {
  /** Tool instance */
  tool: ITool;

  /** Associated CLI command */
  command: Command;
}

/**
 * Registry statistics
 */
export interface RegistryStatistics {
  /** Total number of registered tools */
  totalTools: number;

  /** Number of enabled tools */
  enabledTools: number;

  /** Number of disabled tools */
  disabledTools: number;

  /** Tools by category */
  toolsByCategory: Record<ToolCategory, number>;

  /** Most recently registered tool */
  lastRegistered?: string;

  /** Most recently unregistered tool */
  lastUnregistered?: string;
}

/**
 * Search filter options
 */
export interface ToolSearchFilter {
  /** Filter by category */
  category?: ToolCategory;

  /** Filter by tags */
  tags?: string[];

  /** Filter by enabled status */
  enabled?: boolean;

  /** Search in name/description */
  search?: string;

  /** Filter by author */
  author?: string;
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  /** Whether to allow duplicate tool IDs (override existing) */
  allowOverrides: boolean;

  /** Whether to validate tools on registration */
  validateOnRegister: boolean;

  /** Maximum number of tools allowed (0 = unlimited) */
  maxTools: number;

  /** Whether to persist registry state */
  persistState: boolean;

  /** State file path */
  statePath?: string;
}
