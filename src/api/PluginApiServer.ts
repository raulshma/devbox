/**
 * Plugin API Server
 *
 * REST API server for managing plugins dynamically at runtime
 */

import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { PluginManager } from '../plugins/PluginManager.js';
import {
  ApiResponse,
  PluginInfo,
  PluginLoadRequest,
  ApiServerConfig,
  ApiErrorCode,
  ApiError,
} from './types.js';

/**
 * REST API server for plugin management
 */
export class PluginApiServer {
  private app: express.Application;
  private server: Server | null = null;
  private config: ApiServerConfig;
  private pluginManager: PluginManager;
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(pluginManager: PluginManager, config: Partial<ApiServerConfig> = {}) {
    this.pluginManager = pluginManager;
    this.config = {
      port: config.port ?? 3000,
      host: config.host ?? 'localhost',
      enableCors: config.enableCors ?? true,
      apiKey: config.apiKey,
      enableRateLimit: config.enableRateLimit ?? true,
      rateLimitMax: config.rateLimitMax ?? 60,
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Body parser
    this.app.use(express.json());

    // CORS
    if (this.config.enableCors) {
      this.app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });
    }

    // Authentication middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      if (this.config.apiKey) {
        const apiKey = req.headers['x-api-key'] as string || req.headers.authorization?.replace('Bearer ', '');
        if (apiKey !== this.config.apiKey) {
          return this.sendError(res, {
            code: ApiErrorCode.UNAUTHORIZED,
            message: 'Invalid or missing API key',
          }, 401);
        }
      }
      next();
    });

    // Rate limiting middleware
    if (this.config.enableRateLimit) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        const clientIp = req.ip || 'unknown';
        const now = Date.now();
        const minute = 60 * 1000;

        let rateLimitData = this.rateLimitMap.get(clientIp);

        if (!rateLimitData || now > rateLimitData.resetTime) {
          rateLimitData = { count: 1, resetTime: now + minute };
          this.rateLimitMap.set(clientIp, rateLimitData);
        } else {
          rateLimitData.count++;
        }

        if (rateLimitData.count > this.config.rateLimitMax) {
          return this.sendError(res, {
            code: ApiErrorCode.UNAUTHORIZED,
            message: 'Rate limit exceeded',
          }, 429);
        }

        next();
      });
    }

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    const router = express.Router();

    // Health check
    router.get('/health', (req, res) => {
      this.sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() });
    });

    // List all plugins
    router.get('/plugins', (req, res) => {
      try {
        const plugins = this.pluginManager.getLoadedPlugins();
        const pluginInfos: PluginInfo[] = plugins.map(plugin => ({
          id: plugin.metadata.id,
          name: plugin.metadata.name,
          version: plugin.metadata.version,
          description: plugin.metadata.description,
          author: plugin.metadata.author,
          loaded: true,
          dependencies: plugin.metadata.dependencies,
          commands: plugin.getCommands?.().map(c => c.command.name()) || [],
        }));

        this.sendSuccess(res, {
          plugins: pluginInfos,
          total: pluginInfos.length,
        });
      } catch (error) {
        this.sendError(res, {
          code: ApiErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get plugin by ID
    router.get('/plugins/:pluginId', (req, res) => {
      try {
        const { pluginId } = req.params;
        const plugin = this.pluginManager.getPlugin(pluginId);

        if (!plugin) {
          return this.sendError(res, {
            code: ApiErrorCode.PLUGIN_NOT_FOUND,
            message: `Plugin not found: ${pluginId}`,
          }, 404);
        }

        const pluginInfo: PluginInfo = {
          id: plugin.metadata.id,
          name: plugin.metadata.name,
          version: plugin.metadata.version,
          description: plugin.metadata.description,
          author: plugin.metadata.author,
          loaded: true,
          dependencies: plugin.metadata.dependencies,
          commands: plugin.getCommands?.().map(c => c.command.name()) || [],
        };

        this.sendSuccess(res, pluginInfo);
      } catch (error) {
        this.sendError(res, {
          code: ApiErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Load a plugin
    router.post('/plugins/load', async (req, res) => {
      try {
        const { path, force }: PluginLoadRequest = req.body;

        if (!path) {
          return this.sendError(res, {
            code: ApiErrorCode.INVALID_REQUEST,
            message: 'Plugin path is required',
          }, 400);
        }

        // Check if already loaded
        const plugins = this.pluginManager.getLoadedPlugins();
        const alreadyLoaded = plugins.some(p => path.includes(p.metadata.id));

        if (alreadyLoaded && !force) {
          return this.sendError(res, {
            code: ApiErrorCode.PLUGIN_ALREADY_LOADED,
            message: 'Plugin is already loaded. Use force=true to reload.',
          }, 409);
        }

        const result = await this.pluginManager.loadPlugin(path);

        if (result.success) {
          this.sendSuccess(res, {
            message: 'Plugin loaded successfully',
            pluginId: result.pluginId,
          }, 201);
        } else {
          this.sendError(res, {
            code: ApiErrorCode.PLUGIN_LOAD_FAILED,
            message: result.error || 'Failed to load plugin',
            details: { pluginId: result.pluginId },
          }, 400);
        }
      } catch (error) {
        this.sendError(res, {
          code: ApiErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Unload a plugin
    router.delete('/plugins/:pluginId', async (req, res) => {
      try {
        const { pluginId } = req.params;

        if (!this.pluginManager.hasPlugin(pluginId)) {
          return this.sendError(res, {
            code: ApiErrorCode.PLUGIN_NOT_FOUND,
            message: `Plugin not found: ${pluginId}`,
          }, 404);
        }

        const success = await this.pluginManager.unloadPlugin(pluginId);

        if (success) {
          this.sendSuccess(res, {
            message: 'Plugin unloaded successfully',
            pluginId,
          });
        } else {
          this.sendError(res, {
            code: ApiErrorCode.PLUGIN_UNLOAD_FAILED,
            message: 'Failed to unload plugin',
          });
        }
      } catch (error) {
        this.sendError(res, {
          code: ApiErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Reload plugins
    router.post('/plugins/reload', async (req, res) => {
      try {
        const { pluginId }: { pluginId?: string } = req.body;

        if (pluginId) {
          // Reload specific plugin
          if (!this.pluginManager.hasPlugin(pluginId)) {
            return this.sendError(res, {
              code: ApiErrorCode.PLUGIN_NOT_FOUND,
              message: `Plugin not found: ${pluginId}`,
            }, 404);
          }

          // Unload and reload
          await this.pluginManager.unloadPlugin(pluginId);
          // Note: We'd need the original path to reload, this is a limitation
          return this.sendError(res, {
            code: ApiErrorCode.INVALID_REQUEST,
            message: 'Reloading specific plugins requires the original path. Use reload all instead.',
          }, 400);
        } else {
          // Reload all plugins
          const results = await this.pluginManager.reloadAllPlugins();
          const successCount = results.filter(r => r.success).length;

          this.sendSuccess(res, {
            message: `Reloaded ${successCount} plugin(s)`,
            results: {
              total: results.length,
              successful: successCount,
              failed: results.length - successCount,
            },
          });
        }
      } catch (error) {
        this.sendError(res, {
          code: ApiErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get plugin manager stats
    router.get('/stats', (req, res) => {
      try {
        const plugins = this.pluginManager.getLoadedPlugins();
        const stats = {
          totalPlugins: plugins.length,
          loadedPlugins: plugins.length,
          timestamp: new Date().toISOString(),
          rateLimitEnabled: this.config.enableRateLimit,
          rateLimitMax: this.config.rateLimitMax,
        };

        this.sendSuccess(res, stats);
      } catch (error) {
        this.sendError(res, {
          code: ApiErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    this.app.use('/api', router);

    // 404 handler
    this.app.use((req, res) => {
      this.sendError(res, {
        code: ApiErrorCode.INVALID_REQUEST,
        message: 'Endpoint not found',
      }, 404);
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('API Error:', err);
      this.sendError(res, {
        code: ApiErrorCode.SERVER_ERROR,
        message: err.message || 'Internal server error',
      }, 500);
    });
  }

  /**
   * Send success response
   */
  private sendSuccess<T>(res: Response, data: T, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  private sendError(res: Response, error: ApiError, statusCode: number = 500): void {
    const response: ApiResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(response);
  }

  /**
   * Start the API server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          console.log(`\n🚀 Plugin API Server running at http://${this.config.host}:${this.config.port}`);
          console.log(`📚 API Documentation: http://${this.config.host}:${this.config.port}/api/health`);
          console.log(`🔌 Plugins endpoint: http://${this.config.host}:${this.config.port}/api/plugins\n`);
          resolve();
        });

        this.server.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the API server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((error) => {
          if (error) {
            reject(error);
          } else {
            console.log('\n🛑 Plugin API Server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get server URL
   */
  getServerUrl(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }
}
