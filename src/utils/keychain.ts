/**
 * Keychain Utilities
 *
 * Secure password storage using OS keychain integration (Windows Credential Manager,
 * macOS Keychain, or Linux Secret Service API via libsecret)
 *
 * Uses the 'keytar' package to interact with the native OS secure storage.
 * Keytar is optional - if not available, keychain operations will fail gracefully.
 */

// Lazy-loaded keytar module
let keytarModule: typeof import('keytar') | null = null;
let keytarLoadAttempted = false;
let keytarLoadError: string | null = null;

/**
 * Dynamically load keytar module
 * Returns null if keytar is not available (e.g., when running via npx)
 */
async function getKeytar(): Promise<typeof import('keytar') | null> {
  if (keytarLoadAttempted) {
    return keytarModule;
  }

  keytarLoadAttempted = true;

  try {
    keytarModule = await import('keytar');
    return keytarModule;
  } catch (error) {
    keytarLoadError = error instanceof Error ? error.message : String(error);
    return null;
  }
}

/**
 * Default service name for Developer Toolbox CLI
 */
export const DEFAULT_SERVICE_NAME = 'developer-toolbox-cli';

/**
 * Result of a keychain operation
 */
export interface KeychainResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Stored credential information
 */
export interface StoredCredential {
  account: string;
  password: string;
}

/**
 * Options for keychain operations
 */
export interface KeychainOptions {
  /** Service name (default: 'developer-toolbox-cli') */
  service?: string;
}

const KEYTAR_NOT_AVAILABLE_ERROR = 
  'Keychain functionality is not available. This feature requires the "keytar" native module which may not work when running via npx/pnpx. Install the package globally (npm install -g @sckrz/devbox) to use keychain features.';

/**
 * Store a password in the OS keychain
 *
 * @param account - The account identifier (e.g., filename or encryption key name)
 * @param password - The password to store
 * @param options - Keychain options
 * @returns Result of the operation
 */
export async function storePassword(
  account: string,
  password: string,
  options: KeychainOptions = {}
): Promise<KeychainResult> {
  const keytar = await getKeytar();
  if (!keytar) {
    return { success: false, error: KEYTAR_NOT_AVAILABLE_ERROR };
  }

  const service = options.service || DEFAULT_SERVICE_NAME;

  try {
    await keytar.setPassword(service, account, password);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to store password in keychain: ${message}`,
    };
  }
}

/**
 * Retrieve a password from the OS keychain
 *
 * @param account - The account identifier
 * @param options - Keychain options
 * @returns Result containing the password if found
 */
export async function retrievePassword(
  account: string,
  options: KeychainOptions = {}
): Promise<KeychainResult<string>> {
  const keytar = await getKeytar();
  if (!keytar) {
    return { success: false, error: KEYTAR_NOT_AVAILABLE_ERROR };
  }

  const service = options.service || DEFAULT_SERVICE_NAME;

  try {
    const password = await keytar.getPassword(service, account);

    if (password === null) {
      return {
        success: false,
        error: `No password found for account '${account}'`,
      };
    }

    return { success: true, data: password };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to retrieve password from keychain: ${message}`,
    };
  }
}

/**
 * Delete a password from the OS keychain
 *
 * @param account - The account identifier
 * @param options - Keychain options
 * @returns Result of the operation
 */
