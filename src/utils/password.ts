/**
 * Password Utilities
 *
 * Secure password input handling for CLI
 */

import * as readline from 'readline';
import { EventEmitter } from 'events';

/**
 * Prompt for password input with hidden characters
 *
 * @param prompt - The prompt message to display
 * @returns A Promise that resolves to the entered password
 */
export async function promptPassword(
  prompt: string = 'Enter password: '
): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Hide the output
    (process.stdout as any).write(prompt);

    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');

    let password = '';
    let done = false;

    const onData = (char: string) => {
      if (done) return;

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl-D
          // Done
          done = true;
          (process.stdout as any).write('\n');
          stdin.pause();
          stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          rl.close();
          resolve(password);
          break;
        case '\u0003': // Ctrl-C
          // Cancel
          done = true;
          (process.stdout as any).write('\n');
          stdin.pause();
          stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          rl.close();
          reject(new Error('Password entry cancelled'));
          break;
        case '\u007F': // Backspace
          // Remove last character
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
          break;
        default:
          // Add character
          password += char;
          break;
      }
    };

    stdin.on('data', onData);
  });
}

/**
 * Prompt for password with confirmation
 *
 * @param prompt - The prompt message to display
 * @returns A Promise that resolves to the entered password
 * @throws Error if passwords don't match
 */
export async function promptPasswordWithConfirmation(
  prompt: string = 'Enter password: '
): Promise<string> {
  const password = await promptPassword(prompt);
  const confirmation = await promptPassword('Confirm password: ');

  if (password !== confirmation) {
    throw new Error('Passwords do not match');
  }

  return password;
}

/**
 * Common weak passwords that should be rejected
 */
const COMMON_PASSWORDS = [
  'password',
  'Password1',
  'Password123',
  'Admin123',
  'Welcome1',
  '12345678',
  'abcdefg1',
  'Qwerty1',
  'Letmein1',
  'Monkey1',
  'Dragon1',
  'Sunshine1',
  'Princess1',
  'Football1',
  'Baseball1',
  'Soccer1',
  'Hockey1',
  'Batman1',
  'Superman1',
  'Trustno1',
  'Iloveyou1',
  'Michael1',
  'Jennifer1',
  'Jordan1',
  'Ashley1',
  'Aa123456',
  'Ad123456',
  'Abc12345',
  'Password!',
  'Password@',
  'P@ssword1',
  'P@ssw0rd',
];

/**
 * Password strength levels
 */
export enum PasswordStrength {
  VERY_WEAK = 0,
  WEAK = 1,
  FAIR = 2,
  GOOD = 3,
  STRONG = 4,
  VERY_STRONG = 5,
}

/**
 * Password validation result with detailed feedback
 */
export interface PasswordValidationResult {
  valid: boolean;
  strength: PasswordStrength;
  score: number; // 0-100
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Calculate password entropy (measure of randomness)
 *
 * @param password - The password to analyze
 * @returns The entropy value in bits
 */
export function calculateEntropy(password: string): number {
  if (password.length === 0) return 0;

  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

  // Entropy = length * log2(poolSize)
  return password.length * Math.log2(poolSize);
}

/**
 * Calculate password strength score (0-100)
 *
 * @param password - The password to analyze
 * @returns A score from 0 to 100
 */
export function calculatePasswordScore(password: string): number {
  let score = 0;

  // Length scoring (up to 40 points)
  const length = password.length;
  if (length >= 12) score += 40;
  else if (length >= 10) score += 30;
  else if (length >= 8) score += 20;
  else score += 10;

  // Character variety (up to 30 points)
  if (/[a-z]/.test(password)) score += 7.5;
  if (/[A-Z]/.test(password)) score += 7.5;
  if (/[0-9]/.test(password)) score += 7.5;
  if (/[^a-zA-Z0-9]/.test(password)) score += 7.5;

  // Entropy bonus (up to 20 points)
  const entropy = calculateEntropy(password);
  if (entropy >= 60) score += 20;
  else if (entropy >= 50) score += 15;
  else if (entropy >= 40) score += 10;
  else if (entropy >= 30) score += 5;

  // Pattern penalties
  // Repeated characters
  if (/(.)\1{2,}/.test(password)) score -= 10;

  // Sequential characters
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789|890)/i.test(password)) {
    score -= 10;
  }

  // Keyboard patterns
  if (/(?:qwerty|asdf|zxcv|qaz|wsx|edc|rfv|tgb|yhn|ujm|ik|ol)/i.test(password)) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Determine password strength level
 *
 * @param score - The password score (0-100)
 * @returns The password strength level
 */
