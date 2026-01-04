/**
 * API Plugin Manager Types
 *
 * Types and interfaces for the REST API plugin management system
 */

import { IPlugin, PluginMetadata } from '../plugins/types.js';

/**
 * API Response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Plugin information returned by the API
 */
export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  loaded: boolean;
  dependencies?: string[];
  commands?: string[];
}

/**
 * Plugin load request
 */
export interface PluginLoadRequest {
  path: string;
  force?: boolean;
}

/**
 * Plugin unload request
 */
export interface PluginUnloadRequest {
  pluginId: string;
}

/**
 * Plugin reload request
 */
export interface PluginReloadRequest {
  pluginId?: string; // If not provided, reload all
}

/**
 * API Server configuration
 */
export interface ApiServerConfig {
  /** Port to run the API server on */
  port: number;

  /** Host to bind the API server to */
  host: string;

  /** Enable CORS */
  enableCors: boolean;

  /** API key for authentication (optional) */
  apiKey?: string;

  /** Enable API rate limiting */
  enableRateLimit: boolean;

  /** Max requests per minute (when rate limiting is enabled) */
  rateLimitMax: number;
}

/**
 * API Error types
 */
export enum ApiErrorCode {
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
  PLUGIN_ALREADY_LOADED = 'PLUGIN_ALREADY_LOADED',
  PLUGIN_LOAD_FAILED = 'PLUGIN_LOAD_FAILED',
  PLUGIN_UNLOAD_FAILED = 'PLUGIN_UNLOAD_FAILED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SERVER_ERROR = 'SERVER_ERROR',
}

/**
 * API Error details
 */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
