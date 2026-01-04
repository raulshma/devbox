/**
 * Plugin API System
 *
 * Main entry point for the REST API plugin management system
 */

import { PluginManager } from '../plugins/PluginManager.js';
import { PluginApiServer } from './PluginApiServer.js';
import { ApiServerConfig } from './types.js';

/**
 * Create and start the API server
 */
export async function createApiServer(
  pluginManager: PluginManager,
  config: Partial<ApiServerConfig> = {}
): Promise<PluginApiServer> {
  const apiServer = new PluginApiServer(pluginManager, config);
  await apiServer.start();
  return apiServer;
}

/**
 * Export types and classes
 */
export { PluginApiServer } from './PluginApiServer.js';
export type {
  ApiResponse,
  PluginInfo,
  PluginLoadRequest,
  PluginUnloadRequest,
  PluginReloadRequest,
  ApiServerConfig,
  ApiErrorCode,
  ApiError,
} from './types.js';
