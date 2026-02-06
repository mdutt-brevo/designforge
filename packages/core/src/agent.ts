import Anthropic from '@anthropic-ai/sdk';

export interface DesignForgeConfig {
  figmaUrl: string;
  outputPath: string;
  anthropicApiKey: string;
  minCoverage?: number;
  maxTurns?: number;
  verbose?: boolean;
}

export interface AgentProgress {
  turn: number;
  status: 'running' | 'complete' | 'error';
  message: string;
  toolCalls?: Array<{ tool: string; input: any }>;
  result?: any;
}

export class DesignForgeAgent {
  private anthropic: Anthropic;
  private config: DesignForgeConfig;
  private conversationHistory: Anthropic.MessageParam[] = [];

  constructor(config: DesignForgeConfig) {
    this.config = config;
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  async run(onProgress?: (progress: AgentProgress) => void): Promise<any> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt();

    this.conversationHistory = [
      { role: 'user', content: userPrompt }
    ];

    let turn = 0;
    const maxTurns = this.config.maxTurns || 30;

    while (turn < maxTurns) {
      turn++;

      this.log(`\n🔨 DesignForge - Turn ${turn}/${maxTurns}`);

      onProgress?.({
        turn,
        status: 'running',
        message: `Processing turn ${turn}...`
      });

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: this.conversationHistory,
        tools: [
          {
            name: "figma",
            description: "Extract design specifications from Figma files including components, variants, design tokens, and interactions",
            input_schema: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["get_file", "get_components", "get_styles"],
                  description: "The action to perform"
                },
                file_url: {
                  type: "string",
                  description: "The Figma file URL"
                }
              },
              required: ["action", "file_url"]
            }
          },
          {
            name: "design-system",
            description: "Query the design system for available components, their props, usage patterns, and examples",
            input_schema: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["list_components", "get_component_details", "search_components"],
                  description: "The action to perform"
                },
                component_name: {
                  type: "string",
                  description: "Optional component name to query"
                }
              },
              required: ["action"]
            }
          }
        ]
      });

      // Process response blocks
      const textContent: string[] = [];
      const toolCalls: Array<{ tool: string; input: any }> = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          textContent.push(block.text);
          this.log(`\n💭 Claude: ${block.text}`);
        } else if (block.type === 'tool_use') {
          toolCalls.push({ tool: block.name, input: block.input });
          this.log(`\n🔧 Using ${block.name} MCP`);
          this.log(`   Input: ${JSON.stringify(block.input, null, 2)}`);
        }
      }

      const fullText = textContent.join('\n');

      onProgress?.({
        turn,
        status: 'running',
        message: fullText,
        toolCalls
      });

      // Check for completion
      if (this.isWorkflowComplete(fullText, response.stop_reason || undefined)) {
        const result = this.extractResults(this.conversationHistory);

        onProgress?.({
          turn,
          status: 'complete',
          message: '✅ Workflow completed successfully!',
          result
        });

        this.log('\n✅ DesignForge completed successfully!');
        this.log(`\n📊 Results: ${JSON.stringify(result, null, 2)}`);

        return result;
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content
      });

      // Handle tool uses
      const toolUses = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === 'tool_use'
      );

      if (toolUses.length > 0) {
        // In production, these would come from actual MCP servers
        // For now, we'll simulate tool results
        const toolResults = toolUses.map(toolUse => ({
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: this.simulateToolResult(toolUse.name, toolUse.input)
        }));

        this.conversationHistory.push({
          role: 'user',
          content: toolResults
        });
      } else {
        // No tools used, prompt agent to continue
        this.conversationHistory.push({
          role: 'user',
          content: 'Continue with the next step in the workflow.'
        });
      }
    }

    throw new Error(`Agent did not complete within ${maxTurns} turns`);
  }

  private buildSystemPrompt(): string {
    return `You are DesignForge, an autonomous AI agent that converts Figma designs to production-ready code.

## Your Mission
Transform Figma designs into production code using the company's design system, following best practices for TypeScript, React, testing, and documentation.

## Available Tools
1. **Figma MCP** - Extract design specifications, components, variants, tokens, and interactions
2. **Design System MCP** - Query available components, their props, usage patterns, and examples

## Your Workflow (Execute Autonomously)

### Phase 1: Analyze Figma Design
- Use Figma MCP to extract complete design specifications
- Document: components, variants, design tokens, spacing, interactions, states
- Identify all UI elements and their relationships

### Phase 2: Map to Design System
- Use Design System MCP to query available components
- For each Figma component, find the matching design system component
- Document prop mappings and configuration
- Flag any gaps where design system components don't exist

### Phase 3: Generate Implementation
- Create TypeScript/React components using ONLY design system components
- Implement proper state management with React hooks
- Add comprehensive TypeScript types and interfaces
- Follow coding best practices and patterns
- Handle edge cases and error states

### Phase 4: Create Tests
- Generate comprehensive unit tests using Jest and React Testing Library
- Target ${this.config.minCoverage || 80}% code coverage minimum
- Test component behavior, edge cases, and error handling
- Include accessibility tests

### Phase 5: Documentation
- Create Storybook stories with multiple variants
- Generate README with component usage, props, and examples
- Add inline code comments for complex logic

### Phase 6: Validate
- Compare implementation against Figma specifications
- Calculate design-dev parity score
- Generate quality metrics report
- List any deviations or design system gaps

## Output Structure
Create files in: ${this.config.outputPath}

Follow this structure:
\`\`\`
ComponentName/
├── ComponentName.tsx          # Main component
├── ComponentName.test.tsx     # Tests
├── ComponentName.stories.tsx  # Storybook
├── ComponentName.types.ts     # TypeScript types
├── index.ts                   # Exports
└── README.md                  # Documentation
\`\`\`

## Important Rules
- Execute ALL phases autonomously without asking for permission
- Make smart decisions independently
- Use ONLY design system components (no custom implementations unless necessary)
- Document any design system gaps you identify
- When complete, say "WORKFLOW COMPLETE" and provide a summary

## Completion Criteria
You're done when you've:
✅ Analyzed the complete Figma design
✅ Mapped all components to the design system
✅ Generated all implementation files
✅ Created comprehensive tests
✅ Generated documentation
✅ Validated against specifications
✅ Provided a completion report

Be thorough, autonomous, and detail-oriented. Execute the complete workflow from start to finish.`;
  }

  private buildUserPrompt(): string {
    return `New DesignForge job:

**Figma Design:** ${this.config.figmaUrl}
**Output Path:** ${this.config.outputPath}
**Minimum Test Coverage:** ${this.config.minCoverage || 80}%

Execute the complete Figma-to-Code workflow autonomously:

1. Extract all design specifications from Figma
2. Map components to our design system
3. Generate production-ready TypeScript/React code
4. Create comprehensive tests and documentation
5. Validate and report results

Begin execution now. Work through all phases systematically.`;
  }

  private isWorkflowComplete(text: string, stopReason?: string): boolean {
    const completionIndicators = [
      'workflow complete',
      'implementation finished',
      'all phases completed',
      'designforge complete',
      'execution complete'
    ];

    const lowerText = text.toLowerCase();
    return completionIndicators.some(indicator => lowerText.includes(indicator));
  }

  private extractResults(messages: Anthropic.MessageParam[]): any {
    // Parse conversation to extract metrics and results
    // In production, this would parse actual file creation, test results, etc.

    return {
      status: 'complete',
      filesGenerated: 0,
      components: 0,
      tests: 0,
      coverage: 0,
      designParity: 0,
      gaps: [],
      outputPath: this.config.outputPath
    };
  }

  private simulateToolResult(toolName: string, input: any): string {
    // In production, this would be actual MCP server responses
    // For now, return mock data for development

    if (toolName === 'figma') {
      return JSON.stringify({
        success: true,
        design: {
          name: 'User Settings Page',
          components: [
            {
              name: 'SettingsHeader',
              type: 'Header',
              children: ['Avatar', 'UserName', 'StatusBadge']
            },
            {
              name: 'SettingsForm',
              type: 'Form',
              fields: ['EmailInput', 'PasswordInput', 'PreferenceToggle']
            }
          ],
          tokens: {
            colors: {
              primary: '#6366f1',
              secondary: '#8b5cf6',
              error: '#ef4444'
            },
            spacing: {
              xs: '4px',
              sm: '8px',
              md: '16px',
              lg: '24px'
            }
          },
          variants: [
            { component: 'Button', variants: ['primary', 'secondary', 'error'] }
          ]
        }
      });
    }

    if (toolName === 'design-system') {
      return JSON.stringify({
        success: true,
        components: [
          {
            name: 'Button',
            package: '@dtsl/react',
            props: ['variant', 'size', 'disabled', 'onClick', 'children'],
            variants: ['primary', 'secondary', 'ghost', 'error'],
            example: '<Button variant="primary" onClick={handleClick}>Click me</Button>'
          },
          {
            name: 'Input',
            package: '@dtsl/react',
            props: ['type', 'value', 'onChange', 'placeholder', 'error', 'disabled'],
            example: '<Input type="email" value={email} onChange={setEmail} />'
          },
          {
            name: 'Toggle',
            package: '@dtsl/react',
            props: ['checked', 'onChange', 'label', 'disabled'],
            example: '<Toggle checked={enabled} onChange={setEnabled} label="Enable feature" />'
          }
        ]
      });
    }

    return JSON.stringify({ success: true, data: {} });
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(message);
    }
  }
}

