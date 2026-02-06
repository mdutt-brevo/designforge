# Workflows

DesignForge supports various workflows for different use cases.

## Basic Workflow

The simplest workflow: Figma → Code

```bash
designforge start \
  --figma https://figma.com/file/abc123 \
  --output ./src/components
```

**What happens:**
1. Analyzes Figma design
2. Maps to design system
3. Generates code, tests, and documentation
4. Outputs to specified directory

**Use case:** Quick prototyping, simple components

---

## Watch Workflow

Continuously monitor Figma for changes:

```bash
designforge watch \
  --figma https://figma.com/file/abc123 \
  --output ./src/components \
  --interval 60
```

**What happens:**
1. Checks Figma every 60 seconds
2. Detects changes via version hash
3. Automatically regenerates code
4. Optionally commits to git

**Use case:** Active design iteration, living style guide

---

## CI/CD Workflow

Automate code generation in your pipeline:

```yaml
# .github/workflows/designforge.yml
name: Sync Figma Designs

on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install DesignForge
        run: |
          cd designforge
          npm install
          npm run build

      - name: Run DesignForge
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          cd designforge/packages/cli
          node dist/cli.js start \
            --figma ${{ secrets.FIGMA_FILE_URL }} \
            --output ../../output/components \
            --validate

      - name: Create PR
        uses: peter-evans/create-pull-request@v5
        with:
          title: '[DesignForge] Auto-sync from Figma'
          body: 'Automated code generation from Figma'
          branch: designforge/auto-sync
```

**Use case:** Automated design-dev sync, scheduled updates

---

## Multi-Design Workflow

Process multiple Figma files:

```typescript
import { runDesignForge } from '@brevo/designforge-core';

const designs = [
  {
    figmaUrl: 'https://figma.com/file/abc123/UserSettings',
    outputPath: './src/pages/UserSettings'
  },
  {
    figmaUrl: 'https://figma.com/file/def456/Dashboard',
    outputPath: './src/pages/Dashboard'
  },
  {
    figmaUrl: 'https://figma.com/file/ghi789/Profile',
    outputPath: './src/pages/Profile'
  }
];

async function processAllDesigns() {
  for (const design of designs) {
    console.log(`Processing: ${design.figmaUrl}`);

    await runDesignForge({
      figmaUrl: design.figmaUrl,
      outputPath: design.outputPath,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
      minCoverage: 80,
      maxTurns: 30,
      verbose: false
    });
  }
}

processAllDesigns();
```

**Use case:** Batch processing, migrating multiple designs

---

## Validation Workflow

Generate and validate against Figma specs:

```bash
designforge start \
  --figma https://figma.com/file/abc123 \
  --output ./src/components \
  --validate \
  --coverage 90
```

**What happens:**
1. Generates code
2. Runs tests
3. Compares against Figma design
4. Generates parity report
5. Fails if parity < 95%

**Use case:** High-fidelity implementations, compliance checking

---

## Custom Workflow with Hooks

Use hooks for custom logic:

```javascript
// designforge.config.js
export default {
  hooks: {
    beforeGenerate: async (context) => {
      // Check if design is approved
      const approved = await checkDesignApproval(context.figmaUrl);
      if (!approved) {
        throw new Error('Design not approved yet');
      }
    },

    afterGenerate: async (files) => {
      // Run custom scripts
      await runPrettier(files);
      await runESLint(files);
      await generateI18nKeys(files);

      // Create git commit
      await gitCommit(files, 'feat: generated from Figma');

      // Notify team
      await notifySlack({
        message: `Generated ${files.length} files from Figma`,
        files
      });
    },

    onError: async (error) => {
      // Error handling
      await notifySlack({
        message: `DesignForge error: ${error.message}`,
        level: 'error'
      });
    }
  }
};
```

**Use case:** Company-specific workflows, custom integrations

---

## Design System Gap Analysis

Identify missing design system components:

```typescript
import { DesignForgeAgent } from '@brevo/designforge-core';

async function analyzeGaps() {
  const agent = new DesignForgeAgent({
    figmaUrl: 'https://figma.com/file/abc123',
    outputPath: './analysis',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    maxTurns: 20,
    verbose: true
  });

  const result = await agent.run();

  console.log('Design System Gaps:');
  result.gaps.forEach(gap => {
    console.log(`  - ${gap}`);
  });

  // Generate gap report
  await generateGapReport(result.gaps);
}

analyzeGaps();
```

**Use case:** Design system audits, planning improvements

---

## Incremental Update Workflow

Update specific components only:

```bash
# Generate entire page initially
designforge start \
  --figma https://figma.com/file/abc123 \
  --output ./src/components/UserSettings

# Later, update specific component
designforge start \
  --figma https://figma.com/file/abc123#ProfileSection \
  --output ./src/components/UserSettings/ProfileSection
```

**Use case:** Iterative development, partial updates

---

## Testing-First Workflow

Generate tests before implementation:

```javascript
// designforge.config.js
export default {
  codegen: {
    generateTests: true,
    generateImplementation: false // Tests only
  }
};
```

```bash
# Step 1: Generate tests
designforge start --figma <url> --output ./src

# Step 2: Run tests (they fail)
npm test

# Step 3: Generate implementation
designforge start --figma <url> --output ./src --no-tests

# Step 4: Run tests (they pass)
npm test
```

**Use case:** TDD approach, test-driven development

---

## Component Library Workflow

Build a component library from Figma:

```bash
# Generate all components
designforge start \
  --figma https://figma.com/file/library123 \
  --output ./packages/components/src \
  --storybook

# Build library
cd ./packages/components
npm run build

# Publish to npm
npm publish
```

**Use case:** Creating reusable component libraries

---

## Migration Workflow

Migrate existing components to design system:

```typescript
import { DesignForgeAgent } from '@brevo/designforge-core';
import fs from 'fs';

async function migrateComponent(figmaUrl: string, componentPath: string) {
  // Backup existing component
  const backup = fs.readFileSync(componentPath, 'utf-8');
  fs.writeFileSync(componentPath + '.backup', backup);

  // Generate new component
  await runDesignForge({
    figmaUrl,
    outputPath: componentPath,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    minCoverage: 80,
    maxTurns: 30,
    verbose: false
  });

  console.log(`Migrated: ${componentPath}`);
  console.log(`Backup saved: ${componentPath}.backup`);
}

// Migrate multiple components
const migrations = [
  ['https://figma.com/file/a/Button', './src/components/Button'],
  ['https://figma.com/file/b/Input', './src/components/Input'],
  ['https://figma.com/file/c/Card', './src/components/Card']
];

for (const [figmaUrl, path] of migrations) {
  await migrateComponent(figmaUrl, path);
}
```

**Use case:** Modernizing legacy code, adopting new design system

---

## Best Practices

### 1. Start Small
Begin with simple components before tackling complex pages.

### 2. Validate Regularly
Use `--validate` flag to ensure design-dev parity.

### 3. Version Control
Always commit generated code to git for review.

### 4. Use Hooks
Leverage hooks for custom workflows and integrations.

### 5. Monitor Coverage
Maintain high test coverage (>80%) for reliability.

### 6. Document Gaps
Track design system gaps for future improvements.

### 7. Automate in CI/CD
Schedule regular syncs to keep code updated with designs.

### 8. Review Generated Code
Always review and refine generated code before production.
