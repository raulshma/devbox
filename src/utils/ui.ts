/**
 * UI Components for CLI
 *
 * Provides reusable UI components for a polished CLI experience:
 * - Banners and headers
 * - Progress bars
 * - Boxes and panels
 * - Dividers and separators
 * - Badges and status indicators
 * - Formatted lists
 */

import chalk from 'chalk';
import { getThemeManager } from './theme/index.js';

const theme = getThemeManager();

/**
 * Box style options
 */
export type BoxStyle = 'single' | 'double' | 'rounded' | 'heavy' | 'minimal';

/**
 * Box border characters for different styles
 */
const BOX_CHARS: Record<BoxStyle, {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
  titleLeft: string;
  titleRight: string;
}> = {
  single: {
    topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘',
    horizontal: '─', vertical: '│', titleLeft: '┤', titleRight: '├'
  },
  double: {
    topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝',
    horizontal: '═', vertical: '║', titleLeft: '╡', titleRight: '╞'
  },
  rounded: {
    topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯',
    horizontal: '─', vertical: '│', titleLeft: '┤', titleRight: '├'
  },
  heavy: {
    topLeft: '┏', topRight: '┓', bottomLeft: '┗', bottomRight: '┛',
    horizontal: '━', vertical: '┃', titleLeft: '┫', titleRight: '┣'
  },
  minimal: {
    topLeft: ' ', topRight: ' ', bottomLeft: ' ', bottomRight: ' ',
    horizontal: '─', vertical: ' ', titleLeft: ' ', titleRight: ' '
  }
};

/**
 * Badge types for status indicators
 */
export type BadgeType = 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary' | 'muted';

/**
 * Create a styled banner/header
 */
export function banner(text: string, options: {
  style?: BoxStyle;
  width?: number;
  padding?: number;
  centered?: boolean;
} = {}): string {
  const { style = 'rounded', width = 50, padding = 1, centered = true } = options;
  const chars = BOX_CHARS[style];
  const innerWidth = width - 2;
  const paddingStr = ' '.repeat(padding);

  const lines: string[] = [];

  // Top border
  lines.push(theme.primary(chars.topLeft + chars.horizontal.repeat(innerWidth) + chars.topRight));

  // Padding lines
  for (let i = 0; i < padding; i++) {
    lines.push(theme.primary(chars.vertical) + ' '.repeat(innerWidth) + theme.primary(chars.vertical));
  }

  // Content line
  const textLength = stripAnsi(text).length;
  let content: string;
  if (centered) {
    const leftPad = Math.floor((innerWidth - textLength) / 2);
    const rightPad = innerWidth - textLength - leftPad;
    content = ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  } else {
    content = paddingStr + text + ' '.repeat(innerWidth - textLength - padding);
  }
  lines.push(theme.primary(chars.vertical) + content + theme.primary(chars.vertical));

  // Padding lines
  for (let i = 0; i < padding; i++) {
    lines.push(theme.primary(chars.vertical) + ' '.repeat(innerWidth) + theme.primary(chars.vertical));
  }

  // Bottom border
  lines.push(theme.primary(chars.bottomLeft + chars.horizontal.repeat(innerWidth) + chars.bottomRight));

  return lines.join('\n');
}


/**
 * Create a styled box with optional title
 */
export function box(content: string | string[], options: {
  title?: string;
  style?: BoxStyle;
  width?: number;
  padding?: number;
  borderColor?: (text: string) => string;
  titleColor?: (text: string) => string;
} = {}): string {
  const {
    title,
    style = 'rounded',
    padding = 1,
    borderColor = theme.muted.bind(theme),
    titleColor = theme.primary.bind(theme)
  } = options;

  const chars = BOX_CHARS[style];
  const lines = Array.isArray(content) ? content : content.split('\n');

  // Calculate width
  const contentWidth = Math.max(
    ...lines.map(l => stripAnsi(l).length),
    title ? stripAnsi(title).length + 4 : 0
  );
  const innerWidth = options.width ? options.width - 2 : contentWidth + (padding * 2);

  const output: string[] = [];

  // Top border with optional title
  if (title) {
    const titleText = ` ${title} `;
    const titleLen = stripAnsi(titleText).length;
    const leftBorder = chars.horizontal.repeat(2);
    const rightBorder = chars.horizontal.repeat(innerWidth - titleLen - 2);
    output.push(
      borderColor(chars.topLeft + leftBorder) +
      titleColor(titleText) +
      borderColor(rightBorder + chars.topRight)
    );
  } else {
    output.push(borderColor(chars.topLeft + chars.horizontal.repeat(innerWidth) + chars.topRight));
  }

  // Content lines
  const paddingStr = ' '.repeat(padding);
  for (const line of lines) {
    const lineLen = stripAnsi(line).length;
    const rightPad = innerWidth - lineLen - (padding * 2);
    output.push(
      borderColor(chars.vertical) +
      paddingStr + line + ' '.repeat(Math.max(0, rightPad)) + paddingStr +
      borderColor(chars.vertical)
    );
  }

  // Bottom border
  output.push(borderColor(chars.bottomLeft + chars.horizontal.repeat(innerWidth) + chars.bottomRight));

  return output.join('\n');
}

