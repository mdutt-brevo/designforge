# Advanced Example

This example demonstrates advanced usage with custom progress tracking and agent configuration.

## Features

- Custom progress handler
- Real-time status updates
- Tool call monitoring
- Extended turn limits
- Higher coverage requirements

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
npx ts-node custom-agent.ts
```

## What's Different

This example shows:
- How to instantiate the agent directly
- Custom progress callbacks
- Real-time monitoring of tool calls
- Handling completion events
- Custom configuration for complex projects

## Use Cases

- Large, complex Figma designs
- Projects requiring higher test coverage
- Workflows needing custom monitoring
- Integration with CI/CD pipelines
