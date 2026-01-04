/**
 * Theme Command
 * CLI command for managing color themes
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getThemeManager, getAllThemes, type ThemeName, type ThemeMode } from '../utils/theme/index.js';

/**
 * Theme management command
 */
export const themeCommand = new Command('theme')
  .description('Manage color themes')
  .alias('th');

// List all available themes
themeCommand
  .command('list')
  .description('List all available themes')
  .action(() => {
    const themeManager = getThemeManager();
    const currentTheme = themeManager.getConfig().theme;
    const currentMode = themeManager.getConfig().mode;
    const isDark = themeManager.isDark();

    console.log(chalk.bold('\n🎨 Available Color Themes\n'));

    const themes = getAllThemes();
    for (const theme of themes) {
      const isCurrent = theme.name === currentTheme;
      const indicator = isCurrent ? '●' : '○';
      const color = isCurrent ? chalk.green : chalk.gray;

      console.log(
        color(`  ${indicator} ${theme.displayName}`) +
        chalk.gray(` (${theme.name})`)
      );
      console.log(chalk.gray(`      ${theme.description}`));

      if (isCurrent) {
        console.log(chalk.gray(`      Mode: ${currentMode} (${isDark ? 'dark' : 'light'} active)`));
      }
      console.log();
    }
  });

// Set the current theme
themeCommand
  .command('set <themeName>')
  .description('Set the current theme')
  .action((themeName: string) => {
    try {
      const themeManager = getThemeManager();
      themeManager.setTheme(themeName as ThemeName);

      console.log(chalk.green(`\n✓ Theme changed to: ${themeName}\n`));

      // Preview the theme
      previewTheme();
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${(error as Error).message}\n`));
      console.log(chalk.gray('Run "dtb theme list" to see available themes.\n'));
    }
  });

// Set theme mode (light/dark/auto)
themeCommand
  .command('mode <mode>')
  .description('Set theme mode (light, dark, or auto)')
  .action((mode: string) => {
    try {
      const themeManager = getThemeManager();
      themeManager.setMode(mode as ThemeMode);

      const isDark = themeManager.isDark();
      console.log(chalk.green(`\n✓ Mode changed to: ${mode} (${isDark ? 'dark' : 'light'} active)\n`));

      // Preview the theme
      previewTheme();
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${(error as Error).message}\n`));
    }
  });

// Enable or disable color output
themeCommand
  .command('color <enabled>')
  .description('Enable or disable color output (true/false)')
  .action((enabled: string) => {
    const themeManager = getThemeManager();
    const isEnabled = enabled.toLowerCase() === 'true' || enabled === '1';

    themeManager.setColorOutput(isEnabled);
    console.log(chalk[isEnabled ? 'green' : 'red'](`\n${isEnabled ? '✓' : '✗'} Color output ${isEnabled ? 'enabled' : 'disabled'}\n`));
  });

// Preview the current theme
themeCommand
  .command('preview')
  .description('Preview the current theme')
  .action(() => {
    console.log('\n');
    previewTheme();
  });

// Show current theme info
themeCommand
  .command('info')
  .description('Show current theme information')
  .action(() => {
    const themeManager = getThemeManager();
    const config = themeManager.getConfig();
    const applied = themeManager.getAppliedTheme();
    const palette = themeManager.getPalette();

    console.log(chalk.bold('\n🎨 Current Theme Information\n'));
    console.log(chalk.white(`  Theme:    ${applied.theme.displayName} (${config.theme})`));
    console.log(chalk.white(`  Mode:     ${config.mode}`));
    console.log(chalk.white(`  Active:   ${applied.isDark ? 'dark' : 'light'} mode`));
    console.log(chalk.white(`  Colors:   ${config.colorOutput ? 'enabled' : 'disabled'}`));
    console.log();

    console.log(chalk.bold('  Color Palette:'));
    console.log(chalk.white(`    Primary:   ${palette.primary}`));
    console.log(chalk.white(`    Secondary: ${palette.secondary}`));
    console.log(chalk.white(`    Success:   ${palette.success}`));
    console.log(chalk.white(`    Warning:   ${palette.warning}`));
    console.log(chalk.white(`    Error:     ${palette.error}`));
    console.log(chalk.white(`    Info:      ${palette.info}`));
    console.log(chalk.white(`    Muted:     ${palette.muted}`));
    console.log();
  });

/**
 * Preview the current theme with sample text
 */
function previewTheme(): void {
  const themeManager = getThemeManager();

  console.log(themeManager.title('Theme Preview'));
  console.log();

  console.log(themeManager.subtitle('Text Styles'));
  console.log(themeManager.primary('Primary text'));
  console.log(themeManager.secondary('Secondary text'));
  console.log(themeManager.success('Success text'));
  console.log(themeManager.warning('Warning text'));
  console.log(themeManager.error('Error text'));
  console.log(themeManager.info('Info text'));
  console.log(themeManager.muted('Muted text'));
  console.log();

  console.log(themeManager.subtitle('Messages'));
  console.log(themeManager.successMessage('Operation completed successfully'));
  console.log(themeManager.errorMessage('An error occurred'));
  console.log(themeManager.warningMessage('Warning: proceed with caution'));
  console.log(themeManager.infoMessage('Additional information'));
  console.log();

  console.log(themeManager.subtitle('Other Elements'));
  console.log(themeManager.keyValue('Configuration', '/path/to/config.json'));
  console.log(themeManager.command('dtb theme set ocean'));
  console.log(themeManager.path('/home/user/project'));
  console.log();

  const boxLines = [
    themeManager.primary('Theme Preview Box'),
    themeManager.secondary('Multiple styles supported'),
    themeManager.success('Easy to use API'),
  ];
  console.log(themeManager.box(boxLines, 'Preview'));
  console.log();
}
