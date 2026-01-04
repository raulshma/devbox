/**
 * Interactive Command Builder (React Ink Version)
 *
 * Modern terminal UI for building CLI commands interactively
 */

import React, { useState, useMemo, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { Command, Option } from 'commander';

// Types
interface OptionMeta {
  flags: string;
  description: string;
  shortFlag?: string;
  longFlag: string;
  required: boolean;
  optional: boolean;
  variadic: boolean;
  mandatory: boolean;
  negate: boolean;
  defaultValue?: any;
  argChoices?: string[];
  isBoolean: boolean;
  argName?: string;
}

interface InteractiveResult {
  execute: boolean;
  options: Record<string, any>;
  commandString: string;
}

// Extract option metadata from Commander Option
function extractOptionMeta(opt: Option): OptionMeta {
  const flags = opt.flags;
  const shortMatch = flags.match(/^-([a-zA-Z]),?\s/);
  const longMatch = flags.match(/--([a-zA-Z0-9-]+)/);
  const argMatch = flags.match(/<([^>]+)>|(\[([^\]]+)\])/);

  return {
    flags: opt.flags,
    description: opt.description || '',
    shortFlag: shortMatch ? shortMatch[1] : undefined,
    longFlag: longMatch ? longMatch[1] : '',
    required: flags.includes('<') && !flags.includes('['),
    optional: flags.includes('['),
    variadic: flags.includes('...'),
    mandatory: opt.mandatory || false,
    negate: opt.negate || false,
    defaultValue: opt.defaultValue,
    argChoices: opt.argChoices,
    isBoolean: !argMatch,
    argName: argMatch ? (argMatch[1] || argMatch[3]) : undefined,
  };
}

// Get all options from a command
function getCommandOptions(command: Command): OptionMeta[] {
  const cmdOptions = (command as any).options as Option[];
  if (!cmdOptions || !Array.isArray(cmdOptions)) return [];

  return cmdOptions
    .filter(opt => !opt.flags.includes('--i') && !opt.flags.includes('--interactive'))
    .map(extractOptionMeta);
}