export async function deletePassword(
  account: string,
  options: KeychainOptions = {}
): Promise<KeychainResult> {
  const keytar = await getKeytar();
  if (!keytar) {
    return { success: false, error: KEYTAR_NOT_AVAILABLE_ERROR };
  }

  const service = options.service || DEFAULT_SERVICE_NAME;

  try {
    const deleted = await keytar.deletePassword(service, account);

    if (!deleted) {
      return {
        success: false,
        error: `No password found for account '${account}'`,
      };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to delete password from keychain: ${message}`,
    };
  }
}

/**
 * Check if a password exists in the keychain
 *
 * @param account - The account identifier
 * @param options - Keychain options
 * @returns True if the password exists
 */
export async function hasPassword(
  account: string,
  options: KeychainOptions = {}
): Promise<boolean> {
  const keytar = await getKeytar();
  if (!keytar) {
    return false;
  }

  const service = options.service || DEFAULT_SERVICE_NAME;

  try {
    const password = await keytar.getPassword(service, account);
    return password !== null;
  } catch {
    return false;
  }
}

/**
 * Find a password using a partial account name search
 * Note: This searches for passwords stored under the service name
 *
 * @param options - Keychain options
 * @returns Result containing the password if found
 */
export async function findPassword(
  options: KeychainOptions = {}
): Promise<KeychainResult<string>> {
  const keytar = await getKeytar();
  if (!keytar) {
    return { success: false, error: KEYTAR_NOT_AVAILABLE_ERROR };
  }

  const service = options.service || DEFAULT_SERVICE_NAME;

  try {
    const password = await keytar.findPassword(service);

    if (password === null) {
      return {
        success: false,
        error: `No passwords found for service '${service}'`,
      };
    }

    return { success: true, data: password };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to find password in keychain: ${message}`,
    };
  }
}

/**
 * List all stored credentials for the service
 *
 * @param options - Keychain options
 * @returns Result containing array of stored credentials
 */
export async function listCredentials(
  options: KeychainOptions = {}
): Promise<KeychainResult<StoredCredential[]>> {
  const keytar = await getKeytar();
  if (!keytar) {
    return { success: false, error: KEYTAR_NOT_AVAILABLE_ERROR };
  }

  const service = options.service || DEFAULT_SERVICE_NAME;

  try {
    const credentials = await keytar.findCredentials(service);

    return {
      success: true,
      data: credentials.map((cred) => ({
        account: cred.account,
        password: cred.password,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to list credentials from keychain: ${message}`,
    };
  }
}

/**
 * Test if the keychain is available and working
 *
 * @returns True if keychain operations are available
 */
export async function isKeychainAvailable(): Promise<boolean> {
  const keytar = await getKeytar();
  if (!keytar) {
    return false;
  }

  const testAccount = '__devtoolbox_keychain_test__';
  const testPassword = 'test';
  const service = DEFAULT_SERVICE_NAME;

  try {
    // Try to set and delete a test password
    await keytar.setPassword(service, testAccount, testPassword);
    await keytar.deletePassword(service, testAccount);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a keychain account name for encryption operations
 *
 * @param identifier - A unique identifier (e.g., file path or custom name)
 * @param prefix - Optional prefix for the account name
 * @returns A normalized account name safe for keychain storage
 */
export function generateAccountName(
  identifier: string,
  prefix: string = 'encrypt'
): string {
  // Normalize the identifier to create a safe account name
  const normalized = identifier
    .replace(/[\\\/]/g, '_') // Replace path separators
    .replace(/[^a-zA-Z0-9_.-]/g, '') // Remove special characters
    .substring(0, 100); // Limit length

  return `${prefix}:${normalized}`;
}

/**
 * Get password for encryption operations - first checks keychain, then prompts if not found
 *
 * @param accountName - The keychain account name
 * @param promptFn - Function to prompt for password if not in keychain
 * @param options - Keychain options
 * @returns The password (either from keychain or prompt)
 */
export async function getPasswordWithFallback(
  accountName: string,
  promptFn: () => Promise<string>,
  options: KeychainOptions = {}
): Promise<{ password: string; fromKeychain: boolean }> {
  // Try to get from keychain first
  const keychainResult = await retrievePassword(accountName, options);

  if (keychainResult.success && keychainResult.data) {
    return { password: keychainResult.data, fromKeychain: true };
  }

  // Fall back to prompting
  const password = await promptFn();
  return { password, fromKeychain: false };
}
