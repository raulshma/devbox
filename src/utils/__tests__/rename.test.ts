/**
 * Rename Utility Unit Tests
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  convertCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toPascalCase,
} from '../rename.js';

describe('Case Conversion Functions', () => {
  describe('convertCase', () => {
    it('should convert to uppercase', () => {
      expect(convertCase('hello world', 'upper')).toBe('HELLO WORLD');
    });

    it('should convert to lowercase', () => {
      expect(convertCase('HELLO WORLD', 'lower')).toBe('hello world');
    });

    it('should convert to title case', () => {
      expect(convertCase('hello world', 'title')).toBe('Hello World');
    });

    it('should convert to sentence case', () => {
      expect(convertCase('hello world', 'sentence')).toBe('Hello world');
    });

    it('should convert to camelCase', () => {
      expect(convertCase('hello world', 'camel')).toBe('helloWorld');
    });

    it('should convert to kebab-case', () => {
      expect(convertCase('hello world', 'kebab')).toBe('hello-world');
    });

    it('should convert to snake_case', () => {
      expect(convertCase('hello world', 'snake')).toBe('hello_world');
    });

    it('should convert to PascalCase', () => {
      expect(convertCase('hello world', 'pascal')).toBe('HelloWorld');
    });

    it('should handle empty string', () => {
      expect(convertCase('', 'upper')).toBe('');
    });
  });

  describe('toCamelCase', () => {
    it('should convert space-separated words', () => {
      expect(toCamelCase('hello world')).toBe('helloWorld');
    });

    it('should convert kebab-case', () => {
      expect(toCamelCase('hello-world')).toBe('helloWorld');
    });

    it('should convert snake_case', () => {
      expect(toCamelCase('hello_world')).toBe('helloWorld');
    });

    it('should convert PascalCase', () => {
      expect(toCamelCase('HelloWorld')).toBe('helloWorld');
    });

    it('should handle multiple words', () => {
      expect(toCamelCase('hello world from test')).toBe('helloWorldFromTest');
    });

    it('should handle single word', () => {
      expect(toCamelCase('hello')).toBe('hello');
    });
  });

  describe('toKebabCase', () => {
    it('should convert space-separated words', () => {
      expect(toKebabCase('hello world')).toBe('hello-world');
    });

    it('should convert camelCase', () => {
      expect(toKebabCase('helloWorld')).toBe('hello-world');
    });

    it('should convert PascalCase', () => {
      expect(toKebabCase('HelloWorld')).toBe('hello-world');
    });

    it('should convert snake_case', () => {
      expect(toKebabCase('hello_world')).toBe('hello-world');
    });

    it('should handle uppercase', () => {
      expect(toKebabCase('HELLO WORLD')).toBe('hello-world');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert space-separated words', () => {
      expect(toSnakeCase('hello world')).toBe('hello_world');
    });

    it('should convert camelCase', () => {
      expect(toSnakeCase('helloWorld')).toBe('hello_world');
    });

    it('should convert PascalCase', () => {
      expect(toSnakeCase('HelloWorld')).toBe('hello_world');
    });

    it('should convert kebab-case', () => {
      expect(toSnakeCase('hello-world')).toBe('hello_world');
    });
  });

  describe('toPascalCase', () => {
    it('should convert space-separated words', () => {
      expect(toPascalCase('hello world')).toBe('HelloWorld');
    });

    it('should convert camelCase', () => {
      expect(toPascalCase('helloWorld')).toBe('HelloWorld');
    });

    it('should convert kebab-case', () => {
      expect(toPascalCase('hello-world')).toBe('HelloWorld');
    });

    it('should convert snake_case', () => {
      expect(toPascalCase('hello_world')).toBe('HelloWorld');
    });

    it('should handle lowercase', () => {
      expect(toPascalCase('hello')).toBe('Hello');
    });
  });
});

describe('Edge Cases', () => {
  describe('special characters', () => {
    it('should handle numbers in string', () => {
      expect(toCamelCase('hello 123 world')).toBe('hello123World');
    });

    it('should handle multiple spaces', () => {
      expect(toCamelCase('hello   world')).toBe('helloWorld');
    });

    it('should handle mixed separators', () => {
      expect(toKebabCase('hello_world-test case')).toBe('hello-world-test-case');
    });
  });

  describe('unicode', () => {
    it('should handle basic unicode', () => {
      expect(convertCase('héllo wörld', 'upper')).toBe('HÉLLO WÖRLD');
    });
  });
});
