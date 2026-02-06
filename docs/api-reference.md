# API Reference

Complete API documentation for DesignForge.

## Core API

### `runDesignForge(config: DesignForgeConfig): Promise<Result>`

Main entry point for running DesignForge.

**Parameters:**

```typescript
interface DesignForgeConfig {
  figmaUrl: string;           // Figma file URL
  outputPath: string;          // Output directory
  anthropicApiKey: string;     // Claude API key
  minCoverage?: number;        // Min test coverage (default: 80)
  maxTurns?: number;           // Max AI turns (default: 30)
  verbose?: boolean;           // Verbose logging (default: false)
}
```

**Returns:**

```typescript
interface Result {
  status: 'complete' | 'partial' | 'error';
  filesGenerated: number;
  components: number;
  tests: number;
  coverage: number;
  designParity: number;
  gaps: string[];
  outputPath: string;
  errors?: string[];
}
```

**Example:**

```typescript
import { runDesignForge } from '@brevo/designforge-core';

const result = await runDesignForge({
  figmaUrl: 'https://figma.com/file/abc123',
  outputPath: './src/components',
  anthropicApiKey: 'sk-ant-...',
  minCoverage: 85,
  maxTurns: 40,
  verbose: true
});

console.log(result);
```

---

### `DesignForgeAgent`

Low-level agent class for custom workflows.

#### Constructor

```typescript
constructor(config: DesignForgeConfig)
```

#### Methods

##### `run(onProgress?: ProgressCallback): Promise<Result>`

Execute the agent workflow.

**Parameters:**

```typescript
type ProgressCallback = (progress: AgentProgress) => void;

interface AgentProgress {
  turn: number;
  status: 'running' | 'complete' | 'error';
  message: string;
  toolCalls?: Array<{ tool: string; input: any }>;
  result?: any;
}
```

**Example:**

```typescript
import { DesignForgeAgent } from '@brevo/designforge-core';

const agent = new DesignForgeAgent({
  figmaUrl: 'https://figma.com/file/abc123',
  outputPath: './output',
  anthropicApiKey: 'sk-ant-...'
});

const result = await agent.run((progress) => {
  console.log(`Turn ${progress.turn}: ${progress.message}`);

  if (progress.toolCalls) {
    progress.toolCalls.forEach(call => {
      console.log(`  Using ${call.tool}`);
    });
  }
});
```

---

## CLI API

### Commands

#### `start`

Start the DesignForge workflow.

```bash
designforge start [options]
```

**Options:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `--figma <url>` | string | Yes | - | Figma file URL |
| `--output <path>` | string | Yes | - | Output directory |
| `--coverage <number>` | number | No | 80 | Minimum test coverage |
| `--max-turns <number>` | number | No | 30 | Maximum AI turns |
| `--verbose` | boolean | No | false | Verbose logging |
| `--dry-run` | boolean | No | false | Preview without writing |
| `--validate` | boolean | No | false | Validate after generation |
| `--storybook` | boolean | No | true | Generate Storybook |

**Example:**

```bash
designforge start \
  --figma https://figma.com/file/abc123 \
  --output ./src/components \
  --coverage 85 \
  --verbose
```

---

#### `watch`

Watch Figma for changes and auto-regenerate.

```bash
designforge watch [options]
```

**Options:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `--figma <url>` | string | Yes | - | Figma file URL |
| `--output <path>` | string | Yes | - | Output directory |
| `--interval <seconds>` | number | No | 60 | Check interval |

**Example:**

```bash
designforge watch \
  --figma https://figma.com/file/abc123 \
  --output ./src/components \
  --interval 30
```

---

#### `interactive`

Interactive mode with prompts.

```bash
designforge interactive
```

**Example:**

```bash
$ designforge interactive

? Enter Figma URL: https://figma.com/file/abc123
? Output directory: ./src/components
? Generate tests? Yes
? Generate Storybook? Yes
? Minimum coverage: 80

Starting DesignForge...
```

---

#### `debug`

Debug DesignForge configuration.

```bash
designforge debug [options]
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `--check-mcp <server>` | string | Check MCP server connectivity |

**Example:**

```bash
$ designforge debug --check-mcp figma

🔍 DesignForge Debug

Environment Variables:
  ANTHROPIC_API_KEY: ✅ Set
  FIGMA_MCP_PATH: /path/to/figma-mcp
  DESIGN_SYSTEM_MCP_PATH: /path/to/design-system-mcp

MCP Server Check:
  Figma MCP: ✅ Connected
```

---

#### `validate-config`

Validate configuration file.

```bash
designforge validate-config
```

**Example:**

```bash
$ designforge validate-config

✅ Configuration Validation

✅ Configuration file found
✅ All required fields present
✅ MCP servers configured correctly
✅ Output paths valid
```

---

## Types

### `DesignForgeConfig`

```typescript
interface DesignForgeConfig {
  figmaUrl: string;
  outputPath: string;
  anthropicApiKey: string;
  minCoverage?: number;
  maxTurns?: number;
  verbose?: boolean;
}
```

### `AgentProgress`

```typescript
interface AgentProgress {
  turn: number;
  status: 'running' | 'complete' | 'error';
  message: string;
  toolCalls?: Array<{ tool: string; input: any }>;
  result?: any;
}
```

### `Result`

```typescript
interface Result {
  status: 'complete' | 'partial' | 'error';
  filesGenerated: number;
  components: number;
  tests: number;
  coverage: number;
  designParity: number;
  gaps: string[];
  outputPath: string;
  errors?: string[];
}
```

### `ToolCall`

```typescript
interface ToolCall {
  tool: string;
  input: any;
}
```

---

## Configuration Schema

### `designforge.config.js`

```typescript
interface Config {
  mcpServers?: {
    figma?: {
      path: string;
      enabled: boolean;
      timeout?: number;
    };
    designSystem?: {
      path: string;
      enabled: boolean;
      timeout?: number;
    };
  };

  codegen?: {
    language: 'typescript' | 'javascript';
    framework: 'react' | 'vue' | 'svelte';
    designSystem: string;
    testFramework: 'jest' | 'vitest' | 'mocha';
    minCoverage: number;
    generateStorybook: boolean;
  };

  agent?: {
    model: string;
    maxTurns: number;
    systemPrompt?: string;
    temperature: number;
  };

  validation?: {
    designParity?: {
      enabled: boolean;
      minScore: number;
    };
    accessibility?: {
      enabled: boolean;
      level: 'A' | 'AA' | 'AAA';
    };
  };

  output?: {
    baseDir: string;
    structure: 'feature' | 'atomic';
    naming: 'kebab-case' | 'PascalCase' | 'camelCase';
  };

  hooks?: {
    beforeGenerate?: string;
    afterGenerate?: string;
    onError?: string;
  };
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `E001` | Missing Anthropic API key |
| `E002` | Invalid Figma URL |
| `E003` | MCP server connection failed |
| `E004` | Agent exceeded max turns |
| `E005` | Code generation failed |
| `E006` | Test generation failed |
| `E007` | Validation failed |
| `E008` | Invalid configuration |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `FIGMA_MCP_PATH` | No | Path to Figma MCP server |
| `DESIGN_SYSTEM_MCP_PATH` | No | Path to Design System MCP |
| `PROJECT_ROOT` | No | Project root directory |
| `CLAUDE_MODEL` | No | Claude model to use |
| `MAX_TURNS` | No | Maximum AI turns |
| `MIN_COVERAGE` | No | Minimum test coverage |
| `VERBOSE` | No | Enable verbose logging |
