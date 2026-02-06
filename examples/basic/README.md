# Basic Example

This example demonstrates the simplest usage of DesignForge.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set your API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

3. Run the example:
```bash
npx ts-node run.ts
```

## What it does

This example:
1. Connects to a Figma file
2. Extracts design specifications
3. Maps components to the design system
4. Generates production-ready TypeScript/React code
5. Creates tests and documentation
6. Validates the output

## Expected Output

```
output/components/
├── UserSettings/
│   ├── UserSettings.tsx
│   ├── UserSettings.test.tsx
│   ├── UserSettings.stories.tsx
│   ├── UserSettings.types.ts
│   ├── index.ts
│   └── README.md
```