// Categorize options
function categorizeOptions(options: OptionMeta[]): Map<string, OptionMeta[]> {
  const categories = new Map<string, OptionMeta[]>();
  const patterns: [string, RegExp][] = [
    ['📁 Input/Output', /file|directory|path|output|input/i],
    ['⚡ Processing', /parallel|worker|batch|stream|chunk|threshold|timeout/i],
    ['🔍 Filtering', /filter|pattern|include|exclude|min|max|newer|older|depth/i],
    ['🔐 Security', /password|encrypt|decrypt|key|secret|keychain|auth/i],
    ['⚙️ Behavior', /dry-run|backup|recursive|force|verbose|quiet|yes|no/i],
    ['🎨 Display', /format|color|theme|style|json|table/i],
  ];

  for (const opt of options) {
    let assigned = false;
    const searchText = `${opt.longFlag} ${opt.description}`;

    for (const [label, pattern] of patterns) {
      if (pattern.test(searchText)) {
        if (!categories.has(label)) categories.set(label, []);
        categories.get(label)!.push(opt);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      if (!categories.has('📦 General')) categories.set('📦 General', []);
      categories.get('📦 General')!.push(opt);
    }
  }

  return categories;
}

// Build command string
function buildCommandString(commandName: string, selections: Map<string, any>): string {
  const parts = ['dtb', commandName];

  for (const [flag, value] of selections) {
    if (value === undefined || value === null || value === false) continue;

    if (value === true) {
      parts.push(`--${flag}`);
    } else if (Array.isArray(value)) {
      for (const v of value) parts.push(`--${flag}`, `"${v}"`);
    } else if (typeof value === 'string' && value.includes(' ')) {
      parts.push(`--${flag}`, `"${value}"`);
    } else {
      parts.push(`--${flag}`, String(value));
    }
  }

  return parts.join(' ');
}

// Get icon for option type
function getOptionIcon(opt: OptionMeta): string {
  if (opt.isBoolean) return '◯';
  if (opt.argChoices) return '◆';
  if (opt.longFlag.includes('password') || opt.longFlag.includes('secret')) return '🔒';
  if (opt.longFlag.includes('path') || opt.longFlag.includes('directory')) return '📁';
  if (opt.longFlag.includes('parallel') || opt.longFlag.includes('workers')) return '⚡';
  return '◇';
}

// Command Preview Component
const CommandPreview: React.FC<{ command: string }> = ({ command }) => (
  <Box borderStyle="round" borderColor="cyan" paddingX={2} marginY={1}>
    <Text color="gray">$ </Text>
    <Text color="white">{command}</Text>
  </Box>
);

// Footer Component
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

// Main Builder Component
interface BuilderProps {
  command: Command;
  onComplete: (result: InteractiveResult) => void;
}

const InkCommandBuilder: React.FC<BuilderProps> = ({ command, onComplete }) => {
  const { exit } = useApp();
  const commandName = command.name();
  const commandDescription = command.description();
  const options = useMemo(() => getCommandOptions(command), [command]);
  const categorizedOptions = useMemo(() => categorizeOptions(options), [options]);

  const [screen, setScreen] = useState<'options' | 'input' | 'choices' | 'confirm'>('options');
  const [selections, setSelections] = useState<Map<string, any>>(new Map());
  const [currentOption, setCurrentOption] = useState<OptionMeta | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isPassword, setIsPassword] = useState(false);

  // Build menu items
  const menuItems = useMemo(() => {
    const items: Array<{ label: string; value: any }> = [];

    for (const [category, categoryOptions] of categorizedOptions) {
      items.push({
        label: `─── ${category} ${'─'.repeat(Math.max(0, 32 - category.length))}`,
        value: '__category',
      });

      for (const opt of categoryOptions) {
        const currentValue = selections.get(opt.longFlag);
        const hasValue = currentValue !== undefined && currentValue !== null && currentValue !== false;
        const icon = getOptionIcon(opt);

        let valueDisplay = '';
        if (hasValue) {
          const displayVal = typeof currentValue === 'string' && currentValue.length > 15
            ? currentValue.substring(0, 12) + '...'
            : currentValue;
          valueDisplay = ` = ${JSON.stringify(displayVal)}`;
        } else if (opt.defaultValue !== undefined) {
          valueDisplay = ` [${opt.defaultValue}]`;
        }

        items.push({
          label: `  ${hasValue ? '●' : '○'} ${icon} --${opt.longFlag.padEnd(16)}${valueDisplay}`,
          value: { type: 'option', option: opt },
        });
      }
    }

    items.push({ label: '─'.repeat(50), value: '__separator' });

    const configuredCount = Array.from(selections.values()).filter(v => 
      v !== undefined && v !== null && v !== false
    ).length;

    items.push({ label: `  ▶  Execute command (${configuredCount} options set)`, value: { type: 'execute' } });
    items.push({ label: `  👁  Preview command`, value: { type: 'preview' } });
    items.push({ label: `  🔄 Reset all options`, value: { type: 'reset' } });
    items.push({ label: `  ✖  Cancel`, value: { type: 'cancel' } });

    return items;
  }, [categorizedOptions, selections]);

  const handleSelect = useCallback((item: { label: string; value: any }) => {
    if (typeof item.value === 'string') return;

    const action = item.value;

    if (action.type === 'option') {
      const opt = action.option as OptionMeta;
      setCurrentOption(opt);

      if (opt.argChoices && opt.argChoices.length > 0) {
        setScreen('choices');
      } else if (opt.isBoolean) {
        const current = selections.get(opt.longFlag);
        const newSelections = new Map(selections);
        newSelections.set(opt.longFlag, !current);
        setSelections(newSelections);
      } else {
        setIsPassword(opt.longFlag.includes('password') || opt.longFlag.includes('secret'));
        setInputValue(selections.get(opt.longFlag)?.toString() || '');
        setScreen('input');
      }
    } else if (action.type === 'execute') {
      setScreen('confirm');
    } else if (action.type === 'reset') {
      setSelections(new Map());
    } else if (action.type === 'cancel') {
      onComplete({ execute: false, options: {}, commandString: '' });
    }
  }, [selections, onComplete]);

  const handleInputSubmit = useCallback(() => {
    if (currentOption) {
      const newSelections = new Map(selections);

      if (inputValue.trim()) {
        const isNumber = currentOption.argName?.includes('number') ||
          currentOption.longFlag.includes('parallel') ||
          currentOption.longFlag.includes('workers') ||
          currentOption.longFlag.includes('depth') ||
          currentOption.longFlag.includes('port') ||
          currentOption.longFlag.includes('timeout');

        newSelections.set(currentOption.longFlag, isNumber ? Number(inputValue) : inputValue);
      } else {
        newSelections.delete(currentOption.longFlag);
      }

      setSelections(newSelections);
    }
    setScreen('options');
    setCurrentOption(null);
    setInputValue('');
  }, [currentOption, inputValue, selections]);

  const handleChoiceSelect = useCallback((item: { label: string; value: string | null }) => {
    if (currentOption) {
      const newSelections = new Map(selections);
      if (item.value) {
        newSelections.set(currentOption.longFlag, item.value);
      } else {
        newSelections.delete(currentOption.longFlag);
      }
      setSelections(newSelections);
    }
    setScreen('options');
    setCurrentOption(null);
  }, [currentOption, selections]);

  const handleConfirm = useCallback((confirmed: boolean) => {
    if (confirmed) {
      const optionsObj: Record<string, any> = {};
      for (const [key, value] of selections) {
        const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        optionsObj[camelKey] = value;
      }
      onComplete({
        execute: true,
        options: optionsObj,
        commandString: buildCommandString(commandName, selections),
      });
    } else {
      setScreen('options');
    }
  }, [selections, commandName, onComplete]);

  // Keyboard shortcuts
  useInput((input, key) => {
    if (screen === 'options' && input === 'q') {
      onComplete({ execute: false, options: {}, commandString: '' });
    }
    if ((screen === 'input' || screen === 'choices') && key.escape) {
      setScreen('options');
      setCurrentOption(null);
      setInputValue('');
    }
    if (screen === 'confirm') {
      if (input === 'y' || input === 'Y') handleConfirm(true);
      else if (input === 'n' || input === 'N' || key.escape) handleConfirm(false);
    }
  });

  const commandString = buildCommandString(commandName, selections);

  // Item component
  const ItemComponent: React.FC<{ isSelected?: boolean; label: string }> = ({ isSelected = false, label }) => {
    const isCategory = label.startsWith('───');
    const isSeparator = label === '─'.repeat(50);
    const isAction = label.startsWith('  ▶') || label.startsWith('  👁') || label.startsWith('  🔄') || label.startsWith('  ✖');
    const hasValue = label.includes('●');

    if (isSeparator) return <Text color="gray">{label}</Text>;
    if (isCategory) return <Text bold color="white">{label}</Text>;

    if (isAction) {
      const isExecute = label.includes('Execute');
      const isCancel = label.includes('Cancel');
      return (
        <Text color={isSelected ? (isExecute ? 'green' : isCancel ? 'red' : 'cyan') : 'gray'}>
          {isSelected ? '▸' : ' '}{label}
        </Text>
      );
    }

    return (
      <Text color={isSelected ? 'cyan' : hasValue ? 'green' : 'white'}>
        {isSelected ? '▸' : ' '}{label}
      </Text>
    );
  };

  // Input screen
  if (screen === 'input' && currentOption) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">⚡ Interactive: {commandName}</Text>
        </Box>

        <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
          <Text bold color="white">📝 Configure --{currentOption.longFlag}</Text>
          <Text color="gray">{currentOption.description || 'No description'}</Text>
          <Box marginTop={1}>
            <Text color="cyan">{'>'} </Text>
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleInputSubmit}
              mask={isPassword ? '*' : undefined}
              placeholder={currentOption.defaultValue?.toString() || 'Enter value...'}
            />
          </Box>
        </Box>

        <Footer hints={[
          { key: 'Enter', action: 'Confirm' },
          { key: 'Esc', action: 'Cancel' },
        ]} />
      </Box>
    );
  }

  // Choices screen
  if (screen === 'choices' && currentOption) {
    const choiceItems = [
      ...(currentOption.argChoices || []).map(c => ({
        label: selections.get(currentOption.longFlag) === c ? `● ${c}` : `  ${c}`,
        value: c,
      })),
      { label: '  (clear value)', value: null as string | null },
    ];

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">⚡ Interactive: {commandName}</Text>
        </Box>

        <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
          <Text bold color="white">◆ Select --{currentOption.longFlag}</Text>
          <Text color="gray">{currentOption.description || 'No description'}</Text>
          <Box marginTop={1}>
            <SelectInput items={choiceItems} onSelect={handleChoiceSelect} />
          </Box>
        </Box>

        <Footer hints={[
          { key: '↑↓', action: 'Navigate' },
          { key: 'Enter', action: 'Select' },
          { key: 'Esc', action: 'Cancel' },
        ]} />
      </Box>
    );
  }

  // Confirm screen
  if (screen === 'confirm') {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">⚡ Interactive: {commandName}</Text>
        </Box>

        <CommandPreview command={commandString} />

        <Box marginY={1}>
          <Text bold color="yellow">Execute this command? </Text>
          <Text color="gray">(y/n)</Text>
        </Box>

        <Footer hints={[
          { key: 'Y', action: 'Execute' },
          { key: 'N', action: 'Cancel' },
        ]} />
      </Box>
    );
  }

  // Main options screen
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">⚡ Interactive: {commandName}</Text>
        {commandDescription && <Text color="gray"> - {commandDescription}</Text>}
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">💡 Select options to configure, then execute when ready</Text>
      </Box>

      <CommandPreview command={commandString} />

      <SelectInput
        items={menuItems}
        onSelect={handleSelect}
        itemComponent={ItemComponent}
        limit={18}
      />

      <Footer hints={[
        { key: '↑↓', action: 'Navigate' },
        { key: 'Enter', action: 'Select/Toggle' },
        { key: 'q', action: 'Quit' },
      ]} />
    </Box>
  );
};

