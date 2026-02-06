export default {
  // MCP Servers
  mcpServers: {
    figma: {
      path: './mcp/figma-server',
      enabled: true
    },
    designSystem: {
      path: './mcp/design-system-server',
      enabled: true
    }
  },

  // Code Generation
  codegen: {
    language: 'typescript',
    framework: 'react',
    designSystem: '@dtsl/react',
    testFramework: 'jest',
    minCoverage: 80,
    generateStorybook: true
  },

  // Agent Behavior
  agent: {
    model: 'claude-sonnet-4-20250514',
    maxTurns: 30,
    systemPrompt: './prompts/system.md', // Custom prompt
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
    }
  },

  // Output
  output: {
    baseDir: './src/components',
    structure: 'feature', // or 'atomic'
    naming: 'kebab-case'
  }
};
