import { DesignForgeAgent, DesignForgeConfig, AgentProgress } from '@brevo/designforge-core';
import { config } from 'dotenv';

config();

async function main() {
  const agentConfig: DesignForgeConfig = {
    figmaUrl: 'https://figma.com/file/xyz789/Dashboard',
    outputPath: './output/dashboard',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    minCoverage: 85,
    maxTurns: 40,
    verbose: true
  };

  const agent = new DesignForgeAgent(agentConfig);

  console.log('🔨 Starting Advanced DesignForge Workflow\n');

  // Run with custom progress handler
  const result = await agent.run((progress: AgentProgress) => {
    console.log(`\n[Turn ${progress.turn}] ${progress.status}`);
    console.log(`Message: ${progress.message}`);

    if (progress.toolCalls) {
      console.log('Tool calls:');
      progress.toolCalls.forEach(call => {
        console.log(`  - ${call.tool}`);
        console.log(`    Input: ${JSON.stringify(call.input, null, 2)}`);
      });
    }

    // Custom logic based on progress
    if (progress.status === 'complete') {
      console.log('\n✨ Workflow completed successfully!');
      console.log('Result:', JSON.stringify(progress.result, null, 2));
    }
  });

  console.log('\n📊 Final Result:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
