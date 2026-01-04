/**
 * Theme System Index
 * Main exports for the color theme system
 */

export * from './types.js';
export * from './themes.js';
export * from './ThemeManager.js';

import { getThemeManager } from './ThemeManager.js';

/**
 * Convenience exports for direct use
 */
export const theme = getThemeManager();

/**
 * Quick access to color functions
 */
export const {
  primary,
  secondary,
  success,
  warning,
  error,
  info,
  muted,
  text,
  title,
  subtitle,
  successMessage,
  errorMessage,
  warningMessage,
  infoMessage,
  keyValue,
  command,
  path: pathColor,
  box,
} = theme;
