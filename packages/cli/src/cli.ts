#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { runDesignForge, DesignForgeConfig, McpServerConfig } from '@brevo/designforge-core';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
config();

const program = new Command();

program
  .name('designforge')
  .description('Autonomous AI Agent: Figma → Design System → Production Code')
  .version('0.1.0');

// Start command
program
  .command('start')
  .description('Start DesignForge workflow')
  .requiredOption('--figma <url>', 'Figma file URL')
  .requiredOption('--output <path>', 'Output directory path')
  .option('--coverage <number>', 'Minimum test coverage percentage', '80')
  .option('--storybook', 'Generate Storybook stories', true)
  .option('--validate', 'Validate against Figma after generation', false)
  .option('--max-turns <number>', 'Maximum AI turns', '30')
  .option('--verbose', 'Detailed logging', false)
  .option('--dry-run', 'Preview without writing files', false)
  .action(async (options) => {
    try {
      await startWorkflow(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Watch command
program
  .command('watch')
  .description('Watch Figma for changes and rebuild automatically')
  .requiredOption('--figma <url>', 'Figma file URL')
  .requiredOption('--output <path>', 'Output directory path')
  .option('--interval <seconds>', 'Check interval in seconds', '60')
  .action(async (options) => {
    console.log(chalk.blue('👀 DesignForge Watch Mode\n'));
    console.log(`Monitoring: ${options.figma}`);
    console.log(`Interval: ${options.interval}s\n`);

    // TODO: Implement watch mode with polling
    console.log(chalk.yellow('⚠️  Watch mode not yet implemented'));
  });

// Interactive command
program
  .command('interactive')
  .description('Interactive mode with prompts')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'figmaUrl',
        message: 'Enter Figma URL:',
        validate: (input) => input.length > 0 || 'Figma URL is required'
      },
      {
        type: 'input',
        name: 'outputPath',
        message: 'Output directory:',
        default: './src/components'
      },
      {
        type: 'confirm',
        name: 'generateTests',
        message: 'Generate tests?',
        default: true
      },
      {
        type: 'confirm',
        name: 'generateStorybook',
        message: 'Generate Storybook?',
        default: true
      },
      {
        type: 'number',
        name: 'minCoverage',
        message: 'Minimum coverage:',
        default: 80
      }
    ]);

    await startWorkflow({
      figma: answers.figmaUrl,
      output: answers.outputPath,
      coverage: answers.minCoverage.toString(),
      storybook: answers.generateStorybook,
      verbose: false
    });
  });

