/**
 * Winston Logger Configuration
 *
 * Centralized logging system with multiple transports and log levels.
 * Provides structured logging for debugging, auditing, and monitoring.
 */

import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

// Define log levels
export const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors for console output
export const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Tell winston about the colors
winston.addColors(logColors);

/**
 * Custom log format with timestamp and colorization
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }

    // Add stack trace for errors
    if (stack) {
      msg += `\n${stack}`;
    }

    return msg;
  })
);

/**
 * Console format with colors
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

/**
 * Ensure logs directory exists
 */
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Create Winston logger instance
 */
export const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'info',
    }),

    // Error log file - only errors and warnings
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Combined log file - all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Audit log file - for auditing purposes
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
    }),
  ],
});

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: string) {
  return logger.child({ context });
}

/**
 * Stream for Morgan HTTP logger (if needed in future)
 */
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

/**
 * Log levels enumeration for type safety
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug',
}

/**
 * Set the minimum log level
 */
export function setLogLevel(level: LogLevel): void {
  logger.level = level;
  logger.info(`Log level set to: ${level}`);
}

/**
 * Get current log level
 */
export function getLogLevel(): string {
  return logger.level;
}

export default logger;