/**
 * Create a horizontal divider
 */
export function divider(options: {
  width?: number;
  style?: 'single' | 'double' | 'dashed' | 'dotted' | 'heavy';
  label?: string;
  color?: (text: string) => string;
} = {}): string {
  const { width = 50, style = 'single', label, color = theme.muted.bind(theme) } = options;

  const chars: Record<string, string> = {
    single: '─',
    double: '═',
    dashed: '╌',
    dotted: '┄',
    heavy: '━'
  };

  const char = chars[style];

  if (label) {
    const labelText = ` ${label} `;
    const labelLen = stripAnsi(labelText).length;
    const sideLen = Math.floor((width - labelLen) / 2);
    return color(char.repeat(sideLen)) + theme.secondary(labelText) + color(char.repeat(width - sideLen - labelLen));
  }

  return color(char.repeat(width));
}

/**
 * Create a badge/tag
 */
export function badge(text: string, type: BadgeType = 'primary'): string {
  const colors: Record<BadgeType, (t: string) => string> = {
    success: (t) => chalk.bgGreen.black(` ${t} `),
    error: (t) => chalk.bgRed.white(` ${t} `),
    warning: (t) => chalk.bgYellow.black(` ${t} `),
    info: (t) => chalk.bgBlue.white(` ${t} `),
    primary: (t) => chalk.bgCyan.black(` ${t} `),
    secondary: (t) => chalk.bgMagenta.white(` ${t} `),
    muted: (t) => chalk.bgGray.white(` ${t} `)
  };

  return colors[type](text);
}

/**
 * Create a progress bar
 */
export function progressBar(current: number, total: number, options: {
  width?: number;
  showPercentage?: boolean;
  showCount?: boolean;
  filledChar?: string;
  emptyChar?: string;
  filledColor?: (text: string) => string;
  emptyColor?: (text: string) => string;
} = {}): string {
  const {
    width = 30,
    showPercentage = true,
    showCount = false,
    filledChar = '█',
    emptyChar = '░',
    filledColor = theme.success.bind(theme),
    emptyColor = theme.muted.bind(theme)
  } = options;

  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filledWidth = Math.round((percentage / 100) * width);
  const emptyWidth = width - filledWidth;

  let bar = filledColor(filledChar.repeat(filledWidth)) + emptyColor(emptyChar.repeat(emptyWidth));

  const parts: string[] = [bar];

  if (showPercentage) {
    parts.push(theme.text(`${Math.round(percentage)}%`));
  }

  if (showCount) {
    parts.push(theme.muted(`(${current}/${total})`));
  }

  return parts.join(' ');
}

/**
 * Create a status indicator
 */
export function status(state: 'success' | 'error' | 'warning' | 'info' | 'pending' | 'running', text?: string): string {
  const indicators: Record<string, { icon: string; color: (t: string) => string }> = {
    success: { icon: '✓', color: theme.success.bind(theme) },
    error: { icon: '✗', color: theme.error.bind(theme) },
    warning: { icon: '⚠', color: theme.warning.bind(theme) },
    info: { icon: 'ℹ', color: theme.info.bind(theme) },
    pending: { icon: '○', color: theme.muted.bind(theme) },
    running: { icon: '◐', color: theme.primary.bind(theme) }
  };

  const { icon, color } = indicators[state];
  return text ? `${color(icon)} ${text}` : color(icon);
}


/**
 * Create a formatted list
 */
export function list(items: string[], options: {
  style?: 'bullet' | 'numbered' | 'arrow' | 'dash' | 'check';
  indent?: number;
  itemColor?: (text: string) => string;
  bulletColor?: (text: string) => string;
} = {}): string {
  const {
    style = 'bullet',
    indent = 2,
    itemColor = (t: string) => t,
    bulletColor = theme.primary.bind(theme)
  } = options;

  const bullets: Record<string, string | ((i: number) => string)> = {
    bullet: '•',
    numbered: (i: number) => `${i + 1}.`,
    arrow: '→',
    dash: '─',
    check: '✓'
  };

  const indentStr = ' '.repeat(indent);

  return items.map((item, i) => {
    const bullet = typeof bullets[style] === 'function'
      ? (bullets[style] as (i: number) => string)(i)
      : bullets[style];
    return `${indentStr}${bulletColor(bullet)} ${itemColor(item)}`;
  }).join('\n');
}

