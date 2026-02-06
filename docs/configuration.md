# Configuration Guide

DesignForge can be configured using a configuration file, environment variables, or CLI options.

## Configuration File

Create `designforge.config.js` in your project root:

```javascript
export default {
  // MCP Servers
  mcpServers: {
    figma: {
      path: './mcp/figma-server',
      enabled: true,
      timeout: 30000
    },
    designSystem: {
      path: './mcp/design-system-server',
      enabled: true,
      timeout: 30000
    }
  },

  // Code Generation
  codegen: {
    language: 'typescript',
    framework: 'react',
    designSystem: '@dtsl/react',
    testFramework: 'jest',
    minCoverage: 80,
    generateStorybook: true,
    generateTests: true
  },

  // Agent Behavior
  agent: {
    model: 'claude-sonnet-4-20250514',
    maxTurns: 30,
    systemPrompt: './prompts/system.md',
    temperature: 0.7
  },

  // Validation
  validation: {
    designParity: {
      enabled: true,
      minScore: 95
    },
    accessibility: {
      enabled: true,
      level: 'AA'
    },
    typeChecking: true,
    linting: true
  },

  // Output
  output: {
    baseDir: './src/components',
    structure: 'feature', // 'feature' | 'atomic'
    naming: 'kebab-case', // 'kebab-case' | 'PascalCase'
    cleanBefore: false
  },

  // Hooks
  hooks: {
    beforeGenerate: './hooks/before-generate.js',
    afterGenerate: './hooks/after-generate.js',
    onError: './hooks/on-error.js'
  }
};
```

## Environment Variables

Configure via `.env` file:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# MCP Servers
FIGMA_MCP_PATH=/path/to/figma-mcp
DESIGN_SYSTEM_MCP_PATH=/path/to/design-system-mcp

# Optional
CLAUDE_MODEL=claude-sonnet-4-20250514
MAX_TURNS=30
MIN_COVERAGE=80
VERBOSE=false
PROJECT_ROOT=/path/to/project
```

## CLI Options

Override configuration via CLI:

```bash
designforge start \
  --figma <url> \
  --output <path> \
  --coverage <number> \
  --max-turns <number> \
  --verbose \
  --dry-run \
  --validate \
  --storybook
```

### CLI Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--figma` | string | required | Figma file URL |
| `--output` | string | required | Output directory path |
| `--coverage` | number | 80 | Minimum test coverage |
| `--max-turns` | number | 30 | Maximum AI turns |
| `--verbose` | boolean | false | Detailed logging |
| `--dry-run` | boolean | false | Preview without writing |
| `--validate` | boolean | false | Validate after generation |
| `--storybook` | boolean | true | Generate Storybook stories |

## MCP Server Configuration

### Figma MCP Server

```javascript
{
  figma: {
    path: './mcp/figma-server',
    enabled: true,
    config: {
      accessToken: process.env.FIGMA_ACCESS_TOKEN,
      timeout: 30000,
      retries: 3
    }
  }
}
```

### Design System MCP Server

```javascript
{
  designSystem: {
    path: './mcp/design-system-server',
    enabled: true,
    config: {
      packageName: '@dtsl/react',
      documentsPath: './docs/components',
      timeout: 30000
    }
  }
}
```

## Agent Configuration

### Model Selection

```javascript
{
  agent: {
    model: 'claude-sonnet-4-20250514', // or 'claude-opus-4-20250514'
    maxTurns: 30,
    temperature: 0.7
  }
}
```

### Custom System Prompt

Create a custom prompt file:

```markdown
<!-- prompts/custom-system.md -->
You are DesignForge, specialized for our company.

Additional rules:
- Use our custom hooks pattern
- Follow our naming conventions
- Add our copyright header
```

Reference it in config:

```javascript
{
  agent: {
    systemPrompt: './prompts/custom-system.md'
  }
}
```

## Validation Configuration

### Design Parity

```javascript
{
  validation: {
    designParity: {
      enabled: true,
      minScore: 95,
      compareColors: true,
      compareSpacing: true,
      compareTypography: true
    }
  }
}
```

### Accessibility

```javascript
{
  validation: {
    accessibility: {
      enabled: true,
      level: 'AA', // 'A' | 'AA' | 'AAA'
      checkContrast: true,
      checkKeyboard: true,
      checkAria: true
    }
  }
}
```

## Output Configuration

### Directory Structure

**Feature-based** (default):
```
src/components/
├── UserSettings/
│   ├── UserSettings.tsx
│   ├── components/
│   │   ├── ProfileSection.tsx
│   │   └── SecuritySettings.tsx
│   └── hooks/
│       └── useUserSettings.ts
```

**Atomic Design**:
```
src/components/
├── atoms/
│   ├── Button.tsx
│   └── Input.tsx
├── molecules/
│   └── FormField.tsx
└── organisms/
    └── UserSettings.tsx
```

Configure:

```javascript
{
  output: {
    structure: 'feature' // or 'atomic'
  }
}
```

### Naming Conventions

```javascript
{
  output: {
    naming: 'kebab-case' // or 'PascalCase' or 'camelCase'
  }
}
```

## Hooks

### Before Generate Hook

```javascript
// hooks/before-generate.js
export default async function beforeGenerate(context) {
  console.log('Starting generation for:', context.figmaUrl);

  // Custom validation
  if (!context.figmaUrl.includes('approved')) {
    throw new Error('Only approved designs allowed');
  }
}
```

### After Generate Hook

```javascript
// hooks/after-generate.js
import { execSync } from 'child_process';

export default async function afterGenerate(files) {
  console.log('Generated files:', files);

  // Run prettier
  execSync('prettier --write ' + files.join(' '));

  // Run linter
  execSync('eslint --fix ' + files.join(' '));

  // Commit to git
  execSync('git add ' + files.join(' '));
}
```

### Error Hook

```javascript
// hooks/on-error.js
export default async function onError(error) {
  console.error('DesignForge error:', error);

  // Send to Slack
  await fetch('https://hooks.slack.com/...', {
    method: 'POST',
    body: JSON.stringify({ text: `DesignForge error: ${error.message}` })
  });
}
```

## Priority Order

Configuration is loaded in this order (later overrides earlier):

1. `designforge.config.js`
2. Environment variables (`.env`)
3. CLI options

Example:

```javascript
// designforge.config.js
{ minCoverage: 80 }

// .env
MIN_COVERAGE=85

// CLI
--coverage 90

// Result: 90 (CLI wins)
```

## Configuration Validation

Validate your configuration:

```bash
designforge validate-config
```

This checks:
- Required fields are present
- Values are within valid ranges
- File paths exist
- MCP servers are accessible
