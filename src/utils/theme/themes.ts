/**
 * Predefined Color Themes
 * A collection of carefully crafted color themes for the CLI
 */

import type { ColorTheme } from './types.js';

/**
 * Default theme - Professional blue tones
 */
export const defaultTheme: ColorTheme = {
  name: 'default',
  displayName: 'Default',
  description: 'Professional blue tones with good contrast',
  light: {
    primary: 'blue',
    secondary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
  dark: {
    primary: 'cyan',
    secondary: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
};

/**
 * Ocean theme - Sea-inspired blues and teals
 */
export const oceanTheme: ColorTheme = {
  name: 'ocean',
  displayName: 'Ocean',
  description: 'Calming sea-inspired blues and teals',
  light: {
    primary: 'blue',
    secondary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
  dark: {
    primary: 'cyan',
    secondary: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
};

/**
 * Forest theme - Nature-inspired greens
 */
export const forestTheme: ColorTheme = {
  name: 'forest',
  displayName: 'Forest',
  description: 'Nature-inspired greens and earth tones',
  light: {
    primary: 'green',
    secondary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
  dark: {
    primary: 'green',
    secondary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
};

/**
 * Sunset theme - Warm oranges and purples
 */
export const sunsetTheme: ColorTheme = {
  name: 'sunset',
  displayName: 'Sunset',
  description: 'Warm sunset-inspired oranges and purples',
  light: {
    primary: 'magenta',
    secondary: 'yellow',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
  dark: {
    primary: 'magenta',
    secondary: 'yellow',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
};

/**
 * Midnight theme - Dark, mysterious purples
 */
export const midnightTheme: ColorTheme = {
  name: 'midnight',
  displayName: 'Midnight',
  description: 'Dark and mysterious purples and blues',
  light: {
    primary: 'magenta',
    secondary: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
  dark: {
    primary: 'magenta',
    secondary: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
};

/**
 * Pastel theme - Soft, muted colors
 */
export const pastelTheme: ColorTheme = {
  name: 'pastel',
  displayName: 'Pastel',
  description: 'Soft and soothing pastel colors',
  light: {
    primary: 'blue',
    secondary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
  dark: {
    primary: 'cyan',
    secondary: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
};

/**
 * Monochrome theme - Classic terminal look
 */
export const monochromeTheme: ColorTheme = {
  name: 'monochrome',
  displayName: 'Monochrome',
  description: 'Classic black and white terminal look',
  light: {
    primary: 'white',
    secondary: 'gray',
    success: 'white',
    warning: 'white',
    error: 'white',
    info: 'white',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
  dark: {
    primary: 'white',
    secondary: 'gray',
    success: 'white',
    warning: 'white',
    error: 'white',
    info: 'white',
    muted: 'gray',
    text: 'white',
    background: 'bgBlack',
  },
};

/**
 * Registry of all available themes
 */
export const THEME_REGISTRY: Record<string, ColorTheme> = {
  default: defaultTheme,
  ocean: oceanTheme,
  forest: forestTheme,
  sunset: sunsetTheme,
  midnight: midnightTheme,
  pastel: pastelTheme,
  monochrome: monochromeTheme,
};

/**
 * Get a theme by name
 */
export function getTheme(name: string): ColorTheme {
  return THEME_REGISTRY[name] || defaultTheme;
}

/**
 * Get all available themes
 */
export function getAllThemes(): ColorTheme[] {
  return Object.values(THEME_REGISTRY);
}
