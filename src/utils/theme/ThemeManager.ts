/**
 * Theme Manager
 * Manages color themes and provides colored text utilities using Chalk
 */

import chalk from 'chalk';
import type { ColorPalette, ThemeName, ThemeMode, AppliedTheme, ThemeConfig } from './types.js';
import { getTheme, THEME_REGISTRY } from './themes.js';

/**
 * Detect if the system is in dark mode
 */
function detectSystemDarkMode(): boolean {
  // Check environment variables
  if (process.env.COLORFGBG) {
    // COLORFGBG format: "foreground;background"
    const colors = process.env.COLORFGBG.split(';');
    if (colors.length > 1) {
      const bg = parseInt(colors[1], 10);
      // Background colors 0-7 are typically light, 8-15 are dark
      return bg >= 8;
    }
  }

  // Check for terminal background color environment variables
  if (process.env.TERM_PROGRAM === 'iTerm.app') {
    // iTerm2 specific detection could be added here
  }

  // Default to dark mode for terminals (most common)
  return true;
}

/**
 * Theme Manager class
 */
export class ThemeManager {
  private config: ThemeConfig;
  private appliedTheme: AppliedTheme;

  constructor(config: Partial<ThemeConfig> = {}) {
    this.config = {
      theme: config.theme || 'default',
      mode: config.mode || 'auto',
      colorOutput: config.colorOutput !== false,
      customColors: config.customColors,
    };

    this.appliedTheme = this.resolveTheme();
  }

  /**
   * Get the current theme configuration
   */
  getConfig(): ThemeConfig {
    return { ...this.config };
  }

  /**
   * Set the theme
   */
  setTheme(themeName: ThemeName): void {
    if (!THEME_REGISTRY[themeName]) {
      throw new Error(`Unknown theme: ${themeName}`);
    }
    this.config.theme = themeName;
    this.appliedTheme = this.resolveTheme();
  }

  /**
   * Set the theme mode
   */
  setMode(mode: ThemeMode): void {
    this.config.mode = mode;
    this.appliedTheme = this.resolveTheme();
  }

  /**
   * Enable or disable color output
   */
  setColorOutput(enabled: boolean): void {
    this.config.colorOutput = enabled;
    if (enabled) {
      chalk.level = 1; // Basic color support
    } else {
      chalk.level = 0; // No color
    }
  }

  /**
   * Set custom color overrides
   */
  setCustomColors(colors: Partial<ColorPalette>): void {
    this.config.customColors = colors;
    this.appliedTheme = this.resolveTheme();
  }

  /**
   * Get the currently applied theme
   */
  getAppliedTheme(): AppliedTheme {
    return this.appliedTheme;
  }

  /**
   * Get the current color palette
   */
  getPalette(): ColorPalette {
    return this.appliedTheme.palette;
  }

  /**
   * Check if dark mode is active
   */
  isDark(): boolean {
    return this.appliedTheme.isDark;
  }

  /**
   * Get a chalk color function for a specific palette color
   */
  getColor(colorKey: keyof ColorPalette): any {
    const palette = this.getPalette();
    const colorName = palette[colorKey];

    // Handle background colors
    if (colorName.startsWith('bg')) {
      const bgColor = colorName.replace('bg', '');
      bgColor.toLowerCase();
      return (chalk as any)[bgColor];
    }

    // Handle regular colors
    return (chalk as any)[colorName] || chalk.white;
  }

  /**
   * Apply primary color styling
   */
  primary(text: string | number): string {
    return this.getColor('primary')(String(text));
  }

  /**
   * Apply secondary color styling
   */
  secondary(text: string | number): string {
    return this.getColor('secondary')(String(text));
  }

  /**
   * Apply success color styling
   */
  success(text: string | number): string {
    return this.getColor('success')(String(text));
  }

  /**
   * Apply warning color styling
   */
  warning(text: string | number): string {
    return this.getColor('warning')(String(text));
  }

