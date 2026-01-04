/**
 * Interactive Mode Command (React Ink Version)
 *
 * Provides a modern, React-based terminal UI using Ink
 * for a better interactive experience
 */

import { Command } from 'commander';
import React from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import { runInkInteractiveBuilder } from '../utils/interactiveBuilderInk.js';

// Import all commands
import { renameCommand } from './rename.js';
import { regexBuilderCommand } from './regex-builder.js';
import { encryptCommand } from './encrypt.js';
import { decryptCommand } from './decrypt.js';
import { fileOpsCommand } from './fileops.js';
import { cleanupNodeCommand } from './cleanup-node.js';
import { cleanupDotnetCommand } from './cleanup-dotnet.js';
import { discoverCommand } from './discover.js';
import { sessionsCommand } from './sessions.js';
import { keychainCommand } from './keychain.js';

// Command registry - maps menu values to actual Command objects
const COMMAND_REGISTRY: Record<string, Command> = {
  'fileops': fileOpsCommand,
  'rename': renameCommand,
  'encrypt': encryptCommand,
  'decrypt': decryptCommand,
  'keychain': keychainCommand,
  'cleanup-node': cleanupNodeCommand,
  'cleanup-dotnet': cleanupDotnetCommand,
  'regex-builder': regexBuilderCommand,
  'discover': discoverCommand,
  'sessions': sessionsCommand,
};

// Menu categories
const MENU_CATEGORIES = {
  files: { icon: '📁', label: 'File Operations' },
  transform: { icon: '🔄', label: 'Transform & Rename' },
  security: { icon: '🔐', label: 'Security' },
  cleanup: { icon: '🧹', label: 'Cleanup' },
  tools: { icon: '🛠️', label: 'Developer Tools' },
  data: { icon: '💾', label: 'Data & State' },
};

// Menu items
const MENU_ITEMS = [
  { category: 'files', value: 'fileops', icon: '📄', label: 'File Operations', desc: 'Copy, move, delete files' },
  { category: 'transform', value: 'rename', icon: '✏️', label: 'Rename Files', desc: 'Batch rename with patterns' },
  { category: 'security', value: 'encrypt', icon: '🔒', label: 'Encrypt', desc: 'Encrypt files and directories' },
  { category: 'security', value: 'decrypt', icon: '🔓', label: 'Decrypt', desc: 'Decrypt encrypted files' },
  { category: 'security', value: 'keychain', icon: '🔑', label: 'Keychain', desc: 'Manage secure credentials' },
  { category: 'cleanup', value: 'cleanup-node', icon: '📦', label: 'Node.js Cleanup', desc: 'Remove node_modules, caches' },
  { category: 'cleanup', value: 'cleanup-dotnet', icon: '🔷', label: '.NET Cleanup', desc: 'Remove bin, obj folders' },
  { category: 'tools', value: 'regex-builder', icon: '🔧', label: 'Regex Builder', desc: 'Build and test regex patterns' },
  { category: 'tools', value: 'discover', icon: '🔍', label: 'Discover Files', desc: 'Find files by pattern' },
  { category: 'data', value: 'sessions', icon: '📋', label: 'Sessions', desc: 'Manage work sessions' },
];

// Banner component
const Banner: React.FC = () => (
  <Box flexDirection="column" marginBottom={1}>
    <Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Box flexDirection="column" alignItems="center">
        <Text bold color="cyan">⚡ Developer Toolbox</Text>
        <Text color="gray">Your CLI companion for dev workflows</Text>
      </Box>
    </Box>
  </Box>
);

// Footer with key hints
const Footer: React.FC<{ hints: Array<{ key: string; action: string }> }> = ({ hints }) => (
  <Box marginTop={1} flexDirection="row" flexWrap="wrap">
    {hints.map((hint, i) => (
      <Box key={i} marginRight={2}>
        <Text backgroundColor="gray" color="black"> {hint.key} </Text>
        <Text color="gray"> {hint.action}</Text>
      </Box>
    ))}
  </Box>
);