/**
 * Run the Ink-based interactive builder
 */
export async function runInkInteractiveBuilder(command: Command): Promise<InteractiveResult> {
  // Clear console before rendering
  console.clear();
  
  return new Promise((resolve) => {
    let resolved = false;
    
    const handleComplete = (result: InteractiveResult) => {
      if (!resolved) {
        resolved = true;
        clear();
        resolve(result);
      }
    };
    
    const { waitUntilExit, clear } = render(
      <InkCommandBuilder
        command={command}
        onComplete={handleComplete}
      />,
      { exitOnCtrlC: false }
    );
    
    // Fallback: resolve on exit if not already resolved
    waitUntilExit().then(() => {
      if (!resolved) {
        resolved = true;
        clear();
        resolve({ execute: false, options: {}, commandString: '' });
      }
    });
  });
}

/**
 * Check if interactive mode is requested
 */
export function isInteractiveMode(args: string[]): boolean {
  return args.includes('-i') || args.includes('--interactive');
}

/**
 * Remove interactive flag from args
 */
export function removeInteractiveFlag(args: string[]): string[] {
  return args.filter(arg => arg !== '-i' && arg !== '--interactive');
}

/**
 * Add interactive mode support to a command (Ink version)
 */
export function withInkInteractiveMode(command: Command): Command {
  command.option('-i, --interactive', 'Run in interactive mode with modern UI');

  const originalAction = (command as any)._actionHandler;

  if (!originalAction) {
    return command;
  }

  command.action(async (...args: any[]) => {
    const cmdInstance = args[args.length - 1] as Command;
    const options = args[args.length - 2] as Record<string, any>;

    if (options.interactive || options.i) {
      const result = await runInkInteractiveBuilder(command);

      if (!result.execute) {
        return;
      }

      console.log();

      const mergedOptions = { ...options, ...result.options };
      delete mergedOptions.interactive;
      delete mergedOptions.i;

      const newArgs = [...args.slice(0, -2), mergedOptions, cmdInstance];
      return originalAction.apply(command, newArgs);
    }

    return originalAction.apply(command, args);
  });

  return command;
}
