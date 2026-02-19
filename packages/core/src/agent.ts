import Anthropic from '@anthropic-ai/sdk';
import { McpBridge, type McpServerConfig } from './mcp-bridge';
import { parseCodeBlocks, writeCodeBlocks } from './file-writer';

export interface DesignForgeConfig {
  figmaUrl: string;
  outputPath: string;
  anthropicApiKey: string;
  minCoverage?: number;
  maxTurns?: number;
  verbose?: boolean;
  baseURL?: string;
  model?: string;
  mcpServers?: McpServerConfig[];
}

export interface AgentProgress {
  turn: number;
  status: 'running' | 'complete' | 'error';
  message: string;
  toolCalls?: Array<{ tool: string; input: any }>;
  result?: any;
}

// ==============================================================================
// Pre-fetched design context
// ==============================================================================
// Gathered before the LLM loop starts so the model has all the data
// it needs in the initial prompt. This eliminates the need for multi-turn
// tool calling, which many local LLMs cannot handle reliably.

interface PrefetchedContext {
  figmaData: string | null;
  naosComponents: string | null;
  naosTokens: string | null;
  naosIcons: string | null;
}

export class DesignForgeAgent {
  private anthropic: Anthropic;
  private config: DesignForgeConfig;
  private conversationHistory: Anthropic.MessageParam[] = [];
  private mcpBridge: McpBridge | null = null;
  private prefetched: PrefetchedContext | null = null;

