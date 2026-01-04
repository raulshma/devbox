/**
 * Table Utility for CLI Output
 *
 * Provides formatted table output for CLI responses with support for:
 * - Auto-sizing columns based on content
 * - Alignment options (left, center, right)
 * - Border styles (ascii, markdown, compact, none)
 * - Color support via chalk
 * - Multi-line cell content
 * - Header rows
 */

import chalk from 'chalk';

/**
 * Alignment options for table columns
 */
export type ColumnAlignment = 'left' | 'center' | 'right';

/**
 * Border style options
 */
export type BorderStyle = 'ascii' | 'markdown' | 'compact' | 'none' | 'rounded' | 'double' | 'heavy';

/**
 * Table column configuration
 */
export interface ColumnConfig {
  /** Header text for the column */
  header: string;
  /** Minimum width of the column */
  minWidth?: number;
  /** Maximum width of the column (content will be wrapped) */
  maxWidth?: number;
  /** Alignment of content in the column */
  align?: ColumnAlignment;
  /** Whether to wrap text content */
  wrap?: boolean;
  /** Color function for styling content */
  color?: (text: string) => string;
  /** Header color function */
  headerColor?: (text: string) => string;
}

/**
 * Table row data
 */
export type RowData = Record<string, string | number | boolean | undefined | null>;

/**
 * Table options
 */
export interface TableOptions {
  /** Border style to use */
  borderStyle?: BorderStyle;
  /** Padding inside cells (number of spaces) */
  padding?: number;
  /** Maximum table width (for responsive tables) */
  maxWidth?: number;
  /** Whether to show headers */
  showHeaders?: boolean;
  /** Default header color */
  defaultHeaderColor?: (text: string) => string;
  /** Whether to use alternate row colors */
  alternateRowColors?: boolean;
}

/**
 * Border characters for different styles
 */
const BORDER_STYLES: Record<BorderStyle, {
  horizontal: string;
  vertical: string;
  corner: string;
  headerSeparator: string;
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  leftT: string;
  rightT: string;
  topT: string;
  bottomT: string;
  cross: string;
}> = {
  ascii: {
    horizontal: '-',
    vertical: '|',
    corner: '+',
    headerSeparator: '+',
    topLeft: '+', topRight: '+', bottomLeft: '+', bottomRight: '+',
    leftT: '+', rightT: '+', topT: '+', bottomT: '+', cross: '+',
  },
  markdown: {
    horizontal: '-',
    vertical: '|',
    corner: '|',
    headerSeparator: '|',
    topLeft: '|', topRight: '|', bottomLeft: '|', bottomRight: '|',
    leftT: '|', rightT: '|', topT: '|', bottomT: '|', cross: '|',
  },
  compact: {
    horizontal: '',
    vertical: '|',
    corner: '',
    headerSeparator: '|',
    topLeft: '', topRight: '', bottomLeft: '', bottomRight: '',
    leftT: '', rightT: '', topT: '', bottomT: '', cross: '',
  },
  none: {
    horizontal: '',
    vertical: '  ',
    corner: '',
    headerSeparator: '  ',
    topLeft: '', topRight: '', bottomLeft: '', bottomRight: '',
    leftT: '', rightT: '', topT: '', bottomT: '', cross: '',
  },
  rounded: {
    horizontal: '─',
    vertical: '│',
    corner: '─',
    headerSeparator: '│',
    topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯',
    leftT: '├', rightT: '┤', topT: '┬', bottomT: '┴', cross: '┼',
  },
  double: {
    horizontal: '═',
    vertical: '║',
    corner: '═',
    headerSeparator: '║',
    topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝',
    leftT: '╠', rightT: '╣', topT: '╦', bottomT: '╩', cross: '╬',
  },
  heavy: {
    horizontal: '━',
    vertical: '┃',
    corner: '━',
    headerSeparator: '┃',
    topLeft: '┏', topRight: '┓', bottomLeft: '┗', bottomRight: '┛',
    leftT: '┣', rightT: '┫', topT: '┳', bottomT: '┻', cross: '╋',
  },
};

/**
 * Table class for creating formatted CLI tables
 */
export class Table {
  private columns: Map<string, ColumnConfig>;
  private rows: RowData[];
  private options: Required<TableOptions>;

  constructor(options: TableOptions = {}) {
    this.columns = new Map();
    this.rows = [];
    this.options = {
      borderStyle: options.borderStyle || 'ascii',
      padding: options.padding ?? 1,
      maxWidth: options.maxWidth || Number.MAX_VALUE,
      showHeaders: options.showHeaders ?? true,
      defaultHeaderColor: options.defaultHeaderColor || chalk.cyan.bold,
      alternateRowColors: options.alternateRowColors ?? false,
    };
  }