/**
 * Create a key-value display
 */
export function keyValueList(items: Record<string, string | number | boolean | undefined>, options: {
  separator?: string;
  indent?: number;
  keyWidth?: number;
  keyColor?: (text: string) => string;
  valueColor?: (text: string) => string;
} = {}): string {
  const {
    separator = ':',
    indent = 2,
    keyColor = theme.muted.bind(theme),
    valueColor = theme.text.bind(theme)
  } = options;

  const entries = Object.entries(items).filter(([_, v]) => v !== undefined);
  const maxKeyLen = options.keyWidth || Math.max(...entries.map(([k]) => k.length));
  const indentStr = ' '.repeat(indent);

  return entries.map(([key, value]) => {
    const paddedKey = key.padEnd(maxKeyLen);
    return `${indentStr}${keyColor(paddedKey)} ${separator} ${valueColor(String(value))}`;
  }).join('\n');
}

/**
 * Create a section header
 */
export function sectionHeader(title: string, options: {
  icon?: string;
  style?: 'underline' | 'box' | 'simple';
  width?: number;
} = {}): string {
  const { icon, style = 'underline', width = 50 } = options;

  const titleText = icon ? `${icon}  ${title}` : title;

  switch (style) {
    case 'box':
      return box(titleText, { style: 'rounded', padding: 0 });
    case 'simple':
      return '\n' + theme.title(titleText) + '\n';
    case 'underline':
    default:
      const underline = '─'.repeat(stripAnsi(titleText).length);
      return '\n' + theme.title(titleText) + '\n' + theme.muted(underline);
  }
}

/**
 * Create a hint/tip message
 */
export function hint(text: string): string {
  return theme.muted('💡 ') + theme.muted(text);
}

/**
 * Create a command example
 */
export function commandExample(command: string, description?: string): string {
  const cmd = '  ' + chalk.bold.cyan('$') + ' ' + chalk.white(command);
  if (description) {
    return cmd + '\n  ' + theme.muted(description);
  }
  return cmd;
}

/**
 * Create a menu item display
 */
export function menuItem(icon: string, label: string, shortcut?: string, selected?: boolean): string {
  const prefix = selected ? theme.primary('▸ ') : '  ';
  const iconPart = icon + ' ';
  const labelPart = selected ? chalk.bold.white(label) : label;
  const shortcutPart = shortcut ? theme.muted(` (${shortcut})`) : '';

  return prefix + iconPart + labelPart + shortcutPart;
}

/**
 * Strip ANSI escape codes from text
 */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Create the main CLI banner
 */
export function cliBanner(): string {
  const logo = `
  ╭──────────────────────────────────────────╮
  │                                          │
  │   ${chalk.bold.cyan('⚡')} ${chalk.bold.white('Developer Toolbox')}                   │
  │   ${theme.muted('Your CLI companion for dev workflows')}   │
  │                                          │
  ╰──────────────────────────────────────────╯`;

  return theme.primary(logo.split('\n').map(line => {
    // Keep the inner content colored properly
    return line;
  }).join('\n'));
}

/**
 * Create a compact header for commands
 */
export function commandHeader(name: string, description?: string): string {
  const header = `\n${chalk.bold.cyan('⚡')} ${chalk.bold.white(name)}`;
  if (description) {
    return header + '\n' + theme.muted(description) + '\n';
  }
  return header + '\n';
}

/**
 * Create a result summary box
 */
export function resultSummary(title: string, stats: Record<string, number | string>, success: boolean = true): string {
  const icon = success ? '✓' : '✗';
  const iconColor = success ? theme.success.bind(theme) : theme.error.bind(theme);

  const lines = [
    iconColor(icon) + ' ' + chalk.bold.white(title),
    '',
    ...Object.entries(stats).map(([key, value]) =>
      `  ${theme.muted(key + ':')} ${theme.text(String(value))}`
    )
  ];

  return box(lines, { style: 'rounded', borderColor: success ? theme.success.bind(theme) : theme.error.bind(theme) });
}

/**
 * Create an action prompt display
 */
export function actionPrompt(actions: Array<{ key: string; label: string; description?: string }>): string {
  const lines = actions.map(action => {
    const keyPart = chalk.bgCyan.black(` ${action.key} `);
    const labelPart = chalk.white(action.label);
    const descPart = action.description ? theme.muted(` - ${action.description}`) : '';
    return `  ${keyPart} ${labelPart}${descPart}`;
  });

  return '\n' + lines.join('\n') + '\n';
}

export default {
  banner,
  box,
  divider,
  badge,
  progressBar,
  status,
  list,
  keyValueList,
  sectionHeader,
  hint,
  commandExample,
  menuItem,
  cliBanner,
  commandHeader,
  resultSummary,
  actionPrompt
};