  constructor(config: DesignForgeConfig) {
    if (!config.anthropicApiKey) {
      throw new Error('API key is required');
    }
    this.config = config;
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
      baseURL: config.baseURL || 'http://127.0.0.1:1234',
    });
  }

  /**
   * Parse a Figma URL to extract the file key and optional node ID.
   * Handles URLs like:
   *   https://www.figma.com/design/ABCDEF/Name?node-id=123-456&m=dev
   *   https://www.figma.com/file/ABCDEF/Name
   */
  private parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } {
    // Extract file key from /design/<key>/ or /file/<key>/
    const keyMatch = url.match(/\/(?:design|file)\/([A-Za-z0-9]+)/);
    if (!keyMatch) {
      throw new Error(`Could not extract Figma file key from URL: ${url}`);
    }

    // Extract node ID from ?node-id=<id> query parameter
    const nodeMatch = url.match(/[?&]node-id=([^&]+)/);
    const nodeId = nodeMatch ? nodeMatch[1] : undefined;

    return { fileKey: keyMatch[1], nodeId };
  }

  /**
   * Pre-fetch all design context from MCP servers before the LLM loop.
   *
   * This is the critical architectural decision: rather than relying on
   * the LLM to orchestrate multi-turn tool calls (which local models
   * struggle with), we gather everything upfront and inject it into the
   * prompt. The LLM then only needs to generate code — a single-turn
   * task that even smaller models handle well.
   */
  private async prefetchData(): Promise<PrefetchedContext> {
    const ctx: PrefetchedContext = {
      figmaData: null,
      naosComponents: null,
      naosTokens: null,
      naosIcons: null,
    };

    if (!this.mcpBridge) return ctx;

    const tools = this.mcpBridge.getTools().map(t => t.name);
    const { fileKey, nodeId } = this.parseFigmaUrl(this.config.figmaUrl);

    // Fetch Figma data
    if (tools.includes('get_figma_data')) {
      this.log('\n📥 Pre-fetching Figma design data...');
      try {
        const args: Record<string, unknown> = { fileKey };
        if (nodeId) args.nodeId = nodeId;
        const raw = await this.mcpBridge.callTool('get_figma_data', args);
        // Cap to preserve context window
        ctx.figmaData = raw.length > 8_000 ? raw.slice(0, 8_000) + '\n[TRUNCATED]' : raw;
        this.log(`  ✅ Figma data: ${raw.length} chars (${ctx.figmaData.length} after cap)`);
      } catch (err) {
        this.log(`  ⚠️  Figma fetch failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Fetch Naos component docs
    if (tools.includes('get_naos_component_docs')) {
      this.log('📥 Pre-fetching Naos component docs...');
      try {
        const raw = await this.mcpBridge.callTool('get_naos_component_docs', {});
        ctx.naosComponents = raw.length > 6_000 ? raw.slice(0, 6_000) + '\n[TRUNCATED]' : raw;
        this.log(`  ✅ Naos components: ${raw.length} chars (${ctx.naosComponents.length} after cap)`);
      } catch (err) {
        this.log(`  ⚠️  Naos components fetch failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Fetch Naos design tokens
    if (tools.includes('get_naos_design_tokens')) {
      this.log('📥 Pre-fetching Naos design tokens...');
      try {
        const raw = await this.mcpBridge.callTool('get_naos_design_tokens', {});
        ctx.naosTokens = raw.length > 4_000 ? raw.slice(0, 4_000) + '\n[TRUNCATED]' : raw;
        this.log(`  ✅ Naos tokens: ${raw.length} chars (${ctx.naosTokens.length} after cap)`);
      } catch (err) {
        this.log(`  ⚠️  Naos tokens fetch failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    return ctx;
  }

  async run(onProgress?: (progress: AgentProgress) => void): Promise<any> {
    // Connect to MCP servers if configured. Without them, tool calls
    // fall back to the built-in mock layer (useful for tests/dev).
    if (this.config.mcpServers && this.config.mcpServers.length > 0) {
      this.mcpBridge = new McpBridge(
        this.config.mcpServers,
        this.config.verbose,
      );
      await this.mcpBridge.connect();
      this.log(`\nMCP bridge connected. Tools: ${this.mcpBridge.getTools().map(t => t.name).join(', ')}`);
    }

    try {
      // Pre-fetch all design context before starting the LLM loop.
      // This makes the agent work with any model (local or cloud)
      // by eliminating the need for multi-turn tool orchestration.
      this.prefetched = await this.prefetchData();
      return await this.executeLoop(onProgress);
    } finally {
      // Always disconnect, even if the loop throws
      if (this.mcpBridge) {
        await this.mcpBridge.disconnect();
        this.mcpBridge = null;
      }
    }
  }

  // Maximum characters per tool result. Responses beyond this are truncated
  // to preserve the local LLM's context window for multi-turn reasoning.
  private static readonly MAX_TOOL_RESULT_CHARS = 6_000;

  /**
   * Truncate a tool result if it exceeds the context budget.
   * Preserves the beginning of the response (most important metadata)
   * and appends a notice so the LLM knows the full data was larger.
   */
  private capToolResult(result: string): string {
    if (result.length <= DesignForgeAgent.MAX_TOOL_RESULT_CHARS) return result;

    const truncated = result.slice(0, DesignForgeAgent.MAX_TOOL_RESULT_CHARS);
    return (
      truncated +
      `\n\n[TRUNCATED — full response was ${result.length} characters. ` +
      `The key information is above. Proceed to the next phase of the workflow.]`
    );
  }

  private async executeLoop(onProgress?: (progress: AgentProgress) => void): Promise<any> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt();

    this.conversationHistory = [
      { role: 'user', content: userPrompt }
    ];

    let turn = 0;
    const maxTurns = this.config.maxTurns || 30;
    const allWrittenFiles: string[] = [];

    // Track tool calls to detect loops. Key: "toolName:argsJSON" → result.
    // When the LLM calls the same tool with the same args, we return the
    // cached result with a nudge instead of hitting the MCP server again.
    const previousToolCalls = new Map<string, string>();

    // Track which tool categories have been used for phase-aware prompting.
    const calledToolCategories = new Set<string>();

    // Count consecutive duplicate calls per tool name. After
    // MAX_CONSECUTIVE_DUPLICATES, the tool is stripped from the tools
    // list entirely, forcing the model to use different tools.
    const consecutiveDuplicates = new Map<string, number>();
    const blockedTools = new Set<string>();
    const MAX_CONSECUTIVE_DUPLICATES = 2;

    while (turn < maxTurns) {
      turn++;

      this.log(`\n🔨 DesignForge - Turn ${turn}/${maxTurns}`);

      onProgress?.({
        turn,
        status: 'running',
        message: `Processing turn ${turn}...`
      });

      // Trim conversation history if approaching context window limits.
      // Keeps the first message (job description) and recent turns.
      this.trimConversationHistory();

      // In prefetch mode, don't pass tools at all — the model should only
      // generate code. Passing tools to a weaker model just tempts it to
      // call them instead of writing code.
      const isPrefetchMode = !!(this.prefetched && this.prefetched.figmaData);
      const baseParams = {
        model: this.config.model || 'qwen/qwen3-coder-30b',
        max_tokens: 8000,
        system: systemPrompt,
        messages: this.conversationHistory,
      };

      const response = isPrefetchMode
        ? await this.anthropic.messages.create(baseParams)
        : await this.anthropic.messages.create({
            ...baseParams,
            tools: this.buildTools(blockedTools),
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

      // Parse code blocks from LLM output and write files to disk.
      // Each turn may produce zero or more files.
      if (fullText.includes('```')) {
        const codeBlocks = parseCodeBlocks(fullText);
        if (codeBlocks.length > 0) {
          const written = await writeCodeBlocks(codeBlocks, this.config.outputPath);
          allWrittenFiles.push(...written);
          for (const fp of written) {
            this.log(`  📄 Wrote: ${fp}`);
          }
        }
      }

      onProgress?.({
        turn,
        status: 'running',
        message: fullText,
        toolCalls
      });

      // Check for completion
      if (this.isWorkflowComplete(fullText, response.stop_reason || undefined)) {
        const result = this.extractResults(this.conversationHistory, allWrittenFiles);

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

      // Handle tool uses
      const toolUses = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === 'tool_use'
      );

      // Check if ALL tool calls in this turn target blocked tools.
      // If so, the model is stuck in a loop and we need to surgically
      // rewrite the conversation to break it out.
      const allBlocked = toolUses.length > 0 &&
        toolUses.every(tu => blockedTools.has(tu.name));

      if (allBlocked) {
        // The model keeps calling a blocked tool despite it being removed
        // from the tools list. This happens because local LLMs generate
        // tool calls based on conversation history patterns rather than
        // the tools schema. Fix: replace the broken turn with a synthetic
        // summary that moves the conversation forward.
        this.log('  🔄 Model stuck in loop — rewriting conversation to advance phase');

        // Build a summary of what data we already have
        const figmaDataSummary = previousToolCalls.size > 0
          ? `Here is a summary of the Figma data already fetched:\n${[...previousToolCalls.values()][0].slice(0, 1500)}`
          : 'Figma data was fetched but no summary is available.';

        // Replace the assistant's broken message with a synthetic one
        this.conversationHistory.push({
          role: 'assistant',
          content: 'Phase 1 is complete. I have analyzed the Figma design and extracted the specifications. Now I will proceed to Phase 2: mapping components to the Naos design system.',
        });

        // Add a strong redirect as the user message
        this.conversationHistory.push({
          role: 'user',
          content: `Good. Phase 1 (Figma analysis) is done. ${figmaDataSummary}\n\n` +
            `NOW PROCEED TO PHASE 2. You MUST call one of these Naos design system tools:\n` +
            `- get_naos_component_docs: to find matching @dtsl/react components\n` +
            `- get_naos_design_tokens: to get design tokens for styling\n` +
            `- get_naos_icons: to find available icons\n\n` +
            `DO NOT call get_figma_data again. Start Phase 2 now.`,
        });
        continue;
      }

      // Add assistant response to history (only for non-stuck turns)
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content
      });

      if (toolUses.length > 0) {
        // Route tool calls through the MCP bridge (real servers) or
        // fall back to mock responses when no bridge is configured.
        // Includes duplicate detection: if the LLM calls the same tool
        // with the same arguments twice, return a cached result + nudge
        // instead of re-fetching (prevents infinite loops on local LLMs).
        const toolResults = await Promise.all(
          toolUses.map(async (toolUse) => {
            const callKey = `${toolUse.name}:${JSON.stringify(toolUse.input)}`;
            let resultContent: string;

            if (previousToolCalls.has(callKey)) {
              // Duplicate call — return short cached summary + nudge
              const dupCount = (consecutiveDuplicates.get(toolUse.name) || 0) + 1;
              consecutiveDuplicates.set(toolUse.name, dupCount);
              this.log(`  ⚠️  Duplicate tool call detected: ${toolUse.name} (${dupCount}x, returning cached)`);

              // After MAX_CONSECUTIVE_DUPLICATES, block the tool entirely
              // so the LLM is forced to use different tools on the next turn.
              if (dupCount >= MAX_CONSECUTIVE_DUPLICATES) {
                blockedTools.add(toolUse.name);
                this.log(`  🚫 Blocking ${toolUse.name} — exceeded ${MAX_CONSECUTIVE_DUPLICATES} consecutive duplicates`);
              }

              const cached = previousToolCalls.get(callKey)!;
              resultContent =
                `[DUPLICATE CALL — you already called "${toolUse.name}" with these exact parameters ` +
                `on a previous turn and received the data. DO NOT call this tool again. ` +
                `Use the data you already have and proceed to the next phase of the workflow.]\n\n` +
                `Previous result summary (first 500 chars):\n${cached.slice(0, 500)}...`;
            } else {
              // Reset consecutive counter for this tool since it's a fresh call
              consecutiveDuplicates.set(toolUse.name, 0);
              // Fresh call — execute and cache
              const rawResult = this.mcpBridge
                ? await this.mcpBridge.callTool(
                    toolUse.name,
                    toolUse.input as Record<string, unknown>,
                  )
                : this.simulateToolResult(toolUse.name, toolUse.input);

              resultContent = this.capToolResult(rawResult);
              previousToolCalls.set(callKey, resultContent);
            }

            // Track which category of tool was used (for phase-aware prompting)
            const server = this.mcpBridge?.getTools().find(t => t.name === toolUse.name)?.serverName;
            if (server) calledToolCategories.add(server);

            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: resultContent,
            };
          }),
        );

        this.conversationHistory.push({
          role: 'user',
          content: toolResults
        });
      } else {
        // No tools used — provide phase-aware guidance so the LLM
        // knows where it is in the workflow and what to do next.
        const guidance = this.buildPhaseGuidance(calledToolCategories, allWrittenFiles);
        this.conversationHistory.push({
          role: 'user',
          content: guidance
        });
      }
    }

    throw new Error(`Agent did not complete within ${maxTurns} turns`);
  }

  /**
   * Build the tools array for the Anthropic API call.
   * When an MCP bridge is connected, converts discovered MCP tool schemas
   * (camelCase `inputSchema`) to Anthropic format (snake_case `input_schema`).
   * Falls back to hardcoded mock tools when no bridge is available.
   */
  private buildTools(blockedTools?: Set<string>): Anthropic.Messages.Tool[] {
    if (this.mcpBridge) {
      let mcpTools = this.mcpBridge.getTools();

      // Filter out tools that have been blocked due to repeated duplicate calls
      if (blockedTools && blockedTools.size > 0) {
        mcpTools = mcpTools.filter(t => !blockedTools.has(t.name));
        this.log(`  🚫 Blocked tools: ${[...blockedTools].join(', ')}`);
      }

      if (mcpTools.length > 0) {
        return mcpTools.map(tool => ({
          name: tool.name,
          description: tool.description || `Tool from ${tool.serverName}`,
          input_schema: {
            type: 'object' as const,
            properties: tool.inputSchema.properties ?? undefined,
            required: tool.inputSchema.required,
          },
        }));
      }
    }

    // Fallback: hardcoded mock tool definitions for dev/test mode
    return [
      {
        name: 'figma',
        description: 'Extract design specifications from Figma files including components, variants, design tokens, and interactions',
        input_schema: {
          type: 'object' as const,
          properties: {
            action: {
              type: 'string',
              enum: ['get_file', 'get_components', 'get_styles'],
              description: 'The action to perform',
            },
            file_url: {
              type: 'string',
              description: 'The Figma file URL',
            },
          },
          required: ['action', 'file_url'],
        },
      },
      {
        name: 'design-system',
        description: 'Query the design system for available components, their props, usage patterns, and examples',
        input_schema: {
          type: 'object' as const,
          properties: {
            action: {
              type: 'string',
              enum: ['list_components', 'get_component_details', 'search_components'],
              description: 'The action to perform',
            },
            component_name: {
              type: 'string',
              description: 'Optional component name to query',
            },
          },
          required: ['action'],
        },
      },
    ];
  }

  private buildSystemPrompt(): string {
    // When pre-fetched data is available, use a streamlined prompt focused
    // on code generation only. The model doesn't need tool-calling phases
    // since all data is already injected into the user prompt.
    if (this.prefetched && this.prefetched.figmaData) {
      return this.buildPrefetchedSystemPrompt();
    }

    // Full agentic prompt with tool-calling phases (for capable models)
    const toolsSection = this.buildToolsSection();

    return `You are DesignForge, an autonomous AI agent that converts Figma designs to production-ready code.

## Your Mission
Transform Figma designs into production code using the company's design system (Naos / @dtsl/react), following best practices for TypeScript, React, testing, and documentation.

${toolsSection}

## Design System: Naos (@dtsl/react)
The target design system is **Naos**, published as \`@dtsl/react\`. Key rules:
- Import components from \`@dtsl/react\` (e.g. \`import { Button, Input, Toggle } from '@dtsl/react'\`)
- Do NOT add custom CSS/LESS/SCSS to Naos components — they handle their own styling
- Use component props and variants for visual customization, not className overrides
- Only add custom styles for layout/positioning of Naos components within containers
- Use design tokens from the design system for any custom spacing or colors
- Query the design system tools to discover available components before implementing

## Your Workflow (Execute Autonomously)

### Phase 1: Analyze Figma Design
- Use Figma tools to extract complete design specifications
- Document: components, variants, design tokens, spacing, interactions, states
- Identify all UI elements and their relationships

### Phase 2: Map to Design System
- Use design system tools to query available Naos components
- For each Figma component, find the matching \`@dtsl/react\` component
- Document prop mappings and configuration
- Flag any gaps where design system components don't exist

### Phase 3: Generate Implementation
- Create TypeScript/React components using ONLY \`@dtsl/react\` components
- Implement proper state management with React hooks
- Add comprehensive TypeScript types and interfaces
- Define props with \`type\` or \`interface\` suffixed with \`Props\`
- Do NOT use \`React.FC\` — use plain function components
- Handle edge cases and error states

### Phase 4: Create Tests
- Generate comprehensive unit tests using Jest and React Testing Library
- Target ${this.config.minCoverage || 80}% code coverage minimum
- Prefer \`getByRole\` and \`getByLabelText\` queries over \`getByTestId\`
- Use \`@testing-library/user-event\` over \`fireEvent\`
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

## File Output Format
When generating file contents, use this EXACT format so the system can parse and write them:

\`\`\`tsx ComponentName/ComponentName.tsx
// file contents here
\`\`\`

The file path MUST appear after the language tag in the code fence opening line.
Use paths relative to the output directory.

## Important Rules
- Execute ALL phases autonomously without asking for permission
- Make smart decisions independently
- Use ONLY \`@dtsl/react\` components (no custom implementations unless necessary)
- Document any design system gaps you identify
- When complete, say "WORKFLOW COMPLETE" and provide a summary

## Completion Criteria
You're done when you've:
- Analyzed the complete Figma design
- Mapped all components to the design system
- Generated all implementation files
- Created comprehensive tests
- Generated documentation
- Validated against specifications
- Provided a completion report

Be thorough, autonomous, and detail-oriented. Execute the complete workflow from start to finish.`;
  }

  /**
   * Streamlined system prompt used when pre-fetched data is available.
   * Shorter and focused on code generation — no tool-calling instructions.
   * This keeps the context window budget for the actual design data and
   * generated code rather than wasting it on phase orchestration.
   */
  private buildPrefetchedSystemPrompt(): string {
    return `You are DesignForge, a code generation agent. Your job is to convert Figma design data into production-ready React/TypeScript code using the Naos design system (@dtsl/react).

## Rules
- Import components from \`@dtsl/react\` (Button, Input, Toggle, etc.)
- Do NOT add custom CSS to Naos components — they handle their own styling
- Define props with \`type\` or \`interface\` suffixed with \`Props\`
- Do NOT use \`React.FC\` — use plain function components
- Use \`@testing-library/user-event\` and \`getByRole\` queries in tests
- Target ${this.config.minCoverage || 80}% test coverage

## File Output Format
Output each file using this EXACT format:

\`\`\`tsx ComponentName/ComponentName.tsx
// file contents here
\`\`\`

The file path MUST appear after the language tag. Use paths relative to \`${this.config.outputPath}\`.

## Component Structure
\`\`\`
ComponentName/
├── ComponentName.tsx          # Main component
├── ComponentName.test.tsx     # Tests
├── ComponentName.stories.tsx  # Storybook
├── index.ts                   # Exports
\`\`\`

## Instructions
All Figma design data and Naos component docs are provided in the user message.
DO NOT call any tools. Generate all files directly.
When done, say "WORKFLOW COMPLETE" with a summary of files generated.`;
  }

  /**
   * Build the "Available Tools" section of the system prompt.
   * When an MCP bridge is connected, lists the real tool names and
   * descriptions discovered from each server. Otherwise uses generic text.
   */
  private buildToolsSection(): string {
    if (!this.mcpBridge) {
      return `## Available Tools
1. **Figma MCP** — Extract design specifications, components, variants, tokens, and interactions
2. **Design System MCP** — Query available components, their props, usage patterns, and examples`;
    }

    const tools = this.mcpBridge.getTools();
    if (tools.length === 0) {
      return '## Available Tools\nNo tools discovered from MCP servers.';
    }

    // Group tools by server
    const byServer = new Map<string, typeof tools>();
    for (const tool of tools) {
      const group = byServer.get(tool.serverName) ?? [];
      group.push(tool);
      byServer.set(tool.serverName, group);
    }

    let section = '## Available Tools\n';
    for (const [serverName, serverTools] of byServer) {
      section += `\n### ${serverName} server\n`;
      for (const tool of serverTools) {
        section += `- **${tool.name}**: ${tool.description || 'No description'}\n`;
      }
    }

    return section;
  }

  /**
   * Build a phase-aware continuation prompt based on what the agent has
   * already done. This prevents the LLM from repeating earlier phases
   * (especially common with smaller local models that lose context).
   */
  private buildPhaseGuidance(
    calledCategories: Set<string>,
    writtenFiles: string[],
  ): string {
    const parts: string[] = [];

    if (calledCategories.has('figma') && !calledCategories.has('naos')) {
      parts.push(
        'You have already fetched the Figma design data. DO NOT call get_figma_data again.',
        'Now proceed to Phase 2: use the Naos design system tools (get_naos_component_docs, get_naos_design_tokens) to map Figma components to @dtsl/react components.',
      );
    } else if (calledCategories.has('figma') && calledCategories.has('naos') && writtenFiles.length === 0) {
      parts.push(
        'You have fetched both Figma data and Naos design system data.',
        'DO NOT call get_figma_data or get_naos_component_docs again.',
        'Now proceed to Phase 3: generate the React/TypeScript implementation files using @dtsl/react components.',
        'Output each file using the code fence format with the file path after the language tag.',
      );
    } else if (writtenFiles.length > 0) {
      parts.push(
        `You have generated ${writtenFiles.length} files so far.`,
        'Continue generating remaining files (tests, stories, documentation) or say "WORKFLOW COMPLETE" if all phases are done.',
      );
    } else {
      parts.push('Continue with the next step in the workflow.');
    }

    return parts.join('\n');
  }

  private buildUserPrompt(): string {
    const parts: string[] = [];

    parts.push(`New DesignForge job:

**Figma Design:** ${this.config.figmaUrl}
**Output Path:** ${this.config.outputPath}
**Minimum Test Coverage:** ${this.config.minCoverage || 80}%`);

    // When pre-fetched data is available, inject it directly so the LLM
    // doesn't need to call tools at all. This makes the workflow work
    // reliably with any model, including smaller local LLMs.
    if (this.prefetched) {
      if (this.prefetched.figmaData) {
        parts.push(`\n## Figma Design Data (pre-fetched)\nPhase 1 is ALREADY DONE. Here is the extracted Figma design:\n\n${this.prefetched.figmaData}`);
      }
      if (this.prefetched.naosComponents) {
        parts.push(`\n## Naos Design System Components (pre-fetched)\nPhase 2 data is ALREADY AVAILABLE. Here are the available @dtsl/react components:\n\n${this.prefetched.naosComponents}`);
      }
      if (this.prefetched.naosTokens) {
        parts.push(`\n## Naos Design Tokens (pre-fetched)\n${this.prefetched.naosTokens}`);
      }

      parts.push(`\n## Your Task
Phases 1 and 2 are COMPLETE — all data is above. DO NOT call any tools.
Skip straight to Phase 3: generate the implementation files.

For each component found in the Figma data:
1. Map it to a @dtsl/react component from the list above
2. Generate the .tsx component file
3. Generate the .test.tsx test file
4. Generate the .stories.tsx Storybook file

Output each file using this EXACT format:
\`\`\`tsx ComponentName/ComponentName.tsx
// file contents here
\`\`\`

When all files are generated, say "WORKFLOW COMPLETE" with a summary.
Begin generating code NOW.`);
    } else {
      parts.push(`\nExecute the complete Figma-to-Code workflow autonomously:

1. Extract all design specifications from Figma
2. Map components to our design system
3. Generate production-ready TypeScript/React code
4. Create comprehensive tests and documentation
5. Validate and report results

Begin execution now. Work through all phases systematically.`);
    }

    return parts.join('\n');
  }

  /**
   * Estimate the character count of the conversation history.
   * Used for context window management — a rough proxy for token count
   * since most LLMs average ~4 characters per token.
   */
  private estimateHistoryChars(): number {
    let chars = 0;
    for (const msg of this.conversationHistory) {
      if (typeof msg.content === 'string') {
        chars += msg.content.length;
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if ('text' in block && typeof block.text === 'string') {
            chars += block.text.length;
          } else if ('content' in block && typeof block.content === 'string') {
            chars += block.content.length;
          } else {
            // Tool use blocks, images, etc. — rough estimate
            chars += JSON.stringify(block).length;
          }
        }
      }
    }
    return chars;
  }

  /**
   * Trim conversation history when it exceeds the context budget.
   * Preserves the first message (job description) and keeps the most
   * recent messages. Drops middle turns to stay within limits.
   *
   * Budget: ~100k chars ≈ ~25k tokens — conservative for a 32k context
   * window model, leaving room for system prompt + tools + response.
   */
  private trimConversationHistory(): void {
    const MAX_HISTORY_CHARS = 100_000;
    const chars = this.estimateHistoryChars();

    if (chars <= MAX_HISTORY_CHARS) return;

    // Always keep the first message (the job description)
    const firstMessage = this.conversationHistory[0];
    const rest = this.conversationHistory.slice(1);

    // Drop oldest messages (in pairs: assistant + user) until under budget.
    // Messages come in pairs after the first: [assistant, user, assistant, user, ...]
    let trimmedChars = chars;
    let dropCount = 0;

    while (trimmedChars > MAX_HISTORY_CHARS && dropCount < rest.length - 2) {
      const msg = rest[dropCount];
      if (typeof msg.content === 'string') {
        trimmedChars -= msg.content.length;
      } else {
        trimmedChars -= JSON.stringify(msg.content).length;
      }
      dropCount++;
    }

    // Make sure we drop in pairs to keep alternating user/assistant pattern
    if (dropCount % 2 !== 0) dropCount++;

    if (dropCount > 0) {
      this.log(`  ✂️  Trimmed ${dropCount} old messages from context (${chars} → ${trimmedChars} chars)`);
      this.conversationHistory = [firstMessage, ...rest.slice(dropCount)];
    }
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

  private extractResults(
    messages: Anthropic.MessageParam[],
    writtenFiles: string[] = [],
  ): any {
    // Categorize written files by extension/pattern
    const components = writtenFiles.filter(f => /\.tsx$/.test(f) && !f.includes('.test.') && !f.includes('.stories.'));
    const tests = writtenFiles.filter(f => f.includes('.test.'));
    const stories = writtenFiles.filter(f => f.includes('.stories.'));

    return {
      status: 'complete',
      filesGenerated: writtenFiles.length,
      components: components.length,
      tests: tests.length,
      stories: stories.length,
      coverage: 0, // TODO: run tests and capture coverage
      designParity: 0, // TODO: compare with Figma specs
      gaps: [],
      outputPath: this.config.outputPath,
      files: writtenFiles,
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
