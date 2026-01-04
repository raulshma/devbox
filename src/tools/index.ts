/**
 * Tool Registry System
 *
 * Main entry point for the tool registry system
 */

import { ToolRegistry } from './ToolRegistry.js';
import type {
  ITool,
  ToolMetadata,
  ToolExecutionResult,
  ToolExecutionContext,
  ToolSearchFilter,
  RegistryStatistics,
  RegistryConfig,
  ToolCategory,
} from './types.js';

// Export all types
export * from './types.js';

// Export the main class
export { ToolRegistry };

/**
 * Create a default tool registry instance
 */
export function createToolRegistry(
  config?: Partial<RegistryConfig>,
  logger?: Console
): ToolRegistry {
  return new ToolRegistry(config, logger);
}

/**
 * Global registry instance
 */
let globalRegistry: ToolRegistry | null = null;

/**
 * Get or create the global tool registry
 */
export function getGlobalRegistry(config?: Partial<RegistryConfig>): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = createToolRegistry(config);
  }
  return globalRegistry;
}

/**
 * Reset the global registry (useful for testing)
 */
export function resetGlobalRegistry(): void {
  if (globalRegistry) {
    globalRegistry.clearRegistry();
    globalRegistry = null;
  }
}
