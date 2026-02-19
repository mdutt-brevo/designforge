import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// ==============================================================================
// MCP Server Configuration
// ==============================================================================
// Each entry describes one MCP server the agent should connect to.
// The bridge supports two transport modes:
//   - stdio: spawns a local process (e.g. `npx figma-developer-mcp --stdio`)
//   - http:  connects to a remote HTTP endpoint (e.g. `https://naos-mcp.51b.dev/mcp`)

export interface McpStdioServer {
  name: string;
  transport: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpHttpServer {
  name: string;
  transport: 'http';
  url: string;
  headers?: Record<string, string>;
}

export type McpServerConfig = McpStdioServer | McpHttpServer;

// ==============================================================================
// Tool Descriptor
// ==============================================================================
// Returned by getTools() after connecting. Each tool includes which server
// owns it, so callers can understand the tool landscape.

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
  serverName: string;
}

// ==============================================================================
// McpBridge
// ==============================================================================
// Connects to one or more MCP servers, discovers their tools, and routes
// tool calls to the correct server. This replaces the mock simulateToolResult()
// layer in the agent loop.
//
// Lifecycle: construct → connect() → callTool() / getTools() → disconnect()

export class McpBridge {
  private clients: Map<string, Client> = new Map();
  private toolMap: Map<string, string> = new Map();
  private tools: McpToolDescriptor[] = [];

  constructor(
    private servers: McpServerConfig[],
    private verbose: boolean = false,
  ) {}

  async connect(): Promise<void> {
    for (const server of this.servers) {
      const client = new Client(
        { name: 'designforge', version: '0.1.0' },
      );

      let transport: StdioClientTransport | StreamableHTTPClientTransport;

      if (server.transport === 'stdio') {
        transport = new StdioClientTransport({
          command: server.command,
          args: server.args,
          env: server.env,
        });
      } else {
        const opts = server.headers
          ? { requestInit: { headers: server.headers } }
          : undefined;
        transport = new StreamableHTTPClientTransport(
          new URL(server.url),
          opts,
        );
      }

      this.log(`Connecting to MCP server: ${server.name}...`);

      try {
        await client.connect(transport);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.log(`  Failed to connect to ${server.name}: ${message}`);
        throw new Error(`MCP server ${server.name} connection failed: ${message}`);
      }

      this.clients.set(server.name, client);

      // Discover tools exposed by this server
      const { tools } = await client.listTools();
      for (const tool of tools) {
        this.toolMap.set(tool.name, server.name);
        this.tools.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema as McpToolDescriptor['inputSchema'],
          serverName: server.name,
        });
      }

      this.log(
        `  Connected. ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`,
      );
    }
  }

  /**
   * All tools discovered across every connected server.
   */
  getTools(): McpToolDescriptor[] {
    return this.tools;
  }

  /**
   * Route a tool call to the server that owns it.
   * Returns the text content from the MCP response as a string.
   * On error, returns a JSON string with `{ error: true, message }`.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const serverName = this.toolMap.get(name);
    if (!serverName) {
      return JSON.stringify({
        error: true,
        message: `Unknown tool: "${name}". Available: ${[...this.toolMap.keys()].join(', ')}`,
      });
    }

    const client = this.clients.get(serverName);
    if (!client) {
      return JSON.stringify({
        error: true,
        message: `Server "${serverName}" is not connected`,
      });
    }

    this.log(`  Calling ${name} on ${serverName}...`);

    try {
      const result = await client.callTool({ name, arguments: args });

      // The SDK's CallToolResult uses an index signature that makes
      // .content resolve to `unknown` under strict mode. We cast
      // to the concrete union so the type guard works correctly.
      type ContentBlock = { type: string; text?: string };
      const content = result.content as ContentBlock[];

      if (result.isError) {
        const errorText = content
          .filter((c): c is ContentBlock & { type: 'text'; text: string } => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        return JSON.stringify({ error: true, message: errorText });
      }

      // Extract text content from the MCP response
      const textParts = content
        .filter((c): c is ContentBlock & { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text);

      return textParts.join('\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`  Tool call failed: ${message}`);
      return JSON.stringify({ error: true, message });
    }
  }

  /**
   * Gracefully close all MCP server connections.
   */
  async disconnect(): Promise<void> {
    const disconnectPromises = [...this.clients.entries()].map(
      async ([name, client]) => {
        this.log(`Disconnecting from ${name}...`);
        try {
          await client.close();
        } catch {
          // Swallow close errors — the process may already be gone
        }
      },
    );
    await Promise.all(disconnectPromises);

    this.clients.clear();
    this.toolMap.clear();
    this.tools = [];
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[McpBridge] ${message}`);
    }
  }
}
