#!/usr/bin/env npx ts-node
/**
 * Quick connectivity test for both MCP servers.
 * Run: npx ts-node scripts/test-mcp-connectivity.ts
 *
 * Tests:
 *   1. Naos MCP (HTTP) — connects and lists tools
 *   2. Figma MCP (stdio) — connects and lists tools (requires FIGMA_MCP_KEY)
 */

import { McpBridge, McpServerConfig } from '../packages/core/src/mcp-bridge';

async function main() {
  const servers: McpServerConfig[] = [];

  // Naos — always available, no auth
  servers.push({
    name: 'naos',
    transport: 'http',
    url: process.env.NAOS_MCP_URL || 'https://naos-mcp.51b.dev/mcp',
  });

  // Figma — only if key is set
  const figmaKey = process.env.FIGMA_MCP_KEY;
  if (figmaKey) {
    servers.push({
      name: 'figma',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'figma-developer-mcp', '--stdio'],
      env: { FIGMA_API_KEY: figmaKey },
    });
  } else {
    console.log('⚠️  FIGMA_MCP_KEY not set — skipping Figma MCP test\n');
  }

  const bridge = new McpBridge(servers, true);

  try {
    console.log('Connecting to MCP servers...\n');
    await bridge.connect();

    const tools = bridge.getTools();
    console.log(`\n✅ Connected! Discovered ${tools.length} tools:\n`);

    // Group by server
    const byServer = new Map<string, typeof tools>();
    for (const tool of tools) {
      const group = byServer.get(tool.serverName) ?? [];
      group.push(tool);
      byServer.set(tool.serverName, group);
    }

    for (const [server, serverTools] of byServer) {
      console.log(`  ${server}:`);
      for (const tool of serverTools) {
        console.log(`    • ${tool.name} — ${tool.description || '(no description)'}`);
      }
      console.log();
    }

    // Quick smoke test — call one tool from each server
    console.log('--- Smoke tests ---\n');

    // Test Naos
    if (byServer.has('naos')) {
      console.log('Calling hi_naos...');
      const naosResult = await bridge.callTool('hi_naos', {});
      console.log(`  Result: ${naosResult.slice(0, 200)}${naosResult.length > 200 ? '...' : ''}\n`);
    }

    // Test Figma (only list tools, don't call expensive ops)
    if (byServer.has('figma')) {
      const figmaTools = byServer.get('figma')!;
      console.log(`  Figma connected with ${figmaTools.length} tools — ✅ ready\n`);
    }

    console.log('✅ All MCP servers operational!\n');
  } catch (err) {
    console.error('\n❌ MCP connectivity failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await bridge.disconnect();
  }
}

main();