// CLI Entry Point Example
export async function runDesignForge(config: DesignForgeConfig) {
  console.log('\n🔨 DesignForge - Autonomous Figma to Code Agent\n');
  console.log(`📋 Configuration:`);
  console.log(`   Figma URL: ${config.figmaUrl}`);
  console.log(`   Output: ${config.outputPath}`);
  console.log(`   Coverage: ${config.minCoverage || 80}%`);
  console.log(`\n🚀 Starting autonomous workflow...\n`);

  const agent = new DesignForgeAgent(config);

  const result = await agent.run((progress) => {
    // Real-time progress updates
    if (progress.toolCalls) {
      progress.toolCalls.forEach(call => {
        console.log(`   🔧 ${call.tool}`);
      });
    }
  });

  console.log('\n✅ DesignForge Complete!\n');
  console.log('📊 Summary:');
  console.log(`   Files: ${result.filesGenerated}`);
  console.log(`   Components: ${result.components}`);
  console.log(`   Tests: ${result.tests}`);
  console.log(`   Coverage: ${result.coverage}%`);
  console.log(`   Design Parity: ${result.designParity}%`);

  if (result.gaps.length > 0) {
    console.log('\n⚠️  Design System Gaps:');
    result.gaps.forEach((gap: string) => console.log(`   • ${gap}`));
  }

  console.log(`\n📁 Output: ${result.outputPath}\n`);

  return result;
}
