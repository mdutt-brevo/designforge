#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { runDesignForge, DesignForgeConfig } from '@brevo/designforge-core';
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
    console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`  FIGMA_MCP_PATH: ${process.env.FIGMA_MCP_PATH || '❌ Not set'}`);
    console.log(`  DESIGN_SYSTEM_MCP_PATH: ${process.env.DESIGN_SYSTEM_MCP_PATH || '❌ Not set'}`);
    console.log(`  PROJECT_ROOT: ${process.env.PROJECT_ROOT || '❌ Not set'}`);

    // Check MCP connectivity if requested
    if (options.checkMcp) {
      console.log(chalk.yellow('\n⚠️  MCP connectivity check not yet implemented'));
    }
  });

// Validate config command
program
  .command('validate-config')
  .description('Validate DesignForge configuration')
  .action(() => {
    console.log(chalk.blue('✅ Configuration Validation\n'));

    const configPath = path.join(process.cwd(), 'designforge.config.js');
    if (fs.existsSync(configPath)) {
      console.log(chalk.green('✅ Configuration file found'));
      // TODO: Load and validate config
    } else {
      console.log(chalk.yellow('⚠️  No designforge.config.js found'));
      console.log('   Using default configuration');
    }
  });

async function startWorkflow(options: any): Promise<void> {
  const spinner = ora('Initializing DesignForge...').start();

  // Validate API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    spinner.fail('ANTHROPIC_API_KEY not found in environment');
    console.log(chalk.yellow('\nPlease set your API key:'));
    console.log('  export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  spinner.succeed('Configuration loaded');

  // Build config
  const config: DesignForgeConfig = {
    figmaUrl: options.figma,
    outputPath: path.resolve(options.output),
    anthropicApiKey: apiKey,
    minCoverage: parseInt(options.coverage),
    maxTurns: parseInt(options.maxTurns),
    verbose: options.verbose
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
  console.log(`   Figma URL: ${chalk.cyan(config.figmaUrl)}`);
  console.log(`   Output: ${chalk.cyan(config.outputPath)}`);
  console.log(`   Coverage: ${chalk.cyan(config.minCoverage + '%')}`);
  console.log(`   Max Turns: ${chalk.cyan(config.maxTurns)}`);
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