// Debug command
program
  .command('debug')
  .description('Debug DesignForge configuration')
  .option('--check-mcp <server>', 'Check MCP server connectivity')
  .action((options) => {
    console.log(chalk.blue('🔍 DesignForge Debug\n'));

    // Check environment variables
    console.log(chalk.bold('Environment Variables:'));
    console.log(`  ANTHROPIC_API_KEY:   ${process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`  ANTHROPIC_BASE_URL:  ${process.env.ANTHROPIC_BASE_URL || '❌ Not set (will use default)'}`);
    console.log(`  CLAUDE_MODEL:        ${process.env.CLAUDE_MODEL || '❌ Not set (will use default)'}`);
    console.log(`  FIGMA_MCP_KEY:       ${process.env.FIGMA_MCP_KEY ? '✅ Set (' + process.env.FIGMA_MCP_KEY.slice(0, 8) + '...)' : '❌ Not set'}`);
    console.log(`  NAOS_MCP_URL:        ${process.env.NAOS_MCP_URL || 'https://naos-mcp.51b.dev/mcp (default)'}`);
    console.log(`  PROJECT_ROOT:        ${process.env.PROJECT_ROOT || '❌ Not set'}`);

    // Check MCP connectivity if requested
    if (options.checkMcp) {
      console.log(chalk.yellow('\n⚠️  MCP connectivity check not yet implemented'));
    }
  });

// Validate config command
program
  .command('validate-config')
  .description('Validate DesignForge configuration')
  .action(async () => {
    console.log(chalk.blue('✅ Configuration Validation\n'));

    const fileConfig = await loadConfigFile();
    const configPath = path.join(process.cwd(), 'designforge.config.js');

    if (Object.keys(fileConfig).length > 0) {
      console.log(chalk.green('✅ Configuration file found:'), configPath);
      console.log(chalk.dim(JSON.stringify(fileConfig, null, 2)));
    } else {
      console.log(chalk.yellow('⚠️  No designforge.config.js found'));
      console.log('   Using default configuration');
    }
  });

/**
 * Load designforge.config.js from the current directory if it exists.
 * Returns an empty object if the file is not found or fails to load.
 */
async function loadConfigFile(): Promise<Record<string, any>> {
  const configPath = path.join(process.cwd(), 'designforge.config.js');
  if (!fs.existsSync(configPath)) return {};

  try {
    // Dynamic import works for both ESM `export default` and CJS `module.exports`
    const imported = await import(configPath);
    return imported.default ?? imported;
  } catch {
    return {};
  }
}

async function startWorkflow(options: any): Promise<void> {
  const spinner = ora('Initializing DesignForge...').start();

  // Load config file — values are used as defaults; CLI flags take priority
  const fileConfig = await loadConfigFile();

  // Validate API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    spinner.fail('ANTHROPIC_API_KEY not found in environment');
    console.log(chalk.yellow('\nPlease set your API key:'));
    console.log('  export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  spinner.succeed('Configuration loaded');

  // Build MCP server connections from environment.
  // Figma: stdio transport — spawns figma-developer-mcp as a child process.
  // Naos:  HTTP transport — connects to the remote Naos MCP endpoint.
  const mcpServers: McpServerConfig[] = [];

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
    console.log(chalk.yellow('  ⚠ FIGMA_MCP_KEY not set — Figma MCP will use mock data'));
  }

  const naosUrl = process.env.NAOS_MCP_URL || 'https://naos-mcp.51b.dev/mcp';
  mcpServers.push({
    name: 'naos',
    transport: 'http',
    url: naosUrl,
  });

  // Build config — priority: CLI flags > env vars > designforge.config.js > defaults
  const config: DesignForgeConfig = {
    figmaUrl: options.figma,
    outputPath: path.resolve(options.output || fileConfig.output?.baseDir || './src/components'),
    anthropicApiKey: apiKey,
    minCoverage: parseInt(options.coverage) || fileConfig.codegen?.minCoverage || 80,
    maxTurns: parseInt(options.maxTurns) || fileConfig.agent?.maxTurns || 30,
    verbose: options.verbose,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    model: process.env.CLAUDE_MODEL || fileConfig.agent?.model,
    mcpServers,
  };

  if (options.dryRun) {
    console.log(chalk.blue('\n🔍 Dry Run Mode - Preview Only\n'));
    console.log('Configuration:');
    console.log(`  Figma URL: ${config.figmaUrl}`);
    console.log(`  Output: ${config.outputPath}`);
    console.log(`  Coverage: ${config.minCoverage}%`);
    console.log(`  Max Turns: ${config.maxTurns}`);
    return;
  }

  // Display header
  console.log('\n' + chalk.bold.blue('🔨 DesignForge'));
  console.log(chalk.dim('Autonomous Figma to Code Agent\n'));
  console.log(chalk.bold('📋 Configuration:'));
  console.log(`   Figma URL:  ${chalk.cyan(config.figmaUrl)}`);
  console.log(`   Output:     ${chalk.cyan(config.outputPath)}`);
  console.log(`   Coverage:   ${chalk.cyan(config.minCoverage + '%')}`);
  console.log(`   Max Turns:  ${chalk.cyan(config.maxTurns)}`);
  console.log(chalk.bold('\n🔌 MCP Servers:'));
  for (const srv of mcpServers) {
    const transport = srv.transport === 'stdio' ? 'stdio' : 'http';
    console.log(`   ${chalk.green('●')} ${srv.name} (${transport})`);
  }
  console.log();

  // Run workflow
  const workflowSpinner = ora('Starting autonomous workflow...').start();

  try {
    const result = await runDesignForge(config);

    workflowSpinner.succeed('Workflow completed!');

    // Display results
    console.log('\n' + chalk.bold.green('✅ DesignForge Complete!\n'));
    console.log(chalk.bold('📊 Summary:'));
    console.log(`   Files: ${chalk.cyan(result.filesGenerated)}`);
    console.log(`   Components: ${chalk.cyan(result.components)}`);
    console.log(`   Tests: ${chalk.cyan(result.tests)}`);
    console.log(`   Coverage: ${chalk.cyan(result.coverage + '%')}`);
    console.log(`   Design Parity: ${chalk.cyan(result.designParity + '%')}`);

    if (result.gaps && result.gaps.length > 0) {
      console.log(chalk.yellow('\n⚠️  Design System Gaps:'));
      result.gaps.forEach((gap: string) => console.log(`   • ${gap}`));
    }

    console.log(`\n${chalk.bold('📁 Output:')} ${chalk.cyan(result.outputPath)}\n`);
  } catch (error) {
    workflowSpinner.fail('Workflow failed');
    throw error;
  }
}

program.parse();
