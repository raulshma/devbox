/**
 * Color Theme System Types
 * Provides configurable color themes with dark/light mode support using Chalk
 */

/**
 * Available theme modes
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Predefined theme names
 */
export type ThemeName = 'default' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'pastel' | 'monochrome';

/**
 * Color palette definition
 */
export interface ColorPalette {
  /** Primary accent color - for main actions and highlights */
  primary: string;
  /** Secondary accent color - for complementary elements */
  secondary: string;
  /** Success color - for success messages and confirmations */
  success: string;
  /** Warning color - for warnings and cautions */
  warning: string;
  /** Error color - for errors and failures */
  error: string;
  /** Info color - for informational messages */
  info: string;
  /** Muted color - for subtle text and borders */
  muted: string;
  /** Base text color */
  text: string;
  /** Background color (for terminal output formatting) */
  background: string;
}

/**
 * Complete theme definition with light and dark variants
 */
export interface ColorTheme {
  /** Theme name/identifier */
  name: ThemeName;
  /** Display name */
  displayName: string;
  /** Description of the theme */
  description: string;
  /** Light mode color palette */
  light: ColorPalette;
  /** Dark mode color palette */
  dark: ColorPalette;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  /** Current theme name */
  theme: ThemeName;
  /** Theme mode (light, dark, or auto-detect) */
  mode: ThemeMode;
  /** Whether colors are enabled */
  colorOutput: boolean;
  /** Custom theme colors (overrides the selected theme) */
  customColors?: Partial<ColorPalette>;
}

/**
 * Applied theme (resolved colors based on mode)
 */
export interface AppliedTheme {
  /** The theme being used */
  theme: ColorTheme;
  /** The active palette (light or dark) */
  palette: ColorPalette;
  /** Whether dark mode is active */
  isDark: boolean;
}
