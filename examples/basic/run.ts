import { runDesignForge, DesignForgeConfig } from '@brevo/designforge-core';
import { config } from 'dotenv';

// Load environment variables
config();

async function main() {
  const designForgeConfig: DesignForgeConfig = {
    figmaUrl: 'https://figma.com/file/abc123/UserSettings',
    outputPath: './output/components',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    minCoverage: 80,
    maxTurns: 30,
    verbose: true
  };

  console.log('Starting DesignForge...\n');

  try {
    const result = await runDesignForge(designForgeConfig);

    console.log('\nSuccess!');
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
