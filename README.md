# DevBox CLI

A comprehensive file and code management CLI tool for developers with a modern, interactive terminal UI powered by React Ink.

## Features

- 🎨 **Modern Interactive UI** - Built with React Ink for a responsive, keyboard-driven experience
- 🔧 **Powerful File Operations** - Rename, encrypt, decrypt, copy, move, and delete files with advanced patterns
- 🔍 **Smart File Discovery** - Find files with glob patterns and filtering
- 🧹 **Project Cleanup** - Intelligently clean up node_modules, .NET artifacts, and more
- 🔐 **Security** - AES-256-GCM encryption, keychain integration, and secure credential management
- 📊 **Session Management** - Track and manage work sessions with SQLite storage
- 🔌 **Plugin System** - Extend functionality with custom plugins
- 🎯 **Interactive Mode** - Build commands step-by-step with real-time preview
- 📝 **Audit Logging** - Track all operations with comprehensive audit logs

## Installation

```bash
# Global installation
npm install -g @sckrz/devbox

# Or use directly with npx
npx @sckrz/devbox --help

# Or with pnpx
pnpx @sckrz/devbox --help
```

## Quick Start

```bash
# Launch interactive menu
dtb interactive

# Or use interactive mode with any command
dtb encrypt -i
dtb rename -i
dtb fileops -i

# Using the primary command
devbox --help

# Using aliases
devtoolbox --help
dtb --help
```

## Available Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `interactive` | `menu` | 🎨 Launch interactive menu with modern React Ink UI |
| `rename` | `rn` | Advanced file and folder renaming with pattern matching |
| `regex-builder` | `rb` | Interactive regex pattern builder |
| `encrypt` | `enc` | Encrypt files with AES-256-GCM encryption |
| `decrypt` | `dec` | Decrypt encrypted files |
| `fileops` | `fo` | Advanced file operations (copy, move, delete) |
| `cleanup:node` | `cn` | Clean up node_modules directories |
| `cleanup:dotnet` | `cdn` | Clean up .NET bin and obj directories |
| `discover` | `find` | Fast file discovery with pattern matching |
| `state` | `st` | Manage global application state |
| `sessions` | `sess` | Manage sessions and operation history |
| `audit` | `log` | Manage and view audit logs |
| `keychain` | `kc` | Manage passwords in OS keychain |
| `auth` | `authenticate` | Manage authentication and sessions |
| `theme` | `th` | Manage color themes |
| `tools` | `tool` | Manage tool registry |
| `plugin` | `pl` | Manage plugins |
| `api` | `serve` | Start the REST API server |
| `azure-blob` | `azblob` | Azure Blob Storage operations |

## Interactive Mode

DevBox features a modern, keyboard-driven interactive UI built with React Ink. Use it to build commands step-by-step with real-time preview.

### Launch Interactive Menu
```bash
dtb interactive
# or
dtb menu
```

### Interactive Command Builder
Add `-i` or `--interactive` to any command:
```bash
dtb encrypt -i
dtb rename -i
dtb fileops -i
dtb cleanup:node -i
```

### Features
- 🎯 **Categorized Options** - Options organized by type (Input/Output, Processing, Security, etc.)
- 👁️ **Real-time Preview** - See the full command as you configure it
- ⌨️ **Keyboard Navigation** - Use arrow keys to navigate, Enter to select
- 🔒 **Password Masking** - Sensitive inputs are masked
- ✅ **Smart Validation** - Number fields, paths, and choices are validated
- 🔄 **Easy Reset** - Clear all options and start over

### Keyboard Shortcuts
- `↑↓` - Navigate through options
- `Enter` - Select/toggle option
- `q` - Quit interactive mode
- `Esc` - Cancel current input
- `y/n` - Confirm/cancel execution

## Examples

```bash
# Interactive menu - browse and select commands
dtb interactive

# Interactive encryption
dtb encrypt -i
# Configure: directory, password, algorithm, etc.
# Preview the command
# Execute when ready

# Interactive file operations
dtb fileops -i

# Interactive cleanup
dtb cleanup:node -i

# Traditional command-line usage still works
dtb rename --pattern "*.txt" --replacement "backup_$1"
dtb discover "**/*.js"
dtb cleanup:node --dry-run

# Manage plugins
dtb plugin list
dtb plugin install ./plugins/my-plugin
```

## Programmatic Usage

```typescript
import { ConfigManager, logger, discoverFiles } from '@sckrz/devbox';

// Use the exported utilities in your own scripts
const files = await discoverFiles('.', ['**/*.ts']);
```

## Documentation

- [Interactive Mode](docs/INTERACTIVE_MODE.md) - Detailed guide for the modern React Ink UI
- [Plugin System](docs/PLUGIN_SYSTEM.md) - Extend DevBox with custom plugins
- [Theme System](docs/THEME_SYSTEM.md) - Customize CLI colors and appearance
- [Help System](docs/HELP_SYSTEM.md) - Built-in help and documentation
- [Regex Builder](docs/regex-builder-feature.md) - Interactive regex pattern builder
- [Table Usage](docs/TABLE_USAGE_EXAMPLES.md) - Table formatting utilities
- [Plugin API](docs/api-plugin-manager.md) - Plugin development API reference

## Requirements

- Node.js >= 18.0.0

## License

MIT