  /**
   * Apply error color styling
   */
  error(text: string | number): string {
    return this.getColor('error')(String(text));
  }

  /**
   * Apply info color styling
   */
  info(text: string | number): string {
    return this.getColor('info')(String(text));
  }

  /**
   * Apply muted color styling
   */
  muted(text: string | number): string {
    return this.getColor('muted')(String(text));
  }

  /**
   * Apply base text color styling
   */
  text(text: string | number): string {
    return this.getColor('text')(String(text));
  }

  /**
   * Format a title/header
   */
  title(text: string): string {
    return chalk.bold(this.primary(text));
  }

  /**
   * Format a subtitle
   */
  subtitle(text: string): string {
    return chalk.bold(this.secondary(text));
  }

  /**
   * Format a success message with checkmark
   */
  successMessage(text: string): string {
    return `${this.success('✓')} ${text}`;
  }

  /**
   * Format an error message with cross mark
   */
  errorMessage(text: string): string {
    return `${this.error('✗')} ${text}`;
  }

  /**
   * Format a warning message with warning symbol
   */
  warningMessage(text: string): string {
    return `${this.warning('⚠')} ${text}`;
  }

  /**
   * Format an info message with info symbol
   */
  infoMessage(text: string): string {
    return `${this.info('ℹ')} ${text}`;
  }

  /**
   * Format a key-value pair
   */
  keyValue(key: string, value: string | number): string {
    return `${this.muted(key)}: ${this.text(value)}`;
  }

  /**
   * Format a command
   */
  command(cmd: string): string {
    return chalk.bold(this.secondary(cmd));
  }

  /**
   * Format a file path
   */
  path(path: string): string {
    return this.info(path);
  }

  /**
   * Create a bordered box
   */
  box(lines: string[], title?: string): string {
    const palette = this.getPalette();
    const maxLength = Math.max(...lines.map(l => l.length), title?.length || 0);
    const border = '─'.repeat(maxLength + 2);

    let output = '';
    output += this.muted('┌' + border + '┐') + '\n';

    if (title) {
      const titleLine = '│ ' + this.title(title.padEnd(maxLength)) + ' │';
      output += titleLine + '\n';
      output += this.muted('├' + border + '┤') + '\n';
    }

    for (const line of lines) {
      output += '│ ' + line.padEnd(maxLength) + ' │' + '\n';
    }

    output += this.muted('└' + border + '┘');
    return output;
  }

  /**
   * Resolve the theme based on current configuration
   */
  private resolveTheme(): AppliedTheme {
    const theme = getTheme(this.config.theme);

    // Determine if dark mode should be used
    const isDark =
      this.config.mode === 'dark' ||
      (this.config.mode === 'auto' && detectSystemDarkMode());

    // Get the appropriate palette
    const palette = isDark ? theme.dark : theme.light;

    // Apply custom color overrides if present
    const finalPalette: ColorPalette = this.config.customColors
      ? { ...palette, ...this.config.customColors }
      : palette;

    return {
      theme,
      palette: finalPalette,
      isDark,
    };
  }

  /**
   * Export the theme as a chalk level indicator
   */
  getChalk(): any {
    return chalk;
  }
}

// Singleton instance
let instance: ThemeManager | null = null;

/**
 * Get the singleton theme manager instance
 */
export function getThemeManager(config?: Partial<ThemeConfig>): ThemeManager {
  if (!instance) {
    instance = new ThemeManager(config);
  } else if (config) {
    // Update configuration if provided
    if (config.theme) instance.setTheme(config.theme);
    if (config.mode) instance.setMode(config.mode);
    if (config.colorOutput !== undefined) instance.setColorOutput(config.colorOutput);
    if (config.customColors) instance.setCustomColors(config.customColors);
  }
  return instance;
}

/**
 * Initialize the theme system
 */
export function initializeTheme(config?: Partial<ThemeConfig>): ThemeManager {
  return getThemeManager(config);
}
