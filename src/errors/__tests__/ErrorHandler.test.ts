/**
 * ErrorHandler Unit Tests
 */

import { jest } from '@jest/globals';
import {
  ErrorHandler,
  handleError,
  formatError,
  withErrorHandling,
  safeAsync,
  safe,
} from '../ErrorHandler.js';
import { AppError, ErrorCategory, ErrorSeverity } from '../types.js';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;
  let consoleSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    handler = new ErrorHandler({ logErrors: false, verbose: false });
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create handler with default config', () => {
      const h = new ErrorHandler();
      expect(h.getConfig()).toBeDefined();
    });

    it('should accept custom config', () => {
      const h = new ErrorHandler({ verbose: true, showStackTraces: true });
      const config = h.getConfig();
      expect(config.verbose).toBe(true);
      expect(config.showStackTraces).toBe(true);
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      handler.configure({ verbose: true });
      expect(handler.getConfig().verbose).toBe(true);
    });
  });

  describe('isAppError', () => {
    it('should identify AppError', () => {
      const appError: AppError = {
        name: 'AppError',
        message: 'Test error',
        code: 'TEST_ERROR',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.ERROR,
      };
      expect(handler.isAppError(appError as Error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');
      expect(handler.isAppError(error)).toBe(false);
    });
  });

  describe('wrapError', () => {
    it('should wrap regular Error in AppError', () => {
      const error = new Error('Test error');
      const wrapped = handler.wrapError(error);
      
      expect(wrapped.message).toBe('Test error');
      expect(wrapped.category).toBeDefined();
      expect(wrapped.severity).toBeDefined();
    });

    it('should preserve original error details', () => {
      const error = new Error('Original message');
      error.stack = 'Test stack';
      const wrapped = handler.wrapError(error);
      
      expect(wrapped.message).toBe('Original message');
    });
  });

  describe('format', () => {
    it('should format error as string', () => {
      const error = new Error('Test error');
      const formatted = handler.format(error);
      
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should format AppError with details', () => {
      const appError: AppError = {
        name: 'AppError',
        message: 'Detailed error',
        code: 'DETAILED_ERROR',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.ERROR,
        details: { key: 'value' },
      };
      
      const formatted = handler.format(appError as Error);
      expect(formatted).toContain('Detailed error');
    });
  });

  describe('handle', () => {
    it('should handle errors without throwing', () => {
      const error = new Error('Handled error');
      expect(() => handler.handle(error)).not.toThrow();
    });
  });
});

describe('handleError function', () => {
  let consoleSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should handle errors via global function', () => {
    const error = new Error('Test');
    expect(() => handleError(error)).not.toThrow();
  });
});

describe('formatError function', () => {
  it('should format errors via global function', () => {
    const error = new Error('Test');
    const formatted = formatError(error);
    expect(typeof formatted).toBe('string');
  });
});

describe('withErrorHandling', () => {
  it('should wrap sync function with error handling', () => {
    const fn = () => 'result';
    const wrapped = withErrorHandling(fn);
    
    expect(wrapped()).toBe('result');
  });

  it('should wrap async function with error handling', async () => {
    const fn = async () => 'async result';
    const wrapped = withErrorHandling(fn);
    
    expect(await wrapped()).toBe('async result');
  });
});

describe('safeAsync', () => {
  it('should return success result for resolved promise', async () => {
    const result = await safeAsync(async () => 'success');
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('success');
    }
  });

  it('should return error result for rejected promise', async () => {
    const result = await safeAsync(async () => {
      throw new Error('Test error');
    });
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('safe', () => {
  it('should return success result for successful function', () => {
    const result = safe(() => 'success');
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('success');
    }
  });

  it('should return error result for throwing function', () => {
    const result = safe(() => {
      throw new Error('Test error');
    });
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('ErrorCategory', () => {
  it('should have required categories', () => {
    expect(ErrorCategory.VALIDATION).toBeDefined();
    expect(ErrorCategory.SYSTEM).toBeDefined();
    expect(ErrorCategory.FILE_SYSTEM).toBeDefined();
    expect(ErrorCategory.NETWORK).toBeDefined();
  });
});

describe('ErrorSeverity', () => {
  it('should have required severity levels', () => {
    expect(ErrorSeverity.INFO).toBeDefined();
    expect(ErrorSeverity.WARNING).toBeDefined();
    expect(ErrorSeverity.ERROR).toBeDefined();
    expect(ErrorSeverity.CRITICAL).toBeDefined();
  });
});
