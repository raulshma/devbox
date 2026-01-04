/**
 * Tool Registry
 *
 * Central registry for managing tool registration, discovery, and execution
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import {
  ITool,
  ToolMetadata,
  ToolExecutionResult,
  ToolExecutionContext,
  ToolSearchFilter,
  RegistryStatistics,
  RegistryConfig,
  ToolCategory,
} from './types.js';

/**
 * Manages tool registration and discovery
 */
export class ToolRegistry {
  private tools: Map<string, ITool> = new Map();
  private config: RegistryConfig;
  private logger: Console;
  private lastRegistered: string | null = null;
  private lastUnregistered: string | null = null;

  constructor(config: Partial<RegistryConfig> = {}, logger: Console = console) {
    this.config = {
      allowOverrides: config.allowOverrides ?? false,
      validateOnRegister: config.validateOnRegister ?? true,
      maxTools: config.maxTools ?? 0,
      persistState: config.persistState ?? false,
      statePath: config.statePath,
    };
    this.logger = logger;
  }

  /**
   * Register a new tool
   */
  async registerTool(tool: ITool): Promise<{ success: boolean; error?: string }> {
    try {
      // Check max tools limit
      if (this.config.maxTools > 0 && this.tools.size >= this.config.maxTools) {
        return {
          success: false,
          error: `Maximum number of tools (${this.config.maxTools}) reached`,
        };
      }

      // Validate tool metadata
      const validation = this.validateToolMetadata(tool.metadata);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid tool metadata: ${validation.errors.join(', ')}`,
        };
      }

      // Check if tool already exists
      if (this.tools.has(tool.metadata.id)) {
        if (!this.config.allowOverrides) {
          return {
            success: false,
            error: `Tool with ID '${tool.metadata.id}' already exists`,
          };
        }
        // Unregister existing tool first
        await this.unregisterTool(tool.metadata.id, false);
      }

      // Validate dependencies if required
      if (this.config.validateOnRegister && tool.metadata.dependencies) {
        for (const dep of tool.metadata.dependencies) {
          if (!this.tools.has(dep)) {
            return {
              success: false,
              error: `Missing dependency: ${dep}`,
            };
          }
        }
      }

      // Initialize tool if it has an initialize method
      if (tool.initialize) {
        await tool.initialize();
      }

      // Register the tool
      this.tools.set(tool.metadata.id, tool);
      this.lastRegistered = tool.metadata.id;

      this.logger.log(
        chalk.green(`✓ Registered tool: ${tool.metadata.name} (${tool.metadata.id})`)
      );

      // Persist state if configured
      if (this.config.persistState && this.config.statePath) {
        await this.persistState();
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to register tool: ${errorMessage}`,
      };
    }
  }

  /**
   * Unregister a tool
   */
  async unregisterTool(
    toolId: string,
    cleanup = true
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const tool = this.tools.get(toolId);

      if (!tool) {
        return {
          success: false,
          error: `Tool not found: ${toolId}`,
        };
      }

      // Check if other tools depend on this one
      const dependents = this.findDependents(toolId);
      if (dependents.length > 0) {
        return {
          success: false,
          error: `Cannot unregister: tool is required by ${dependents.join(', ')}`,
        };
      }

      // Cleanup tool if requested
      if (cleanup && tool.cleanup) {
        await tool.cleanup();
      }

      // Remove from registry
      this.tools.delete(toolId);
      this.lastUnregistered = toolId;

      this.logger.log(
        chalk.yellow(`Unregistered tool: ${tool.metadata.name} (${toolId})`)
      );

      // Persist state if configured
      if (this.config.persistState && this.config.statePath) {
        await this.persistState();
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to unregister tool: ${errorMessage}`,
      };
    }
  }

  /**
   * Get a tool by ID
   */
  getTool(toolId: string): ITool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Check if a tool is registered
   */
  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get enabled tools only
   */
  getEnabledTools(): ITool[] {
    return this.getAllTools().filter(tool => tool.metadata.enabled);
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): ITool[] {
    return this.getAllTools().filter(tool => tool.metadata.category === category);
  }

  /**
   * Search for tools based on filters
   */
  searchTools(filter: ToolSearchFilter): ITool[] {
    let results = this.getAllTools();

    // Filter by category
    if (filter.category) {
      results = results.filter(tool => tool.metadata.category === filter.category);
    }

    // Filter by enabled status
    if (filter.enabled !== undefined) {
      results = results.filter(tool => tool.metadata.enabled === filter.enabled);
    }

    // Filter by author
    if (filter.author) {
      results = results.filter(tool =>
        tool.metadata.author?.toLowerCase().includes(filter.author!.toLowerCase())
      );
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(tool =>
        filter.tags!.some(tag => tool.metadata.tags.includes(tag))
      );
    }

    // Search in name and description
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      results = results.filter(tool =>
        tool.metadata.name.toLowerCase().includes(searchLower) ||
        tool.metadata.description.toLowerCase().includes(searchLower) ||
        tool.metadata.id.toLowerCase().includes(searchLower)
      );
    }

    return results;
  }

  /**
   * Execute a tool by ID
   */
  async executeTool(
    toolId: string,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolId);

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolId}`,
        exitCode: 1,
      };
    }

    if (!tool.metadata.enabled) {
      return {
        success: false,
        error: `Tool is disabled: ${toolId}`,
        exitCode: 1,
      };
    }

    try {
      // Validate input if tool provides validation
      if (tool.validate) {
        const validation = tool.validate(context);
        if (!validation.valid) {
          return {
            success: false,
            error: validation.error || 'Validation failed',
            exitCode: 1,
          };
        }
      }

      // Execute the tool
      const result = await tool.execute(context);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Tool execution failed: ${errorMessage}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Get registry statistics
   */
  getStatistics(): RegistryStatistics {
    const tools = this.getAllTools();
    const enabledTools = tools.filter(t => t.metadata.enabled);

    const toolsByCategory: Record<ToolCategory, number> = {
      file: 0,
      code: 0,
      git: 0,
      build: 0,
      test: 0,
      deploy: 0,
      utility: 0,
      api: 0,
      database: 0,
      other: 0,
    };

    for (const tool of tools) {
      toolsByCategory[tool.metadata.category]++;
    }

    return {
      totalTools: tools.length,
      enabledTools: enabledTools.length,
      disabledTools: tools.length - enabledTools.length,
      toolsByCategory,
      lastRegistered: this.lastRegistered ?? undefined,
      lastUnregistered: this.lastUnregistered ?? undefined,
    };
  }

  /**
   * Enable a tool
   */
  async enableTool(toolId: string): Promise<{ success: boolean; error?: string }> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolId}`,
      };
    }

    tool.metadata.enabled = true;
    this.logger.log(chalk.green(`✓ Enabled tool: ${tool.metadata.name}`));

    if (this.config.persistState && this.config.statePath) {
      await this.persistState();
    }

    return { success: true };
  }

  /**
   * Disable a tool
   */
  async disableTool(toolId: string): Promise<{ success: boolean; error?: string }> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolId}`,
      };
    }

    // Check if other tools depend on this one
    const dependents = this.findDependents(toolId);
    if (dependents.length > 0) {
      return {
        success: false,
        error: `Cannot disable: tool is required by ${dependents.join(', ')}`,
      };
    }

    tool.metadata.enabled = false;
    this.logger.log(chalk.yellow(`Disabled tool: ${tool.metadata.name}`));

    if (this.config.persistState && this.config.statePath) {
      await this.persistState();
    }

    return { success: true };
  }

  /**
   * Clear all tools from the registry
   */
  async clearRegistry(): Promise<void> {
    // Cleanup all tools
    for (const [toolId, tool] of this.tools.entries()) {
      if (tool.cleanup) {
        try {
          await tool.cleanup();
        } catch (error) {
          this.logger.error(
            chalk.red(`Error cleaning up tool ${toolId}: ${error}`)
          );
        }
      }
    }

    this.tools.clear();
    this.lastRegistered = null;
    this.lastUnregistered = null;

    if (this.config.persistState && this.config.statePath) {
      await this.persistState();
    }
  }

  /**
   * Persist registry state to disk
   */
  private async persistState(): Promise<void> {
    if (!this.config.statePath) {
      return;
    }

    try {
      const state = {
        tools: Array.from(this.tools.entries()).map(([id, tool]) => ({
          id,
          metadata: tool.metadata,
        })),
        lastRegistered: this.lastRegistered,
        lastUnregistered: this.lastUnregistered,
      };

      const dir = path.dirname(this.config.statePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.config.statePath, JSON.stringify(state, null, 2));
    } catch (error) {
      this.logger.error(
        chalk.red(`Failed to persist registry state: ${error}`)
      );
    }
  }

  /**
   * Validate tool metadata
   */
  private validateToolMetadata(metadata: ToolMetadata): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!metadata.id) {
      errors.push('Missing required field: id');
    }

    if (!metadata.name) {
      errors.push('Missing required field: name');
    }

    if (!metadata.category) {
      errors.push('Missing required field: category');
    }

    if (!metadata.description) {
      errors.push('Missing required field: description');
    }

    if (!Array.isArray(metadata.tags)) {
      errors.push('Tags must be an array');
    }

    // Validate ID format
    if (metadata.id && !/^[a-zA-Z0-9_-]+$/.test(metadata.id)) {
      errors.push('Tool ID must contain only alphanumeric characters, hyphens, and underscores');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Find tools that depend on a given tool
   */
  private findDependents(toolId: string): string[] {
    const dependents: string[] = [];

    for (const [id, tool] of this.tools.entries()) {
      if (tool.metadata.dependencies?.includes(toolId)) {
        dependents.push(id);
      }
    }

    return dependents;
  }
}