export function getPasswordStrength(score: number): PasswordStrength {
  if (score >= 90) return PasswordStrength.VERY_STRONG;
  if (score >= 75) return PasswordStrength.STRONG;
  if (score >= 60) return PasswordStrength.GOOD;
  if (score >= 45) return PasswordStrength.FAIR;
  if (score >= 30) return PasswordStrength.WEAK;
  return PasswordStrength.VERY_WEAK;
}

/**
 * Validate password strength with detailed feedback
 *
 * @param password - The password to validate
 * @returns A detailed validation result
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Length validation
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
    suggestions.push('Use at least 12 characters for better security');
  } else if (password.length < 12) {
    warnings.push('Password length is below recommended 12 characters');
    suggestions.push('Consider using 12+ characters for stronger security');
  }

  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }

  // Character variety checks
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (!hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasDigit) {
    errors.push('Password must contain at least one digit');
  }
  if (!hasSpecial) {
    warnings.push('Password does not contain special characters (!@#$%^&*)');
    suggestions.push('Add special characters to increase strength');
  }

  // Common password check
  const lowerPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.some((common) => common.toLowerCase() === lowerPassword)) {
    errors.push('This is a commonly used password that is easy to guess');
    suggestions.push('Choose a unique, memorable passphrase instead');
  }

  // Pattern checks
  if (/(.)\1{2,}/.test(password)) {
    warnings.push('Password contains repeated characters');
    suggestions.push('Avoid repeating the same character multiple times');
  }

  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789|890)/i.test(password)) {
    warnings.push('Password contains sequential characters');
    suggestions.push('Avoid sequential characters like "abc" or "123"');
  }

  if (/(?:qwerty|asdf|zxcv|qaz|wsx|edc|rfv|tgb|yhn|ujm|ik|ol)/i.test(password)) {
    warnings.push('Password contains keyboard patterns');
    suggestions.push('Avoid keyboard patterns like "qwerty" or "asdf"');
  }

  // Calculate score and strength
  const score = calculatePasswordScore(password);
  const strength = getPasswordStrength(score);

  // Add entropy-based suggestions
  const entropy = calculateEntropy(password);
  if (entropy < 40) {
    suggestions.push('Increase password complexity with more character types');
  }

  // General security suggestions
  if (strength < PasswordStrength.GOOD) {
    suggestions.push('Consider using a passphrase of 4+ random words');
    suggestions.push('Use a password manager to generate and store strong passwords');
  }

  const valid = errors.length === 0;

  return {
    valid,
    strength,
    score,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Legacy validatePassword function for backward compatibility
 * @deprecated Use validatePassword() instead for detailed feedback
 */
export function validatePasswordSimple(password: string): {
  valid: boolean;
  error?: string;
} {
  const result = validatePassword(password);
  return {
    valid: result.valid,
    error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
  };
}

/**
 * Get human-readable strength label
 *
 * @param strength - The password strength level
 * @returns A human-readable label
 */
export function getStrengthLabel(strength: PasswordStrength): string {
  const labels = [
    'Very Weak',
    'Weak',
    'Fair',
    'Good',
    'Strong',
    'Very Strong',
  ];
  return labels[strength] || 'Unknown';
}

/**
 * Get strength color code for terminal output
 *
 * @param strength - The password strength level
 * @returns ANSI color code or function name for chalk
 */
export function getStrengthColor(strength: PasswordStrength): string {
  const colors = ['red', 'red', 'yellow', 'yellow', 'green', 'green'];
  return colors[strength] || 'white';
}