  /**
   * Add a column to the table
   */
  addColumn(key: string, config: ColumnConfig): this {
    this.columns.set(key, {
      align: 'left',
      wrap: true,
      ...config,
    });
    return this;
  }

  /**
   * Add multiple columns at once
   */
  addColumns(columns: Record<string, ColumnConfig>): this {
    Object.entries(columns).forEach(([key, config]) => {
      this.addColumn(key, config);
    });
    return this;
  }

  /**
   * Add a row of data
   */
  addRow(row: RowData): this {
    this.rows.push(row);
    return this;
  }

  /**
   * Add multiple rows at once
   */
  addRows(rows: RowData[]): this {
    rows.forEach(row => this.addRow(row));
    return this;
  }

  /**
   * Calculate column widths based on content
   */
  private calculateColumnWidths(): Map<string, number> {
    const widths = new Map<string, number>();

    // Initialize with header widths
    this.columns.forEach((config, key) => {
      const headerText = config.header;
      const headerLength = this.stripAnsi(headerText).length;
      widths.set(key, Math.max(headerLength, config.minWidth || 0));
    });

    // Update based on row content
    this.rows.forEach(row => {
      this.columns.forEach((config, key) => {
        const value = this.formatCellValue(row[key]);
        const valueLength = this.stripAnsi(value).length;
        const currentWidth = widths.get(key) || 0;
        const maxWidth = config.maxWidth || Number.MAX_VALUE;

        widths.set(key, Math.min(Math.max(currentWidth, valueLength), maxWidth));
      });
    });

    return widths;
  }

  /**
   * Format a cell value to string
   */
  private formatCellValue(value: string | number | boolean | undefined | null): string {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  }

  /**
   * Strip ANSI escape codes from text
   */
  private stripAnsi(text: string): string {
    // Remove ANSI escape codes
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Pad text to specified width with alignment
   */
  private padText(text: string, width: number, align: ColumnAlignment, padding: number): string {
    const textLength = this.stripAnsi(text).length;
    const totalPadding = width - textLength;
    const sidePadding = ' '.repeat(padding);

    if (totalPadding <= 0) {
      return sidePadding + text + sidePadding;
    }

    switch (align) {
      case 'center':
        const leftPad = ' '.repeat(Math.floor(totalPadding / 2));
        const rightPad = ' '.repeat(totalPadding - Math.floor(totalPadding / 2));
        return sidePadding + leftPad + text + rightPad + sidePadding;

      case 'right':
        return sidePadding + ' '.repeat(totalPadding) + text + sidePadding;

      case 'left':
      default:
        return sidePadding + text + ' '.repeat(totalPadding) + sidePadding;
    }
  }

  /**
   * Wrap text to fit within width
   */
  private wrapText(text: string, width: number): string[] {
    const strippedText = this.stripAnsi(text);

    if (strippedText.length <= width) {
      return [text];
    }

    const lines: string[] = [];
    let remainingText = text;

    while (this.stripAnsi(remainingText).length > width) {
      // Find the best break point (space, dash, or slash)
      let breakIndex = -1;

      for (let i = width - 1; i >= 0; i--) {
        const char = strippedText[i];
        if (char === ' ' || char === '-' || char === '/') {
          breakIndex = i;
          break;
        }
      }

      if (breakIndex === -1) {
        // No good break point, force break at width
        breakIndex = width;
      }

      lines.push(remainingText.substring(0, breakIndex).trimEnd());
      remainingText = remainingText.substring(breakIndex).trimStart();
    }

    if (remainingText) {
      lines.push(remainingText);
    }

    return lines;
  }

  /**
   * Generate the table as a string
   */
  toString(): string {
    if (this.columns.size === 0) {
      return '';
    }

    const borders = BORDER_STYLES[this.options.borderStyle];
    const columnKeys = Array.from(this.columns.keys());
    const columnWidths = this.calculateColumnWidths();

    const lines: string[] = [];

    // Top border
    if (this.options.borderStyle !== 'none' && this.options.borderStyle !== 'compact') {
      lines.push(this.createBorderLine(columnKeys, columnWidths, 'top'));
    }

    // Header row
    if (this.options.showHeaders) {
      const headerLine = this.createRowLine(
        columnKeys.map(key => ({
          config: this.columns.get(key)!,
          width: columnWidths.get(key)!,
          value: this.columns.get(key)!.header,
          isHeader: true,
        })),
        borders.vertical,
        -1
      );
      lines.push(headerLine);

      // Header separator
      if (this.options.borderStyle !== 'none' && this.options.borderStyle !== 'compact') {
        lines.push(this.createBorderLine(columnKeys, columnWidths, 'middle'));
      }
    }

    // Data rows
    this.rows.forEach((row, rowIndex) => {
      const rowData = columnKeys.map(key => ({
        config: this.columns.get(key)!,
        width: columnWidths.get(key)!,
        value: this.formatCellValue(row[key]),
        isHeader: false,
        color: this.columns.get(key)!.color,
      }));

      // Check if we need to wrap lines
      const maxLines = Math.max(
        ...rowData.map(col => {
          if (col.config.wrap && this.stripAnsi(col.value).length > col.width) {
            return this.wrapText(col.value, col.width).length;
          }
          return 1;
        })
      );

      for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
        const rowDataForLine = rowData.map(col => {
          if (col.config.wrap && this.stripAnsi(col.value).length > col.width) {
            const wrappedLines = this.wrapText(col.value, col.width);
            return {
              ...col,
              value: wrappedLines[lineIndex] || '',
            };
          }
          return lineIndex === 0 ? col : { ...col, value: '' };
        });

        lines.push(this.createRowLine(rowDataForLine, borders.vertical, rowIndex));
      }

      // Row separator (for ascii style)
      if (this.options.borderStyle === 'ascii' && rowIndex < this.rows.length - 1) {
        lines.push(this.createBorderLine(columnKeys, columnWidths, 'middle'));
      }
    });

    // Bottom border
    if (this.options.borderStyle !== 'none' && this.options.borderStyle !== 'compact') {
      lines.push(this.createBorderLine(columnKeys, columnWidths, 'bottom'));
    }

    return lines.join('\n');
  }

