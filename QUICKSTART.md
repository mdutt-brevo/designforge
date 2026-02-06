# DesignForge - Quick Start Guide

Get up and running with DesignForge in 5 minutes!

## Step 1: Install Dependencies

```bash
cd designforge
npm install
```

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

## Step 3: Build Packages

```bash
npm run build
```

This compiles both the core and CLI packages.

## Step 4: Run Your First Workflow

```bash
cd packages/cli

node dist/cli.js start \
  --figma https://figma.com/file/YOUR_FILE_ID \
  --output ../../output/components \
  --verbose
```

Replace `YOUR_FILE_ID` with an actual Figma file URL.

## Step 5: Check the Output

```bash
ls -la ../../output/components
```

You should see generated components with:
- `.tsx` files (React components)
- `.test.tsx` files (Jest tests)
- `.stories.tsx` files (Storybook stories)
- `.types.ts` files (TypeScript types)
- `README.md` files (Documentation)

## What Just Happened?

DesignForge autonomously:

1. ✅ Analyzed your Figma design
2. ✅ Extracted components and design tokens
3. ✅ Mapped to your design system
4. ✅ Generated production-ready TypeScript/React code
5. ✅ Created comprehensive test suites
6. ✅ Generated Storybook documentation
7. ✅ Validated design-dev parity

## Next Steps

### Try Interactive Mode

```bash
node dist/cli.js interactive
```

Answer the prompts to customize your workflow.

### Explore Examples

```bash
# Basic example
cd ../../examples/basic
npx ts-node run.ts

# Advanced example with progress tracking
cd ../advanced
npx ts-node custom-agent.ts
```

### Customize Configuration

Create `designforge.config.js` in your project root:

```javascript
export default {
  codegen: {
    minCoverage: 85,
    framework: 'react',
    designSystem: '@your-company/design-system'
  },
  agent: {
    maxTurns: 40,
    model: 'claude-sonnet-4-20250514'
  }
};
```

### Use in Your Project

```typescript
import { runDesignForge } from '@brevo/designforge-core';

const result = await runDesignForge({
  figmaUrl: 'https://figma.com/file/...',
  outputPath: './src/components',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  minCoverage: 80,
  verbose: true
});

console.log('Generated:', result);
```

## Common Commands

```bash
# Start workflow
node dist/cli.js start --figma <url> --output <path>

# Watch for changes
node dist/cli.js watch --figma <url> --output <path>

# Interactive mode
node dist/cli.js interactive

# Debug configuration
node dist/cli.js debug

# Validate config
node dist/cli.js validate-config

# Help
node dist/cli.js --help
```

## Troubleshooting

### "ANTHROPIC_API_KEY not found"

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Or add it to your `.env` file.

### "Module not found"

```bash
npm run clean
npm install
npm run build
```

### "Agent exceeded max turns"

Increase the turn limit:

```bash
node dist/cli.js start --figma <url> --output <path> --max-turns 50
```

## Learn More

- [Getting Started Guide](./docs/getting-started.md) - Comprehensive setup
- [Configuration Guide](./docs/configuration.md) - All configuration options
- [Workflows](./docs/workflows.md) - Different use cases
- [API Reference](./docs/api-reference.md) - Complete API docs

## Need Help?

- Check the [documentation](./docs/)
- Open an issue on GitHub
- Join our community

Happy building with DesignForge! 🚀
