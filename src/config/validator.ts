/**
 * Configuration validation utilities
 */

import type { AppConfig, ConfigValidationResult } from './types.js';

export class ConfigValidator {
  /**
   * Validate the entire configuration object
   */
  static validate(config: Partial<AppConfig>): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate app settings
    if (config.app) {
      this.validateAppSettings(config.app, errors, warnings);
    }

    // Validate preferences
    if (config.preferences) {
      this.validatePreferences(config.preferences, errors, warnings);
    }

    // Validate feature configs
    if (config.features) {
      this.validateFeatureConfigs(config.features, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateAppSettings(
    app: any,
    errors: string[],
    warnings: string[]
  ): void {
    if (app.debug !== undefined && typeof app.debug !== 'boolean') {
      errors.push('app.debug must be a boolean');
    }

    if (app.logLevel) {
      const validLevels = ['error', 'warn', 'info', 'debug', 'trace'];
      if (!validLevels.includes(app.logLevel)) {
        errors.push('app.logLevel must be one of: ' + validLevels.join(', '));
      }
    }

    if (app.maxParallelOps !== undefined) {
      if (typeof app.maxParallelOps !== 'number') {
        errors.push('app.maxParallelOps must be a number');
      } else if (app.maxParallelOps < 1 || app.maxParallelOps > 100) {
        warnings.push('app.maxParallelOps should be between 1 and 100');
      }
    }

    if (app.defaultDirectory !== undefined && typeof app.defaultDirectory !== 'string') {
      errors.push('app.defaultDirectory must be a string');
    }
  }

  private static validatePreferences(
    preferences: any,
    errors: string[],
    warnings: string[]
  ): void {
    if (preferences.theme) {
      const validThemes = ['light', 'dark', 'auto'];
      if (!validThemes.includes(preferences.theme)) {
        errors.push('preferences.theme must be one of: ' + validThemes.join(', '));
      }
    }

    if (preferences.colorOutput !== undefined && typeof preferences.colorOutput !== 'boolean') {
      errors.push('preferences.colorOutput must be a boolean');
    }

    if (preferences.locale && typeof preferences.locale !== 'string') {
      errors.push('preferences.locale must be a string');
    }

    if (preferences.confirmDestructive !== undefined && typeof preferences.confirmDestructive !== 'boolean') {
      errors.push('preferences.confirmDestructive must be a boolean');
    }

    if (preferences.showTips !== undefined && typeof preferences.showTips !== 'boolean') {
      errors.push('preferences.showTips must be a boolean');
    }

    if (preferences.operationTimeout !== undefined) {
      if (typeof preferences.operationTimeout !== 'number') {
        errors.push('preferences.operationTimeout must be a number');
      } else if (preferences.operationTimeout < 1000) {
        warnings.push('preferences.operationTimeout should be at least 1000ms');
      }
    }

    if (preferences.defaultEditor && typeof preferences.defaultEditor !== 'string') {
      errors.push('preferences.defaultEditor must be a string');
    }
  }

  private static validateFeatureConfigs(
    features: any,
    errors: string[],
    warnings: string[]
  ): void {
    // File operations
    if (features.fileOps) {
      this.validateFileOps(features.fileOps, errors);
    }

    // Encryption
    if (features.encryption) {
      this.validateEncryption(features.encryption, errors);
    }

    // Power rename
    if (features.powerRename) {
      this.validatePowerRename(features.powerRename, errors);
    }

    // Node cleanup
    if (features.nodeCleanup) {
      this.validateNodeCleanup(features.nodeCleanup, errors);
    }

    // DotNet cleanup
    if (features.dotnetCleanup) {
      this.validateDotnetCleanup(features.dotnetCleanup, errors);
    }
  }

  private static validateFileOps(fileOps: any, errors: string[]): void {
    const booleanFields = [
      'preserveTimestamps',
      'followSymlinks',
      'useTrash',
      'overwrite',
    ];

    for (const field of booleanFields) {
      if (fileOps[field] !== undefined && typeof fileOps[field] !== 'boolean') {
        errors.push('features.fileOps.' + field + ' must be a boolean');
      }
    }
  }

  private static validateEncryption(encryption: any, errors: string[]): void {
    if (encryption.algorithm) {
      const validAlgorithms = ['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305'];
      if (!validAlgorithms.includes(encryption.algorithm)) {
        errors.push('features.encryption.algorithm must be one of: ' + validAlgorithms.join(', '));
      }
    }

    if (encryption.validatePassword !== undefined && typeof encryption.validatePassword !== 'boolean') {
      errors.push('features.encryption.validatePassword must be a boolean');
    }

    if (encryption.minPasswordLength !== undefined) {
      if (typeof encryption.minPasswordLength !== 'number') {
        errors.push('features.encryption.minPasswordLength must be a number');
      } else if (encryption.minPasswordLength < 4 || encryption.minPasswordLength > 64) {
        errors.push('features.encryption.minPasswordLength must be between 4 and 64');
      }
    }

    const booleanFields = ['backupOriginal', 'removeOriginal'];
    for (const field of booleanFields) {
      if (encryption[field] !== undefined && typeof encryption[field] !== 'boolean') {
        errors.push('features.encryption.' + field + ' must be a boolean');
      }
    }
  }

  private static validatePowerRename(powerRename: any, errors: string[]): void {
    const booleanFields = [
      'caseSensitive',
      'useRegex',
      'previewChanges',
      'createUndoScript',
    ];

    for (const field of booleanFields) {
      if (powerRename[field] !== undefined && typeof powerRename[field] !== 'boolean') {
        errors.push('features.powerRename.' + field + ' must be a boolean');
      }
    }
  }

  private static validateNodeCleanup(nodeCleanup: any, errors: string[]): void {
    const booleanFields = [
      'removeNodeModules',
      'removePackageLock',
      'removeYarnLock',
      'removeCache',
      'analyzeDiskUsage',
    ];

    for (const field of booleanFields) {
      if (nodeCleanup[field] !== undefined && typeof nodeCleanup[field] !== 'boolean') {
        errors.push('features.nodeCleanup.' + field + ' must be a boolean');
      }
    }
  }

  private static validateDotnetCleanup(dotnetCleanup: any, errors: string[]): void {
    const booleanFields = [
      'removeBin',
      'removeObj',
      'cleanSolution',
      'analyzeDiskUsage',
    ];

    for (const field of booleanFields) {
      if (dotnetCleanup[field] !== undefined && typeof dotnetCleanup[field] !== 'boolean') {
        errors.push('features.dotnetCleanup.' + field + ' must be a boolean');
      }
    }
  }
}
