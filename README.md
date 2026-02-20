# DesignForge

Autonomous AI agent that converts Figma designs into production-ready React/TypeScript code using Brevo's Naos design system (`@dtsl/react`).

```
Figma Design  -->  MCP Bridge  -->  LLM  -->  React Components on Disk
                   (pre-fetch)       |
                                     v
                              @dtsl/react code
```

---

## Prerequisites

Before you begin, make sure you have the following installed and available:

| Requirement | Minimum Version | How to Check |
|---|---|---|
| **Node.js** | >= 18.0.0 | `node -v` |
| **npm** | >= 9.0.0 | `npm -v` |
| **LM Studio** _or_ Anthropic API key | — | See [Step 3](#step-3-configure-environment-variables) |
| **Figma Personal Access Token** | — | Figma > Settings > Personal access tokens (starts with `figd_`) |

---

## Step 1: Install Dependencies

```bash
cd /path/to/designforge
npm install
```

This reads the root `package.json` which declares `"workspaces": ["packages/*"]`.
npm resolves dependencies for both `packages/core` and `packages/cli` in one
shot, and symlinks `@brevo/designforge-core` so the CLI can import it.

---

## Step 2: Build the Project

```bash
npm run build
```

Runs `tsc` (TypeScript compiler) in both workspaces. Compiles `.ts` source
files into `.js` in their respective `dist/` folders.

**You must rebuild after any code change.** The CLI cannot run from TypeScript
source directly — it needs the compiled `dist/` output.

---

## Step 3: Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

### Option A: Local LLM via LM Studio (free, runs on your machine)

```env
ANTHROPIC_API_KEY=lm-studio
ANTHROPIC_BASE_URL=http://127.0.0.1:1234
FIGMA_MCP_KEY=figd_your_personal_access_token_here
CLAUDE_MODEL=qwen/qwen3-coder-30b
```

**How this works:** The Anthropic SDK is used as a generic HTTP client. Setting
`ANTHROPIC_BASE_URL` to LM Studio's address redirects all API calls there
instead of Anthropic's servers. The request/response format is compatible.
`ANTHROPIC_API_KEY` can be any non-empty string — LM Studio doesn't validate it.

### Option B: Anthropic Claude API (paid, higher quality output)

```env
ANTHROPIC_API_KEY=sk-ant-your-real-key-here
FIGMA_MCP_KEY=figd_your_personal_access_token_here
CLAUDE_MODEL=claude-sonnet-4-20250514
```

Leave `ANTHROPIC_BASE_URL` unset — it defaults to `api.anthropic.com`.

### Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | API key. Any non-empty string for LM Studio, real key for Claude. |
| `ANTHROPIC_BASE_URL` | No | `https://api.anthropic.com` | Override to point at LM Studio (`http://127.0.0.1:1234`). |
| `FIGMA_MCP_KEY` | Yes | — | Figma personal access token (`figd_...`). Required for fetching designs. |
| `CLAUDE_MODEL` | No | `qwen/qwen3-coder-30b` | Model identifier. Must match what's loaded in LM Studio. |
| `NAOS_MCP_URL` | No | `https://naos-mcp.51b.dev/mcp` | Naos design system MCP endpoint. |

---

## Step 4: Start LM Studio (if using local LLM)

1. Open **LM Studio**
2. Download and load a model (e.g., `qwen3-coder-30b`)
3. Go to the **Local Server** tab
4. Click **Start Server**
5. Verify it's listening at `http://127.0.0.1:1234`

The model must be loaded and the server must be running _before_ you start
DesignForge. If you see `"No models loaded"` in the output, open LM Studio and
load a model.

Skip this step if using Anthropic's Claude API (Option B).

---

## Step 5: Run DesignForge

### Basic usage

```bash
node packages/cli/dist/cli.js start \
  --figma "https://www.figma.com/design/YOUR_FILE_KEY/Design-Name?node-id=123-456&m=dev" \
  --output ./generated-components
```

### With all options

```bash
node packages/cli/dist/cli.js start \
  --figma "https://www.figma.com/design/YOUR_FILE_KEY/Design-Name?node-id=123-456&m=dev" \
  --output ./generated-components \
  --max-turns 10 \
  --coverage 80 \
  --verbose
```

### CLI Flags

| Flag | Required | Default | Description |
|---|---|---|---|
| `--figma <url>` | Yes | — | Figma URL. Copy from your browser while viewing the frame you want to convert. |
| `--output <path>` | Yes | — | Directory where generated `.tsx` files are written. Created if it doesn't exist. |
| `--max-turns <n>` | No | `30` | Maximum LLM turns. With pre-fetch mode, 1-2 turns is usually enough. Keep it low (5-10) to avoid runaway costs. |
| `--coverage <n>` | No | `80` | Target test coverage percentage (for future use). |
| `--storybook` | No | `true` | Generate Storybook stories (for future use). |
| `--verbose` | No | `false` | Print detailed logs including MCP calls and LLM responses. |
| `--dry-run` | No | `false` | Preview configuration without running the workflow. |

### Where to get the Figma URL

1. Open your Figma file in a browser
2. Select the frame or component you want to convert
3. Copy the URL from the address bar — it should look like:
   ```
   https://www.figma.com/design/BXMrieZGyPADOzN5UMuZRU/My-Design?node-id=3014-51669&m=dev
   ```
4. The `node-id` parameter targets a specific frame. Without it, the entire
   file is fetched (which can be very large).

---

## What Happens When You Run It

```
1. CLI loads .env and parses flags
         |
2. Spawns MCP servers:
   - figma-developer-mcp  (stdio child process)
   - naos-mcp             (HTTP connection)
         |
3. PRE-FETCH phase (before the LLM sees anything):
   - get_figma_data           --> YAML design specification
   - get_naos_component_docs  --> @dtsl/react component docs
   - get_naos_design_tokens   --> design tokens (colors, spacing)
         |
4. LLM generates code (usually 1 turn):
   - All design data is injected into the prompt
   - No tools are passed — pure code generation
   - Model outputs React/TypeScript components
         |
5. File writer parses output:
   - Extracts ```tsx code blocks from LLM response
   - Writes them to the --output directory
         |
6. Cleanup:
   - Disconnects MCP servers
   - Prints summary
```

**Why pre-fetch?** Local LLMs (especially quantized models) struggle with
multi-turn tool-calling workflows — they tend to call the same tool repeatedly
without advancing. Pre-fetching all data before the LLM loop eliminates this
problem entirely. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full story.

---

## Other Commands

### Debug — check your configuration

```bash
node packages/cli/dist/cli.js debug
```

Prints which environment variables are set, which are missing, and their values
(keys are masked).

### Dry run — preview without running

```bash
node packages/cli/dist/cli.js start \
  --figma "https://www.figma.com/design/..." \
  --output ./out \
  --dry-run
```

Shows the resolved config (Figma URL, output path, coverage target) without
connecting to MCP servers or the LLM.

### Interactive mode — guided prompts

```bash
node packages/cli/dist/cli.js interactive
```

Prompts you for each value (Figma URL, output path, coverage, etc.) step by
step.

### Validate config file

```bash
node packages/cli/dist/cli.js validate-config
```

Checks if a `designforge.config.js` exists in the current directory and
displays its contents.

---

## Running Tests

```bash
# Run all tests in the core package
cd packages/core && npx jest

# Run a specific test file
cd packages/core && npx jest file-writer.test.ts

# Run with coverage
cd packages/core && npx jest --coverage
```

**Important:** Run tests from inside `packages/core/`, not the project root.
Jest is configured per-package and won't find the right `tsconfig` from the
root.

---

## Project Structure

```
designforge/
  packages/
    core/                       # Agent logic (the brain)
      src/
        agent.ts                # Main agent — prompt building, LLM loop, pre-fetch
        mcp-bridge.ts           # MCP client — connects to Figma + Naos servers
        file-writer.ts          # Parses LLM output and writes files to disk
        file-writer.test.ts     # Tests for code block parsing
        agent.test.ts           # Tests for agent configuration and setup
        index.ts                # Public exports
    cli/                        # CLI entry point (the interface)
      src/
        cli.ts                  # Commander-based CLI with start/debug/interactive
  scripts/
    test-mcp-connectivity.ts    # Layer 2 test — verifies MCP servers respond
    test-single-turn.ts         # Layer 3 test — single LLM turn with mock data
  generated-components/         # Default output directory for generated code
  .env.example                  # Template for environment variables
  ARCHITECTURE.md               # Engineering journey and design decisions
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ANTHROPIC_API_KEY not found` | Missing `.env` file or empty key | Run `cp .env.example .env` and fill in values |
| `No models loaded` | LM Studio server running but no model loaded | Open LM Studio, load a model, then retry |
| `FIGMA_MCP_KEY not set` warning | Missing Figma token | Add `FIGMA_MCP_KEY=figd_...` to `.env` |
| `Cannot find module '@brevo/designforge-core'` | Project not built | Run `npm run build` from the project root |
| `connect ECONNREFUSED 127.0.0.1:1234` | LM Studio server not running | Start the local server in LM Studio's Server tab |
| Repetitive/degenerate output | Model quality limitation | Use a larger model (72B+) or switch to Claude API |
| `Agent did not complete within N turns` | LLM used all turns without finishing | Increase `--max-turns` or use `--verbose` to check pre-fetch |

---

## Key Things to Keep in Mind

1. **Always rebuild after code changes.** The CLI runs compiled JavaScript from
   `dist/`, not TypeScript source. If you edit `.ts` files, run `npm run build`
   before testing.

2. **The Figma token is sensitive.** Never commit `.env` to git. The
   `.gitignore` should already exclude it, but double-check.

3. **Pre-fetch is the default and recommended mode.** It fetches all MCP data
   upfront and injects it into the prompt. This avoids the multi-turn
   tool-calling loop that local LLMs cannot handle.

4. **Model choice matters significantly.** Small quantized models (3B active
   parameters) produce functional but low-quality code. For production use,
   prefer Claude API or a 70B+ local model.

5. **`--max-turns` is your safety net.** Each turn is one LLM API call. Set it
   low (5-10) during development to avoid burning through tokens or waiting on
   a looping model.

6. **The Naos MCP server is public.** It runs at `https://naos-mcp.51b.dev/mcp`
   and requires no authentication. The Figma MCP server is spawned locally as a
   child process using your personal access token.

7. **Output is overwritten, not merged.** Running DesignForge twice with the
   same `--output` path will overwrite existing files. Back up generated code
   if you've made manual edits.

---

## Further Reading

- [ARCHITECTURE.md](./ARCHITECTURE.md) — The full engineering journey: why we
  built it this way, the problems we hit, and how we solved them.

---

## License

MIT
