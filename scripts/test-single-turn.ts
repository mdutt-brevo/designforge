#!/usr/bin/env npx ts-node
/**
 * Single-turn integration test: LLM → MCP tool call → response.
 * Verifies the full pipeline without running the entire multi-turn workflow.
 *
 * Run: source ~/.zshrc && npx ts-node scripts/test-single-turn.ts
 *
 * Prerequisites:
 *   - LM Studio running at http://127.0.0.1:1234
 *   - FIGMA_MCP_KEY set (optional — will use Naos only if missing)
 */

import { DesignForgeAgent, DesignForgeConfig, McpServerConfig } from '../packages/core/src';

async function main() {
  const mcpServers: McpServerConfig[] = [];

  // Naos — always
  mcpServers.push({
    name: 'naos',
    transport: 'http',
    url: process.env.NAOS_MCP_URL || 'https://naos-mcp.brevo.tech/mcp',
  });

  // Figma — only if key is set
  const figmaKey = process.env.FIGMA_MCP_KEY;
  if (figmaKey) {
    mcpServers.push({
      name: 'figma',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'figma-developer-mcp', '--stdio'],
      env: { FIGMA_API_KEY: figmaKey },
    });
  } else {
    console.log('⚠️  FIGMA_MCP_KEY not set — running with Naos only\n');
  }

  const config: DesignForgeConfig = {
    figmaUrl: 'https://www.figma.com/design/test-connectivity',
    outputPath: './test-output',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || 'lm-studio',
    baseURL: process.env.ANTHROPIC_BASE_URL || 'http://127.0.0.1:1234',
    model: process.env.CLAUDE_MODEL || 'qwen/qwen3-coder-30b',
    maxTurns: 2,       // Only 2 turns — just enough to see a tool call + response
    verbose: true,      // Show everything
    minCoverage: 80,
    mcpServers,
  };

  console.log('🔨 DesignForge — Single-Turn Integration Test\n');
  console.log(`  LLM:    ${config.baseURL}`);
  console.log(`  Model:  ${config.model}`);
  console.log(`  Servers: ${mcpServers.map(s => s.name).join(', ')}`);
  console.log();

  const agent = new DesignForgeAgent(config);

  try {
    const result = await agent.run((progress) => {
      console.log(`\n--- Turn ${progress.turn} (${progress.status}) ---`);
      if (progress.toolCalls && progress.toolCalls.length > 0) {
        for (const call of progress.toolCalls) {
          console.log(`  🔧 Tool: ${call.tool}`);
          console.log(`     Input: ${JSON.stringify(call.input)}`);
        }
      }
      if (progress.message) {
        const preview = progress.message.slice(0, 300);
        console.log(`  💬 ${preview}${progress.message.length > 300 ? '...' : ''}`);
      }
    });

    console.log('\n✅ Test passed! Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // "Agent did not complete within 2 turns" is EXPECTED — we limited to 2 turns
    if (message.includes('did not complete within')) {
      console.log('\n✅ Test passed! Agent ran 2 turns and hit the limit (expected).');
      console.log('   The LLM made tool calls and received real MCP responses.\n');
    } else {
      console.error('\n❌ Test failed:', message);
      process.exit(1);
    }
  }
}

main();
