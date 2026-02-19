# DesignForge: The Story of Teaching a Local AI to Read Figma

> *How we built an autonomous agent that converts Figma designs into
> production React code -- and the infinite loop that nearly killed it.*

---

## Table of Contents

1. [The Problem Nobody Likes Talking About](#the-problem-nobody-likes-talking-about)
2. [The Bet: What If We Never Called the Cloud?](#the-bet-what-if-we-never-called-the-cloud)
3. [Architecture Overview](#architecture-overview)
4. [The Fork in the Road](#the-fork-in-the-road)
5. [Building the Bridge](#building-the-bridge)
6. [The 13-Task Battle Plan](#the-13-task-battle-plan)
7. [Parsing the Unparseable](#parsing-the-unparseable)
8. [Testing Like Rocket Scientists](#testing-like-rocket-scientists)
9. [The Loop That Wouldn't Die](#the-loop-that-wouldnt-die)
10. [Five Fixes, One Escalating War](#five-fixes-one-escalating-war)
11. [When Signs Don't Work, Remove the Door](#when-signs-dont-work-remove-the-door)
12. [The Model Quality Reckoning](#the-model-quality-reckoning)
13. [Technical Appendix: Things Worth Knowing](#technical-appendix-things-worth-knowing)
14. [Where We Are, Where We're Going](#where-we-are-where-were-going)
15. [Lessons Learned](#lessons-learned)

---

## The Problem Nobody Likes Talking About

Every team has a process they tolerate because it has always been that
way. For us, it was the Figma handoff.

Here is how it works at most companies: a designer spends days
perfecting a Figma file. They click "Share," write a Slack message that
says "designs are ready," and then a developer opens the file and begins
the slow, tedious process of translating pixels into code. They
squint at padding values. They guess at which design token maps to
`--color-primary-600`. They build a `<div>` that looks right, ship it,
and then a QA engineer files a ticket because the border radius is
`4px` instead of `6px`.

This is not a technology problem. It is a *translation* problem. The
information already exists in Figma -- every color, every spacing value,
every component variant. It just needs to be extracted, mapped to the
right design system component, and assembled into code that follows the
team's conventions.

DesignForge automates that entire pipeline. You give it a Figma URL and
an output directory. It connects to the Figma file, reads every node and
style, maps them to Brevo's Naos design system (`@dtsl/react`), and
generates production-ready React/TypeScript components, tests, and
Storybook stories.

No squinting. No guessing. No `4px` vs `6px` debates.

---

## The Bet: What If We Never Called the Cloud?

Here is where the story gets interesting.

The obvious approach would be to call the OpenAI or Anthropic API, pay
per token, and move on. But we had a constraint -- or rather, a
conviction. We wanted to run everything locally. Free. Private. No API
keys needed for the LLM itself.

The setup:

| Component   | Choice                                         |
|-------------|-------------------------------------------------|
| LLM Runtime | LM Studio (local, running at `127.0.0.1:1234`) |
| Model       | `qwen/qwen3-coder-30b` (MLX, 4-bit quant, MoE) |
| SDK         | `@anthropic-ai/sdk` pointed at localhost        |
| Cost        | $0.00 per token, forever                        |

The model is a Mixture-of-Experts architecture: 30 billion total
parameters, but only 3 billion active on any given token. This means it
runs on a MacBook Pro without melting the desk, but it also means the
model is operating at roughly the intelligence of a 3B-parameter model
for any single reasoning step.

Why did we pick the Anthropic SDK to talk to a local model? That is the
next part of the story.

---

## Architecture Overview

DesignForge is a monorepo with two packages, managed via npm workspaces:

```
designforge/
  packages/
    core/          -- Agent brain, MCP bridge, file writer, code parser
      src/
        agent.ts        -- DesignForgeAgent class (the agentic loop)
        mcp-bridge.ts   -- MCP client connecting to Figma + Naos servers
        file-writer.ts  -- Code block parser + disk writer
        index.ts        -- Public API surface
    cli/           -- Terminal interface
      src/
        cli.ts          -- Commander.js CLI with 5 commands
  scripts/
    test-mcp-connectivity.ts   -- Layer 2 integration test
    test-single-turn.ts        -- Layer 3 integration test
  designforge.config.js        -- Runtime configuration
```

The core package exposes three modules that form a pipeline:

```
  Figma URL
     |
     v
  [McpBridge]  ---connects-to---> Figma MCP Server (stdio)
     |                            Naos MCP Server  (HTTP)
     v
  [DesignForgeAgent]  ---calls---> LM Studio (Anthropic-compatible API)
     |
     v
  [parseCodeBlocks]  ---extracts---> fenced code from LLM markdown
     |
     v
  [writeCodeBlocks]  ---writes---> .tsx, .test.tsx, .stories.tsx to disk
```

The CLI (`packages/cli/src/cli.ts`) provides five commands:

| Command           | Purpose                                      |
|-------------------|----------------------------------------------|
| `start`           | Run the full Figma-to-code workflow           |
| `watch`           | Monitor Figma for changes and rebuild (TODO)  |
| `interactive`     | Guided prompts via Inquirer                   |
| `debug`           | Check environment variables and connectivity  |
| `validate-config` | Load and display `designforge.config.js`      |

Configuration flows through a priority chain: **CLI flags > environment
variables > designforge.config.js > hardcoded defaults**. The
`loadConfigFile()` function uses dynamic `import()` to handle both ESM
`export default` and CJS `module.exports` transparently.

---

## The Fork in the Road

The first architectural decision we faced was how to connect the LLM to
MCP (Model Context Protocol) tools. There were two paths.

### Path A: LM Studio Native MCP

LM Studio has built-in MCP support through its `/api/v1/chat` endpoint.
On paper, this sounds perfect -- let the runtime handle tool routing,
and we just configure servers in the LM Studio UI.

But there was a catch. LM Studio's native MCP uses the **OpenAI chat
format**, not the Anthropic messages format. Switching would mean:

- Rewriting the entire agent to use the OpenAI SDK
- Adopting a different tool-calling format (`function_call` instead of
  `tool_use` content blocks)
- Losing compatibility with the Anthropic API if we ever wanted to swap
  in Claude for higher-quality output

### Path B: Keep the Anthropic SDK, Build Our Own Bridge

Keep using `@anthropic-ai/sdk` pointed at LM Studio's Anthropic-
compatible `/v1/messages` endpoint. Build a custom `McpBridge` class
that:

1. Connects to MCP servers independently (stdio and HTTP transports)
2. Discovers tools at startup by calling `listTools()`
3. Routes tool calls from the LLM to the correct server
4. Returns results back into the conversation

### The Decision: Path B

Four reasons:

1. **The Anthropic SDK is free.** It is an open-source npm package. You
   do not need an Anthropic API key to use it as an HTTP client. Set
   `baseURL` to `http://127.0.0.1:1234`, set `apiKey` to any non-empty
   string (`'lm-studio'` works fine), and it becomes a generic HTTP
   client for any server that implements the `/v1/messages` endpoint.

2. **Future flexibility.** Want to switch to real Claude? Change one
   environment variable (`ANTHROPIC_BASE_URL`). The agent code does not
   change at all.

3. **Separation of concerns.** The agent loop does not care how tools
   are transported. It calls `buildTools()` to get tool definitions and
   the bridge handles the rest.

4. **LM Studio's native MCP was experimental.** At the time we made
   this decision, the documentation was sparse and the behavior was
   inconsistent. We did not want to build on quicksand.

This decision shaped everything that followed.

---

## Building the Bridge

The `McpBridge` class (in `packages/core/src/mcp-bridge.ts`) is the
diplomatic layer between our agent and the outside world. It speaks two
transport dialects:

**stdio** -- For the Figma MCP server. The bridge spawns
`npx figma-developer-mcp --stdio` as a child process and communicates
via stdin/stdout. This is how most MCP servers designed for local use
work.

**HTTP** -- For the Naos MCP server. The bridge connects to
`https://naos-mcp.51b.dev/mcp` over the network using the MCP SDK's
`StreamableHTTPClientTransport`.

### The Type System

```typescript
interface McpStdioServer {
  name: string;
  transport: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpHttpServer {
  name: string;
  transport: 'http';
  url: string;
  headers?: Record<string, string>;
}

type McpServerConfig = McpStdioServer | McpHttpServer;
```

The discriminated union on the `transport` field means TypeScript
narrows the type automatically. When `transport === 'stdio'`, you get
`command` and `args`. When `transport === 'http'`, you get `url` and
`headers`. No runtime checks needed.

### Tool Discovery

After connecting, the bridge calls `client.listTools()` on each server
and builds a unified registry:

```typescript
interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  serverName: string;     // Which server owns this tool
}
```

The `serverName` field is crucial. When the LLM says "call
`get_figma_data`", the bridge looks up which server owns that tool and
routes the call accordingly.

### The CJS/ESM Challenge

A subtle gotcha: the MCP SDK (`@modelcontextprotocol/sdk`) requires
`.js` extensions in import paths for runtime `require()` resolution:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
```

But TypeScript with `moduleResolution: "node"` normally would not
resolve types from paths ending in `.js`. The SDK handles this via the
`typesVersions` field in its `package.json`, which remaps type lookups.
We did not need to change our `tsconfig.json` -- it just works, as long
as you do not overthink it and start removing the `.js` extensions.

---

## The 13-Task Battle Plan

Before writing a single line of code, we broke the entire project into
13 atomic tasks. This is not busywork -- it is load-bearing structure.
Each task has a clear input, a clear output, and a clear "done"
condition.

| #  | Task                       | What It Proved                           |
|----|----------------------------|------------------------------------------|
| 1  | Validate LLM connectivity  | LM Studio + Anthropic SDK actually works |
| 2  | Wire configuration         | Env vars, API keys, config file loading  |
| 3  | Fix initial test failures  | Baseline green before adding complexity  |
| 4  | Build MCP Bridge           | The big one -- stdio + HTTP transports   |
| 5  | Connect Figma MCP (stdio)  | Child process spawning, tool discovery   |
| 6  | Connect Naos MCP (HTTP)    | Remote transport, authentication         |
| 7  | Dynamic tool discovery     | MCP schemas -> Anthropic tool format     |
| 8  | Code block parser + writer | Extract files from LLM markdown output   |
| 9  | Extract results            | Categorize written files by type         |
| 10 | Enhanced system prompt     | Dynamic tools section, Naos guidance     |
| 11 | Context window management  | Sliding window trimming at ~100k chars   |
| 12 | Config file loading        | `designforge.config.js` with priorities  |
| 13 | Investigate LM Studio MCP  | Research task (led to Path A/B decision) |

Task 4 was the linchpin. Everything before it was preparation.
Everything after it depended on the bridge working. We spent more time
on the bridge than on any other single component, and that investment
paid off when the loop problem hit -- because we could trust that the
plumbing worked and focus entirely on the agent logic.

---

## Parsing the Unparseable

When an LLM generates code, it wraps it in markdown fenced code blocks.
Simple, right? Not when you need to figure out *where each file goes*.

The file writer (`packages/core/src/file-writer.ts`) needs to extract a
file path from each code block. LLMs are inconsistent about how they
indicate file paths, so we support four patterns, checked in priority
order:

**1. Explicit attribute** (most reliable, but rare):
````
```tsx filename="Button/Button.tsx"
````

**2. Info-string path** (most common with good prompting):
````
```tsx Button/Button.tsx
````

**3. First-line comment** (fallback when the LLM uses a comment):
````
```tsx
// Button/Button.tsx
````

**4. Preceding context** (last resort -- look at what the LLM said
before the code block):
```
**File:** Button.tsx

\`\`\`tsx
```

Blocks without a recognizable path are silently skipped. They are
usually inline examples in the LLM's explanation, not actual files.

### The Regex Bug That Broke Three Tests

The original `CODE_FENCE_REGEX` looked like this:

```
/^```(\w*)\s*(.*?)\n([\s\S]*?)^```$/gm
```

See the `\s*` between the language tag and the info string? The `\s`
character class matches **any whitespace, including newlines**. So when
the LLM wrote:

````
```tsx Button/Button.tsx
````

The `\s*` would match the space between `tsx` and `Button/Button.tsx`
correctly. But when there was no info string:

````
```tsx
// some code
````

The `\s*` would consume the newline, shifting the capture groups by one
line. The "info string" capture would grab `// some code` (the first
line of the body), and the "content" capture would miss the first line
entirely.

Three tests failed. The fix was one character class change:

```
/^```(\w*)[ \t]*(.*?)\n([\s\S]*?)^```$/gm
```

`[ \t]*` matches only horizontal whitespace -- spaces and tabs. The
newline stays where it belongs.

### Directory Traversal Protection

The LLM's output is untrusted input. If it generates a file path like
`../../etc/passwd`, we should not blindly write there. The
`writeCodeBlocks` function resolves every path and checks that it falls
under the output directory:

```typescript
const fullPath = path.resolve(outputPath, block.filePath);
const resolvedOutput = path.resolve(outputPath);
if (!fullPath.startsWith(resolvedOutput)) {
  continue; // Skip paths that escape the output directory
}
```

This is a simple check, but it is the difference between a tool and a
vulnerability.

---

## Testing Like Rocket Scientists

You do not test a rocket by launching it to orbit on the first try. You
test the fuel system. Then you fire the engine on the ground. Then you
do a short hop. *Then* you try orbit.

We built four testing layers, each one isolating a different failure
mode:

### Layer 1: Unit Tests

18 Jest tests covering the core modules:

- Agent construction and configuration validation
- Code block parsing (all four path detection strategies)
- File writing with directory creation
- Results extraction and categorization

Run with: `cd packages/core && npx jest`

These tests use no network, no LLM, no MCP servers. If they fail, our
code is broken.

### Layer 2: MCP Connectivity

Script: `scripts/test-mcp-connectivity.ts`

This layer connects to both MCP servers, lists their tools, and calls
`hi_naos` as a smoke test. It validates that the bridge works
independently of the LLM.

The result: **7 tools discovered** (2 from Figma, 5 from Naos).

If Layer 2 fails, our bridge or the MCP servers are broken. But our
code and the LLM might be fine.

### Layer 3: Single-Turn Integration

Script: `scripts/test-single-turn.ts`

This layer runs the full agent with real MCP servers, but limits it to
**2 turns**. That is just enough to see:

1. Does the LLM generate a tool call?
2. Does the bridge route it correctly?
3. Does the LLM receive the response?

The 2-turn limit means "Agent did not complete within 2 turns" is the
**expected** outcome. We are not testing for completion -- we are testing
for communication.

The result: the LLM called `get_figma_data` on turn 1 and `hi_naos` on
turn 2. Tool routing works.

### Layer 4: Full Workflow

A real Figma file (`Conversions---ROI` design), real MCP servers, 10-15
turns. This is the orbit attempt.

This is where we discovered The Loop Problem.

### Why Layers Matter

| Layer | What It Isolates                     | If It Fails...             |
|-------|--------------------------------------|----------------------------|
| 1     | Our code logic                       | We wrote a bug             |
| 2     | External server connectivity         | MCP servers are down/wrong |
| 3     | LLM <-> tool communication           | SDK/format mismatch        |
| 4     | LLM multi-turn reasoning capability  | The model is not capable   |

By the time we hit the Layer 4 failure, we had already eliminated every
other variable. We *knew* the bridge worked. We *knew* the tools
responded. We *knew* the LLM could call tools on a single turn. The
problem was not plumbing. The problem was the model's ability to reason
across multiple turns.

That certainty is what made the debugging fast.

---

## The Loop That Wouldn't Die

When we ran Layer 4 with a real Figma file, something went wrong.

Turn 1: *"I'll execute the complete Figma-to-Code workflow. Let me start
by analyzing the Figma design..."* -- calls `get_figma_data` with
`fileKey: "abc123"` and `nodeId: "456-789"`.

Gets back a YAML response: 1 node, 18 styles, approximately 8,056
characters.

Turn 2: *"I'll execute the complete Figma-to-Code workflow. Let me start
by analyzing the Figma design..."* -- calls `get_figma_data` with
**the exact same parameters**.

Gets back the exact same YAML.

Turn 3: The same message. The same call.

Turn 4. Turn 5. Turn 6.

**Ten turns. Ten identical calls. Zero progress.**

The model was stuck in a loop. Every turn, it reset to the beginning of
the workflow as if the previous turns had never happened. It was like
talking to someone with perfect amnesia -- they hear you, they respond
coherently, but the next sentence starts from scratch.

This is not a bug in our code. This is a fundamental limitation of how
smaller language models handle multi-turn tool-calling conversations.
The model was not ignoring our instructions. It was not confused by the
tool schema. It simply could not maintain a coherent plan across
multiple turns when the conversation included large tool results.

But we did not know that yet. So we started fixing it.

---

## Five Fixes, One Escalating War

What followed was an escalating series of interventions, each one more
aggressive than the last. It is worth telling this story in detail
because the progression reveals something important about working with
local LLMs: they do not follow rules the way you expect.

### Fix 1: Tool Result Capping

**Theory:** The Figma YAML response (~8,000 characters) was blowing out
the 32k context window. With 10 turns of accumulated history, each
containing the full Figma response, the model was losing its system
prompt to truncation.

**Implementation:**

```typescript
private static readonly MAX_TOOL_RESULT_CHARS = 6_000;

private capToolResult(result: string): string {
  if (result.length <= DesignForgeAgent.MAX_TOOL_RESULT_CHARS) return result;
  const truncated = result.slice(0, DesignForgeAgent.MAX_TOOL_RESULT_CHARS);
  return truncated +
    `\n\n[TRUNCATED -- full response was ${result.length} characters. ` +
    `Proceed to the next phase of the workflow.]`;
}
```

**Result:** The model still loops, but uses less context per turn.
Context was not the root cause.

---

### Fix 2: Duplicate Call Detection

**Theory:** If the model does not realize it has already fetched the
data, maybe we can tell it directly.

**Implementation:** Cache tool calls by `name:argsJSON`. On a duplicate
call, return the cached result plus a firm nudge:

```
[DUPLICATE CALL -- you already called "get_figma_data" with these exact
parameters on a previous turn and received the data. DO NOT call this
tool again. Use the data you already have and proceed to the next phase
of the workflow.]
```

**Result:** Duplicate detection works perfectly. No more hammering the
MCP server. But the model **ignores the nudge message entirely** and
keeps generating the same `tool_use` block on the next turn.

On turn 9, it got creative: it dropped the `nodeId` parameter from the
call, slightly changing the arguments to bypass the cache key. The model
was not reasoning -- it was pattern-matching, and it found a loophole.

---

### Fix 3: Tool Blocking

**Theory:** If asking nicely does not work, remove the option entirely.
After 2 consecutive duplicates, strip the tool from the `tools` array so
the model *cannot* call it.

**Implementation:**

```typescript
const MAX_CONSECUTIVE_DUPLICATES = 2;
const blockedTools = new Set<string>();

// ... when duplicate count exceeds threshold:
blockedTools.add(toolUse.name);

// ... when building the API call:
const tools = this.buildTools(blockedTools);
// buildTools() filters out blocked tool names
```

**Result:** The tool is removed from the tools schema. But the model
**still generates `tool_use` blocks** for `get_figma_data`. It is not
reading the tools list on each turn -- it is copying the tool-call
pattern from earlier turns in the conversation history.

This was a critical insight. The model was not deciding what tools to
call based on the schema. It was reproducing patterns it had seen in its
own conversation history.

---

### Fix 4: Conversation Rewriting

**Theory:** If the model copies from history, rewrite the history. When
it tries to call a blocked tool, do not add the broken turn to the
conversation at all. Instead, inject synthetic messages that make it
*look like* the phase already completed.

**Implementation:**

```typescript
if (allBlocked) {
  // Replace the broken turn with synthetic progress
  this.conversationHistory.push({
    role: 'assistant',
    content: 'Phase 1 is complete. I have analyzed the Figma design...',
  });

  this.conversationHistory.push({
    role: 'user',
    content: `Phase 1 (Figma analysis) is done. NOW PROCEED TO PHASE 2.
              You MUST call one of these Naos design system tools:
              - get_naos_component_docs
              - get_naos_design_tokens
              DO NOT call get_figma_data again.`,
  });
  continue;
}
```

**Result:** The model **still calls `get_figma_data`**. The synthetic
messages are in the conversation, the real tool results from earlier
turns are gone, the instructions are explicit -- and the model still
generates the same tool call. It treats every turn as essentially
independent, latching onto the strongest pattern it has seen.

At this point we had exhausted every in-loop intervention. The model
could not be guided, blocked, tricked, or rewritten into following a
multi-turn plan. We needed a fundamentally different approach.

---

### Fix 5: Pre-fetch Architecture (The Nuclear Option)

**Theory:** If the model cannot orchestrate multi-turn tool calls, do
not ask it to. Fetch everything *before* the loop starts. Inject all the
data into the prompt. Remove tools from the API call entirely. Make the
task single-turn: here is the data, generate the code.

This is not a fix. It is an architectural pivot.

---

## When Signs Don't Work, Remove the Door

Fixes 1 through 4 were like putting up "DO NOT ENTER" signs for a
toddler who cannot read. Fix 5 was removing the door entirely.

The pre-fetch architecture works like this:

**Before the loop starts**, the agent calls the MCP bridge directly:

```typescript
private async prefetchData(): Promise<PrefetchedContext> {
  const ctx: PrefetchedContext = {
    figmaData: null,
    naosComponents: null,
    naosTokens: null,
    naosIcons: null,
  };

  // Fetch Figma design data
  if (tools.includes('get_figma_data')) {
    const raw = await this.mcpBridge.callTool('get_figma_data', { fileKey });
    ctx.figmaData = raw.length > 8_000
      ? raw.slice(0, 8_000) + '\n[TRUNCATED]'
      : raw;
  }

  // Fetch Naos component docs
  if (tools.includes('get_naos_component_docs')) {
    const raw = await this.mcpBridge.callTool('get_naos_component_docs', {});
    ctx.naosComponents = raw.length > 6_000
      ? raw.slice(0, 6_000) + '\n[TRUNCATED]'
      : raw;
  }

  // Fetch Naos design tokens
  if (tools.includes('get_naos_design_tokens')) {
    const raw = await this.mcpBridge.callTool('get_naos_design_tokens', {});
    ctx.naosTokens = raw.length > 4_000
      ? raw.slice(0, 4_000) + '\n[TRUNCATED]'
      : raw;
  }

  return ctx;
}
```

Then, **all of this data is injected into the user prompt**:

```
## Figma Design Data (pre-fetched)
Phase 1 is ALREADY DONE. Here is the extracted Figma design:

[... 8000 chars of YAML ...]

## Naos Design System Components (pre-fetched)
Phase 2 data is ALREADY AVAILABLE. Here are the @dtsl/react components:

[... 6000 chars of component docs ...]

## Your Task
Phases 1 and 2 are COMPLETE. DO NOT call any tools.
Skip straight to Phase 3: generate the implementation files.
```

And critically, **no tools are passed to the API at all**:

```typescript
const isPrefetchMode = !!(this.prefetched && this.prefetched.figmaData);

const response = isPrefetchMode
  ? await this.anthropic.messages.create(baseParams)     // No tools
  : await this.anthropic.messages.create({
      ...baseParams,
      tools: this.buildTools(blockedTools),               // With tools
    });
```

The system prompt switches to a streamlined version -- no phase
instructions, no tool-calling guidance, just code generation rules:

```
You are DesignForge, a code generation agent. Your job is to convert
Figma design data into production-ready React/TypeScript code using
the Naos design system (@dtsl/react).

All Figma design data and Naos component docs are provided in the
user message. DO NOT call any tools. Generate all files directly.
```

**The result: the loop is broken.** The model generates code on turn 1.

The insight here is not that local LLMs are bad at tool calling (though
they are). The insight is that **the right abstraction eliminates the
hardest problem**. By moving tool orchestration out of the LLM and into
deterministic code, we turned a multi-turn reasoning challenge into a
single-turn generation task. And single-turn generation is something
even a 3B-active-parameter model handles reasonably well.

---

## The Model Quality Reckoning

With the pre-fetch architecture in place, the pipeline works end-to-end.
A file was written to disk:
`ConversionsAndROI/ConversionsAndROI.tsx`. That is a real component,
generated from a real Figma file, using real design system data.

But let us be honest about what the output looks like.

### What Went Right

- The pipeline completed without errors
- A file was actually written to disk
- The component structure is recognizable
- Some `@dtsl/react` imports are present

### What Went Wrong

- **Repetition degeneration.** Hundreds of identical `<span>` lines. The
  model fell into a repetitive pattern and could not break out. This is
  a known failure mode of quantized models -- the probability
  distribution flattens, and the model gets stuck in local optima.

- **Uses `React.FC`.** Our system prompt explicitly says "do NOT use
  `React.FC`." The model ignored this instruction.

- **Custom CSS classes instead of `@dtsl/react` components.** The model
  generated `className="btn-primary"` instead of
  `<Button variant="primary">`. It understood the concept of a button
  but chose the wrong implementation path.

- **Duplicate JSX blocks.** Entire sections of the component are
  copy-pasted within the same file.

- **Phantom imports.** `InputText` is imported but never used.

### The Diagnosis

These are all symptoms of the same root cause: **model capability at
4-bit quantization**. The qwen3-coder-30b model is impressive for its
size, but at 4-bit quantization with only 3B active parameters per
token, it cannot:

1. Follow complex multi-constraint instructions (no `React.FC` AND use
   `@dtsl/react` AND match Figma specs AND generate tests)
2. Maintain coherence over long outputs (the repetition problem)
3. Distinguish between similar patterns (CSS classes vs component props)

The fix is not in our code. It is in the model:

| Upgrade Path           | Expected Impact                    |
|------------------------|------------------------------------|
| qwen3-coder-72b       | Better instruction following       |
| Full-precision (fp16)  | Less degeneration, higher quality  |
| Claude via API         | Dramatically better output quality |

Our architecture supports all of these. Change `ANTHROPIC_BASE_URL`
and `CLAUDE_MODEL` in the environment, and the same pipeline runs with
Claude Sonnet or Opus. The code does not change.

---

## Technical Appendix: Things Worth Knowing

### Using the Anthropic SDK as a Generic HTTP Client

This is the most underappreciated trick in the codebase. The
`@anthropic-ai/sdk` package is free, open-source, and does not require
an Anthropic API key to *install or import*. It only needs a non-empty
string for the `apiKey` constructor parameter (it validates the string
is not empty, but does not validate the format).

```typescript
this.anthropic = new Anthropic({
  apiKey: 'lm-studio',                    // Any non-empty string
  baseURL: 'http://127.0.0.1:1234',       // LM Studio's local endpoint
});
```

This turns the Anthropic SDK into a fully-typed HTTP client for any
server that implements the `/v1/messages` endpoint. You get:

- TypeScript types for requests and responses
- Automatic retry logic
- Streaming support
- Tool-use content block parsing

All for free. No API key. No cloud dependency.

### Tool Schema Translation

MCP and the Anthropic API use different naming conventions for the same
concept:

| MCP (camelCase)  | Anthropic (snake_case) |
|------------------|------------------------|
| `inputSchema`    | `input_schema`         |

The `buildTools()` method handles this translation:

```typescript
return mcpTools.map(tool => ({
  name: tool.name,
  description: tool.description || `Tool from ${tool.serverName}`,
  input_schema: {
    type: 'object' as const,
    properties: tool.inputSchema.properties ?? undefined,
    required: tool.inputSchema.required,
  },
}));
```

### Context Window Management

The `trimConversationHistory()` method implements a sliding window
strategy. The budget is ~100,000 characters (~25,000 tokens), which is
conservative for a 32k context model but leaves room for the system
prompt, tools array, and generated response.

The algorithm:

1. Estimate total character count across all messages
2. If under budget, do nothing
3. If over budget, keep the first message (the job description --
   it contains the Figma URL and all pre-fetched data)
4. Drop the oldest message pairs (assistant + user) until under budget
5. Always drop in pairs to maintain the alternating user/assistant
   pattern that the API requires

```typescript
private trimConversationHistory(): void {
  const MAX_HISTORY_CHARS = 100_000;
  const chars = this.estimateHistoryChars();
  if (chars <= MAX_HISTORY_CHARS) return;

  const firstMessage = this.conversationHistory[0];
  const rest = this.conversationHistory.slice(1);

  // Drop oldest pairs until under budget
  let dropCount = 0;
  let trimmedChars = chars;
  while (trimmedChars > MAX_HISTORY_CHARS && dropCount < rest.length - 2) {
    // ... subtract message size, increment dropCount
  }

  if (dropCount % 2 !== 0) dropCount++; // Keep pairs aligned

  this.conversationHistory = [firstMessage, ...rest.slice(dropCount)];
}
```

### The Config Priority Chain

```
CLI flags  >  environment variables  >  designforge.config.js  >  defaults
```

For example, the model is resolved as:

```typescript
model: process.env.CLAUDE_MODEL || fileConfig.agent?.model
```

And the output path:

```typescript
outputPath: path.resolve(
  options.output || fileConfig.output?.baseDir || './src/components'
)
```

The `loadConfigFile()` function uses dynamic `import()` which handles
both `export default { ... }` (ESM) and `module.exports = { ... }`
(CJS):

```typescript
async function loadConfigFile(): Promise<Record<string, any>> {
  const configPath = path.join(process.cwd(), 'designforge.config.js');
  if (!fs.existsSync(configPath)) return {};

  try {
    const imported = await import(configPath);
    return imported.default ?? imported;
  } catch {
    return {};
  }
}
```

### The Legacy Tool-Calling Code Is Still There

Fixes 1 through 4 (capping, duplicate detection, tool blocking,
conversation rewriting) are still in the codebase. They are not dead
code -- they are **fallback behavior** for when the agent runs without
pre-fetched data (for example, when no MCP bridge is configured and
mock tools are used). The pre-fetch path short-circuits all of this:

```typescript
const isPrefetchMode = !!(this.prefetched && this.prefetched.figmaData);
```

When `isPrefetchMode` is true, no tools are passed to the API, and the
duplicate detection / blocking / rewriting code paths are never reached.

---

## Where We Are, Where We're Going

### What Works Today

- Full pipeline from Figma URL to `.tsx` file on disk
- MCP bridge connecting to both Figma (stdio) and Naos (HTTP) servers
- Pre-fetch architecture that eliminates the multi-turn loop problem
- Four-layer testing strategy with clear isolation
- CLI with five commands and a config priority chain
- Code block parser handling four different path formats
- Directory traversal protection on file writes
- Context window management with sliding window trimming
- Seamless switching between local LLM and cloud API

### What Needs Work

| Area                | Status    | Next Step                                   |
|---------------------|-----------|---------------------------------------------|
| Output quality      | Poor      | Larger model (72B) or cloud API (Claude)    |
| Test generation     | Skeleton  | Run Jest and capture coverage automatically |
| Watch mode          | TODO      | Figma polling with change detection         |
| Design parity score | TODO      | Compare generated code against Figma specs  |
| Storybook stories   | Generated | Verify they render correctly                |
| Error boundaries    | Missing   | Wrap generated components in error handlers |

### The Model Upgrade Path

The architecture was deliberately designed so that upgrading the model
requires zero code changes:

```bash
# Local model (current)
ANTHROPIC_BASE_URL=http://127.0.0.1:1234
CLAUDE_MODEL=qwen/qwen3-coder-30b

# Bigger local model
ANTHROPIC_BASE_URL=http://127.0.0.1:1234
CLAUDE_MODEL=qwen/qwen3-coder-72b

# Cloud API
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-20250514
```

Same code. Same pipeline. Dramatically different output quality.

---

## Lessons Learned

### 1. Local LLMs Cannot Orchestrate Multi-Turn Tool Calls

This is the biggest lesson. Models at 3B-7B active parameters (even if
the total parameter count is 30B+ in a MoE architecture) cannot
maintain a coherent multi-step plan when the conversation includes large
tool results. They pattern-match from history rather than reasoning
about what to do next.

If your architecture requires the LLM to call Tool A, process the
result, then call Tool B, and you are using a local model -- you will
hit a loop. Do the orchestration in deterministic code and give the LLM
a single-turn task.

### 2. Test in Layers, Not All at Once

If we had gone straight to Layer 4 testing, we would have spent days
debugging whether the problem was in our code, the MCP bridge, the SDK
format, or the model's reasoning. By testing each layer independently,
we knew within minutes that the problem was specifically in the model's
multi-turn behavior.

### 3. The Anthropic SDK Is a Swiss Army Knife

Using `@anthropic-ai/sdk` as a generic HTTP client for LM Studio was
one of the best architectural decisions. It gave us typed requests,
typed responses, and a one-line migration path to the cloud. The SDK
does not care where the server is -- it just sends HTTP requests.

### 4. Signs Do Not Work on Toddlers

When the model ignores your instructions, adding more instructions does
not help. Adding stronger instructions does not help. Removing the
instructions and restructuring the task so the unwanted behavior is
impossible -- that helps.

### 5. Keep the Failed Experiments

Fixes 1 through 4 are still in the codebase. They were not wasted work.
They are fallback behavior for different contexts (mock mode, more
capable models), and they document the reasoning journey. Anyone reading
the code can see *why* the pre-fetch architecture exists by looking at
the dead-end paths that preceded it.

### 6. The Regex Lesson

`\s` matches newlines. `[ \t]` does not. When parsing structured text
where line boundaries matter, always use `[ \t]` for horizontal
whitespace. This is a ten-second fix that took an hour to diagnose.

---

*DesignForge is an internal Brevo project. It is open to contributions
from anyone on the team. If you are reading this and want to try a
larger model or integrate with a different design system, the
architecture is ready -- start with the environment variables and see
how far you get.*
