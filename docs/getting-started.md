# Getting Started with DesignForge

Welcome to DesignForge! This guide will help you get up and running quickly.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed
- **Claude API Key** from Anthropic
- **Figma Access** to the designs you want to convert
- **MCP Servers** configured (Figma and Design System)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/brevo/designforge.git
cd designforge
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
FIGMA_MCP_PATH=/path/to/figma-mcp
DESIGN_SYSTEM_MCP_PATH=/path/to/design-system-mcp
PROJECT_ROOT=/path/to/your/project
```

### 4. Build Packages

```bash
npm run build
```

## Your First Workflow

### Using the CLI

```bash
cd packages/cli

node dist/cli.js start \
  --figma https://figma.com/file/YOUR_FILE_ID \
  --output ./output/components \
  --verbose
```

### Using the API

Create a file `my-workflow.ts`:

```typescript
import { runDesignForge } from '@brevo/designforge-core';
import { config } from 'dotenv';

config();

async function main() {
  const result = await runDesignForge({
    figmaUrl: 'https://figma.com/file/YOUR_FILE_ID',
    outputPath: './output/components',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    minCoverage: 80,
    maxTurns: 30,
    verbose: true
  });

  console.log('Generated:', result);
}

main();
```

Run it:

```bash
npx ts-node my-workflow.ts
```

## What Happens Next?

DesignForge will autonomously:

1. **Analyze your Figma design** - Extracts components, variants, and design tokens
2. **Map to your design system** - Identifies matching components
3. **Generate code** - Creates TypeScript/React components
4. **Write tests** - Generates comprehensive test suites
5. **Create documentation** - Builds Storybook stories and README files
6. **Validate output** - Ensures design-dev parity

## Understanding the Output

After completion, you'll find:

```
output/components/
├── ComponentName/
│   ├── ComponentName.tsx          # Main component
│   ├── ComponentName.test.tsx     # Jest tests
│   ├── ComponentName.stories.tsx  # Storybook stories
│   ├── ComponentName.types.ts     # TypeScript types
│   ├── index.ts                   # Exports
│   └── README.md                  # Documentation
```

## Next Steps

- Read [Configuration Guide](./configuration.md) for advanced options
- Explore [Workflows](./workflows.md) for different use cases
- Check [API Reference](./api-reference.md) for detailed API docs

## Troubleshooting

### API Key Issues

If you see "ANTHROPIC_API_KEY not found":

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### MCP Connection Errors

Verify your MCP servers are configured:

```bash
node dist/cli.js debug --check-mcp all
```

### Build Errors

Clean and rebuild:

```bash
npm run clean
npm install
npm run build
```

## Getting Help

- Check [Troubleshooting Guide](./troubleshooting.md)
- Open an issue on GitHub
- Join our community Discord

Happy coding with DesignForge! 🚀
