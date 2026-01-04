import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for CLI Testing
 *
 * This configuration is set up for testing CLI tools using the Node.js driver.
 * For CLI tools, we use the 'node' runner instead of browser-based testing.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',

  use: {
    // Use Node.js runner for CLI testing
    actionTimeout: 10000,
  },

  projects: [
    {
      name: 'cli-tests',
      use: {
        // For CLI testing, we'll use execSync in tests
      },
    },
  ],

  // Run local dev server before starting tests (not needed for CLI tools)
  // webServer: {
  //   command: 'npm run start',
  //   port: 3000,
  // },
});