// Main menu component
interface MainMenuProps {
  onSelect: (cmd: string) => void;
  onExit: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onSelect, onExit }) => {
  const { exit } = useApp();

  // Build menu items
  const items: Array<{ label: string; value: string }> = React.useMemo(() => {
    const result: Array<{ label: string; value: string }> = [];
    const categories = new Map<string, typeof MENU_ITEMS>();

    for (const item of MENU_ITEMS) {
      if (!categories.has(item.category)) {
        categories.set(item.category, []);
      }
      categories.get(item.category)!.push(item);
    }

    for (const [categoryKey, categoryItems] of categories) {
      const category = MENU_CATEGORIES[categoryKey as keyof typeof MENU_CATEGORIES];
      result.push({
        label: `─── ${category.icon} ${category.label} ${'─'.repeat(Math.max(0, 28 - category.label.length))}`,
        value: `__cat_${categoryKey}`,
      });

      for (const item of categoryItems) {
        result.push({
          label: `  ${item.icon}  ${item.label.padEnd(18)} ${item.desc}`,
          value: item.value,
        });
      }
    }

    result.push({ label: '─'.repeat(48), value: '__sep' });
    result.push({ label: `  ✖  Exit`, value: 'exit' });
    
    return result;
  }, []);

  const handleSelect = React.useCallback((item: { label: string; value: string }) => {
    if (item.value.startsWith('__')) return;
    if (item.value === 'exit') {
      onExit();
      exit();
      return;
    }
    onSelect(item.value);
    exit();
  }, [onSelect, onExit, exit]);

  useInput((input) => {
    if (input === 'q') {
      onExit();
      exit();
    }
  });

  const ItemComponent = React.useCallback(({ isSelected = false, label }: { isSelected?: boolean; label: string }) => {
    const isCategory = label.startsWith('───');
    const isSeparator = label === '─'.repeat(48);
    const isExit = label.includes('Exit');

    if (isSeparator) return <Text color="gray">{label}</Text>;
    if (isCategory) return <Text bold color="white">{label}</Text>;
    if (isExit) return <Text color={isSelected ? 'red' : 'gray'}>{isSelected ? '▸' : ' '}{label}</Text>;

    return (
      <Text color={isSelected ? 'cyan' : 'white'}>
        {isSelected ? '▸' : ' '}{label}
      </Text>
    );
  }, []);

  return (
    <Box flexDirection="column">
      <Banner />
      
      <Box marginBottom={1}>
        <Text color="gray">💡 Use arrow keys to navigate, Enter to select</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="gray">💡 Add -i to any command for interactive mode (e.g., dtb encrypt -i)</Text>
      </Box>

      <SelectInput
        items={items}
        onSelect={handleSelect}
        itemComponent={ItemComponent}
        limit={20}
      />

      <Footer hints={[
        { key: '↑↓', action: 'Navigate' },
        { key: 'Enter', action: 'Select' },
        { key: 'q', action: 'Quit' },
      ]} />
    </Box>
  );
};

// Exit message component
const ExitMessage: React.FC = () => (
  <Box flexDirection="column" marginY={1}>
    <Box borderStyle="round" borderColor="green" paddingX={2} paddingY={1}>
      <Box flexDirection="column">
        <Text color="green">✓ Thanks for using Developer Toolbox!</Text>
        <Text color="gray">Run dtb --help for more commands</Text>
      </Box>
    </Box>
  </Box>
);

// Show menu and return selection
function showMenu(): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    
    const handleSelect = (cmd: string) => {
      if (!resolved) {
        resolved = true;
        setTimeout(() => resolve(cmd), 10);
      }
    };

    const handleExit = () => {
      if (!resolved) {
        resolved = true;
        setTimeout(() => resolve(null), 10);
      }
    };

    const { waitUntilExit, clear } = render(
      <MainMenu onSelect={handleSelect} onExit={handleExit} />,
      { exitOnCtrlC: false }
    );
    
    waitUntilExit().then(() => {
      clear();
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });
  });
}

// Wait for Enter key
function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    console.log('\nPress Enter to return to menu...');
    
    const cleanup = () => {
      process.stdin.removeListener('data', handler);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode?.(false);
      }
    };
    
    const handler = (data: Buffer) => {
      const str = data.toString();
      if (str.includes('\n') || str.includes('\r') || str === ' ') {
        cleanup();
        resolve();
      }
    };
    
    if (process.stdin.isTTY) {
      process.stdin.setRawMode?.(true);
    }
    process.stdin.resume();
    process.stdin.on('data', handler);
  });
}

// Main interactive loop
async function runInteractiveLoop(): Promise<void> {
  let running = true;

  while (running) {
    // Clear screen and show menu
    console.clear();
    const selection = await showMenu();
    
    if (selection === null) {
      // Exit - show goodbye message
      console.clear();
      const { waitUntilExit, clear } = render(<ExitMessage />);
      await new Promise(resolve => setTimeout(resolve, 100));
      clear();
      running = false;
      break;
    }

    // Get command from registry
    const command = COMMAND_REGISTRY[selection];
    if (!command) {
      console.log(`\nCommand '${selection}' not available.\n`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }

    // Run the interactive builder for the selected command
    const result = await runInkInteractiveBuilder(command);

    if (result.execute) {
      console.log('\n');
      
      try {
        const actionHandler = (command as any)._actionHandler;
        if (actionHandler) {
          await actionHandler.call(command, result.options, command);
        }
      } catch (error) {
        console.error('Error executing command:', error);
      }

      // Wait for user input before returning to menu
      await waitForEnter();
    }
  }
}

export const interactiveInkCommand = new Command('interactive')
  .description('Launch interactive mode with modern UI (React Ink)')
  .alias('menu')
  .action(async () => {
    await runInteractiveLoop();
  });

export { runInteractiveLoop as runInkInteractive };