  /**
   * Create a border line
   */
  private createBorderLine(
    columnKeys: string[],
    columnWidths: Map<string, number>,
    position: 'top' | 'middle' | 'bottom'
  ): string {
    const borders = BORDER_STYLES[this.options.borderStyle];

    let left: string, right: string, join: string;

    switch (position) {
      case 'top':
        left = borders.topLeft;
        right = borders.topRight;
        join = borders.topT;
        break;
      case 'middle':
        left = borders.leftT;
        right = borders.rightT;
        join = borders.cross;
        break;
      case 'bottom':
        left = borders.bottomLeft;
        right = borders.bottomRight;
        join = borders.bottomT;
        break;
    }

    const parts = columnKeys.map(key => {
      const width = columnWidths.get(key)!;
      return borders.horizontal.repeat(width + 2 * this.options.padding);
    });

    return left + parts.join(join) + right;
  }

  /**
   * Create a row line
   */
  private createRowLine(
    columns: Array<{
      config: ColumnConfig;
      width: number;
      value: string;
      isHeader: boolean;
      color?: (text: string) => string;
    }>,
    vertical: string,
    rowIndex: number
  ): string {
    const parts = columns.map(col => {
      let value = col.value;

      // Apply color
      if (col.isHeader && col.config.headerColor) {
        value = col.config.headerColor(value);
      } else if (col.isHeader && this.options.defaultHeaderColor) {
        value = this.options.defaultHeaderColor(value);
      } else if (col.color && !col.isHeader) {
        value = col.color(value);
      }

      // Apply alternate row coloring if enabled
      if (!col.isHeader && this.options.alternateRowColors && rowIndex % 2 === 0) {
        value = chalk.gray(value);
      }

      return this.padText(value, col.width, col.config.align!, this.options.padding);
    });

    return vertical + parts.join(vertical) + vertical;
  }

  /**
   * Render the table to console
   */
  render(): void {
    console.log(this.toString());
  }

  /**
   * Clear all rows from the table
   */
  clearRows(): this {
    this.rows = [];
    return this;
  }

  /**
   * Clear all columns from the table
   */
  clearColumns(): this {
    this.columns.clear();
    return this;
  }

  /**
   * Get the number of rows
   */
  get rowCount(): number {
    return this.rows.length;
  }

  /**
   * Get the number of columns
   */
  get columnCount(): number {
    return this.columns.size;
  }
}

/**
 * Quick function to create and render a table
 */
export function printTable(
  columns: Record<string, ColumnConfig>,
  rows: RowData[],
  options?: TableOptions
): string {
  const table = new Table(options);
  table.addColumns(columns);
  table.addRows(rows);
  return table.toString();
}

/**
 * Quick function to create and render a table to console
 */
export function renderTable(
  columns: Record<string, ColumnConfig>,
  rows: RowData[],
  options?: TableOptions
): void {
  console.log(printTable(columns, rows, options));
}

/**
 * Create a simple table with default settings
 */
export function createSimpleTable(headers: string[], data: string[][]): string {
  const columns: Record<string, ColumnConfig> = {};
  headers.forEach((header, index) => {
    columns[`col${index}`] = { header };
  });

  const rows = data.map(row => {
    const rowData: RowData = {};
    row.forEach((cell, index) => {
      rowData[`col${index}`] = cell;
    });
    return rowData;
  });

  return printTable(columns, rows);
}

export default Table;
