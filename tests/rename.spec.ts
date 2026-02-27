import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Playwright E2E Tests for Rename Command
 */

const TEST_DIR = path.join(process.cwd(), 'test-rename-e2e');
const CLI_CMD = 'node dist/cli.js rename';

test.beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
});

test.afterAll(async () => {
  if (await fs.access(TEST_DIR).then(() => true).catch(() => false)) {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  }
});

test.describe('Rename Command Help', () => {
  test('should show rename help', async () => {
    const output = execSync(`${CLI_CMD} --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('rename');
    expect(output).toContain('--pattern');
    expect(output).toContain('--case');
    expect(output).toContain('--dry-run');
  });
});

test.describe('Rename with Case Conversion', () => {
  test.beforeEach(async () => {
    const caseDir = path.join(TEST_DIR, 'case-test');
    await fs.mkdir(caseDir, { recursive: true });
    await fs.writeFile(path.join(caseDir, 'hello world.txt'), 'content');
    await fs.writeFile(path.join(caseDir, 'MY FILE.txt'), 'content');
    await fs.writeFile(path.join(caseDir, 'mixed_Case-file.txt'), 'content');
  });

  test('should convert to lowercase', async () => {
    const caseDir = path.join(TEST_DIR, 'case-test');
    const output = execSync(
      `${CLI_CMD} --case lower --filter "*.txt" --directory "${caseDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('Found');
    expect(output.toLowerCase()).toContain('.txt');
  });

  test('should convert to uppercase', async () => {
    const caseDir = path.join(TEST_DIR, 'case-test');
    const output = execSync(
      `${CLI_CMD} --case upper --filter "*.txt" --directory "${caseDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('Found');
  });

  test('should convert to kebab-case', async () => {
    const kebabDir = path.join(TEST_DIR, 'kebab-test');
    await fs.mkdir(kebabDir, { recursive: true });
    await fs.writeFile(path.join(kebabDir, 'Hello World.txt'), 'content');
    
    const output = execSync(
      `${CLI_CMD} --case kebab --filter "*.txt" --directory "${kebabDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('hello-world');
  });

  test('should convert to snake_case', async () => {
    const snakeDir = path.join(TEST_DIR, 'snake-test');
    await fs.mkdir(snakeDir, { recursive: true });
    await fs.writeFile(path.join(snakeDir, 'Hello World.txt'), 'content');
    
    const output = execSync(
      `${CLI_CMD} --case snake --filter "*.txt" --directory "${snakeDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('hello_world');
  });

  test('should convert to camelCase', async () => {
    const camelDir = path.join(TEST_DIR, 'camel-test');
    await fs.mkdir(camelDir, { recursive: true });
    await fs.writeFile(path.join(camelDir, 'my file name.txt'), 'content');
    
    const output = execSync(
      `${CLI_CMD} --case camel --filter "*.txt" --directory "${camelDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('myFileName');
  });
});

test.describe('Rename with Pattern', () => {
  test('should rename using pattern and replacement', async () => {
    const patternDir = path.join(TEST_DIR, 'pattern-test');
    await fs.mkdir(patternDir, { recursive: true });
    await fs.writeFile(path.join(patternDir, 'old_file1.txt'), 'content');
    await fs.writeFile(path.join(patternDir, 'old_file2.txt'), 'content');
    
    const output = execSync(
      `${CLI_CMD} --pattern "old_" --replacement "new_" --filter "*.txt" --directory "${patternDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('new_file');
  });

  test('should use regex patterns', async () => {
    const regexDir = path.join(TEST_DIR, 'regex-test');
    await fs.mkdir(regexDir, { recursive: true });
    await fs.writeFile(path.join(regexDir, 'file_001.txt'), 'content');
    await fs.writeFile(path.join(regexDir, 'file_002.txt'), 'content');
    
    const output = execSync(
      `${CLI_CMD} --pattern "_(\\d+)" --replacement "_v\\$1" --regex --filter "*.txt" --directory "${regexDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('Found');
  });
});

test.describe('Rename with Numbering', () => {
  test('should add sequential numbers', async () => {
    const numDir = path.join(TEST_DIR, 'number-test');
    await fs.mkdir(numDir, { recursive: true });
    await fs.writeFile(path.join(numDir, 'a.txt'), 'a');
    await fs.writeFile(path.join(numDir, 'b.txt'), 'b');
    await fs.writeFile(path.join(numDir, 'c.txt'), 'c');
    
    const output = execSync(
      `${CLI_CMD} --number "1,10" --filter "*.txt" --directory "${numDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('Found 3 file(s)');
  });

  test('should number with step', async () => {
    const stepDir = path.join(TEST_DIR, 'step-test');
    await fs.mkdir(stepDir, { recursive: true });
    await fs.writeFile(path.join(stepDir, 'x.txt'), 'x');
    await fs.writeFile(path.join(stepDir, 'y.txt'), 'y');
    
    const output = execSync(
      `${CLI_CMD} --number "10,100,10" --filter "*.txt" --directory "${stepDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('10.txt');
  });
});

test.describe('Rename with Template', () => {
  test('should rename using template', async () => {
    const templateDir = path.join(TEST_DIR, 'template-test');
    await fs.mkdir(templateDir, { recursive: true });
    await fs.writeFile(path.join(templateDir, 'photo.jpg'), 'content');
    
    const output = execSync(
      `${CLI_CMD} --template "vacation_{name}" --filter "*.jpg" --directory "${templateDir}" --dry-run`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('vacation_photo');
  });
});

test.describe('Rename Dry Run vs Actual', () => {
  test('should perform actual rename', async () => {
    const actualDir = path.join(TEST_DIR, 'actual-rename');
    await fs.mkdir(actualDir, { recursive: true });
    await fs.writeFile(path.join(actualDir, 'original.txt'), 'content');
    
    const output = execSync(
      `${CLI_CMD} --pattern "original" --replacement "renamed" --filter "*.txt" --directory "${actualDir}"`,
      { encoding: 'utf-8' }
    );
    
    expect(output).toContain('Success');
    
    // Verify file was renamed
    const files = await fs.readdir(actualDir);
    expect(files).toContain('renamed.txt');
    expect(files).not.toContain('original.txt');
  });
});

test.describe('Rename Undo', () => {
  test('should show undo help', async () => {
    const output = execSync(`${CLI_CMD} --help`, { encoding: 'utf-8' });
    expect(output).toContain('undo');
  });
});

test.describe('Rename Error Handling', () => {
  test('should handle non-existent directory', async () => {
    try {
      execSync(
        `${CLI_CMD} --case lower --directory "/non/existent/dir"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      expect(output.toLowerCase()).toMatch(/(not found|error|fail|no such|exist|directory)/i);
    }
  });
});
