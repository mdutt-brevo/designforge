# DesignForge - Project Summary

## Overview

DesignForge is an autonomous AI agent that converts Figma designs into production-ready code using Claude AI and Model Context Protocol (MCP) servers.

**Key Innovation:** Instead of manual design-to-code conversion, DesignForge autonomously:
1. Analyzes Figma designs via MCP
2. Maps components to your design system
3. Generates TypeScript/React code
4. Creates comprehensive tests
5. Validates design-dev parity

## Project Structure

```
designforge/
├── packages/
│   ├── core/                      # Core agent logic
│   │   ├── src/
│   │   │   ├── agent.ts          # Main agent implementation
│   │   │   ├── agent.test.ts     # Unit tests
│   │   │   └── index.ts          # Public exports
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── jest.config.js
│   │
│   └── cli/                       # CLI interface
│       ├── src/
│       │   ├── cli.ts            # CLI commands
│       │   └── index.ts          # Public exports
│       ├── package.json
│       └── tsconfig.json
│
├── examples/
│   ├── basic/                     # Basic usage example
│   │   ├── run.ts
│   │   └── README.md
│   └── advanced/                  # Advanced usage with custom agent
│       ├── custom-agent.ts
│       └── README.md
│
├── docs/
│   ├── getting-started.md        # Setup guide
│   ├── configuration.md          # Configuration options
│   ├── workflows.md              # Different use cases
│   └── api-reference.md          # Complete API docs
│
├── tests/                         # Integration tests (TODO)
│
├── package.json                   # Root package (monorepo)
├── tsconfig.json                  # TypeScript config
├── designforge.config.js          # Example configuration
├── .env.example                   # Environment template
├── .gitignore
├── README.md                      # Main documentation
├── QUICKSTART.md                  # Quick start guide
├── CONTRIBUTING.md                # Contribution guidelines
├── CHANGELOG.md                   # Version history
├── LICENSE                        # MIT License
└── PROJECT_SUMMARY.md            # This file
```

## Architecture

### Core Agent (`packages/core`)

The heart of DesignForge - an autonomous AI agent powered by Claude.

**Key Components:**

1. **DesignForgeAgent Class**
   - Manages multi-turn conversations with Claude
   - Orchestrates MCP tool usage
   - Tracks progress and results
   - Handles completion detection

2. **System Prompt**
   - Defines agent's mission and workflow
   - Specifies 6-phase execution plan
   - Sets autonomous behavior rules
   - Configures output structure

3. **Tool Integration**
   - Figma MCP: Extract design specs
   - Design System MCP: Query components
   - Simulated responses for development

4. **Result Extraction**
   - Parses conversation history
   - Extracts metrics (coverage, files, etc.)
   - Identifies design system gaps

### CLI (`packages/cli`)

User-friendly command-line interface.

**Commands:**

- `start` - Run DesignForge workflow
- `watch` - Auto-regenerate on Figma changes
- `interactive` - Guided prompts
- `debug` - Debug configuration
- `validate-config` - Validate settings

**Features:**

- Colored output with chalk
- Spinners with ora
- Interactive prompts with inquirer
- Progress tracking
- Error handling

## How It Works

### Multi-Turn Autonomous Workflow

```
┌─────────────────────────────────────────────────────┐
│  User Initiates Workflow                            │
│  designforge start --figma <url> --output <path>    │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│  Turn 1: Agent analyzes Figma design                │
│  → Uses Figma MCP to extract components             │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│  Turn 2: Agent receives Figma data                  │
│  → Documents components, tokens, variants           │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│  Turn 3: Agent queries Design System                │
│  → Uses Design System MCP                           │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│  Turn 4: Agent creates component mapping            │
│  → Maps Figma components to DS components           │
│  → Identifies gaps                                  │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│  Turn 5-N: Agent generates code                     │
│  → Creates TypeScript/React components              │
│  → Writes comprehensive tests                       │
│  → Generates Storybook stories                      │
│  → Creates documentation                            │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│  Final Turn: Agent validates & reports              │
│  → Compares against Figma specs                     │
│  → Generates metrics report                         │
│  → Says "WORKFLOW COMPLETE"                         │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│  Result Returned to User                            │
│  📊 Files: 18                                       │
│  📦 Components: 5                                   │
│  🧪 Tests: 12 (87% coverage)                       │
│  📚 Stories: 8                                      │
│  ✅ Design Parity: 98%                             │
└─────────────────────────────────────────────────────┘
```

### MCP Integration

DesignForge uses Model Context Protocol to communicate with external systems:

**Figma MCP Server:**
- Extracts design specifications
- Provides component hierarchy
- Returns design tokens (colors, spacing, typography)
- Identifies variants and states

**Design System MCP Server:**
- Lists available components
- Provides component APIs (props, variants)
- Returns usage examples
- Offers implementation patterns

**Current Status:** Mock responses for development. Real MCP servers can be integrated by:
1. Setting up actual MCP servers
2. Configuring paths in `.env`
3. Agent automatically uses them

## Configuration

### Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...      # Required
FIGMA_MCP_PATH=/path/to/figma     # Optional
DESIGN_SYSTEM_MCP_PATH=/path/to/ds # Optional
PROJECT_ROOT=/path/to/project      # Optional
```

### Configuration File

```javascript
// designforge.config.js
export default {
  mcpServers: { /* ... */ },
  codegen: { /* ... */ },
  agent: { /* ... */ },
  validation: { /* ... */ },
  output: { /* ... */ },
  hooks: { /* ... */ }
};
```

### CLI Options

```bash
--figma <url>           # Figma file URL
--output <path>         # Output directory
--coverage <number>     # Minimum test coverage
--max-turns <number>    # Maximum AI turns
--verbose               # Detailed logging
--dry-run              # Preview only
--validate             # Validate after generation
```

## Usage Examples

### Basic Usage

```bash
npm install
npm run build
cd packages/cli
node dist/cli.js start --figma <url> --output ../../output
```

### Programmatic Usage

```typescript
import { runDesignForge } from '@brevo/designforge-core';

const result = await runDesignForge({
  figmaUrl: 'https://figma.com/file/abc123',
  outputPath: './src/components',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  minCoverage: 80,
  verbose: true
});
```

### Custom Progress Tracking

```typescript
import { DesignForgeAgent } from '@brevo/designforge-core';

const agent = new DesignForgeAgent(config);

await agent.run((progress) => {
  console.log(`Turn ${progress.turn}: ${progress.message}`);

  if (progress.toolCalls) {
    progress.toolCalls.forEach(call => {
      console.log(`  🔧 ${call.tool}`);
    });
  }
});
```

## Development Status

### ✅ Completed

- [x] Project structure and monorepo setup
- [x] Core agent implementation
- [x] Multi-turn conversation logic
- [x] MCP tool integration (with mock responses)
- [x] CLI with multiple commands
- [x] Configuration system
- [x] Comprehensive documentation
- [x] Examples (basic and advanced)
- [x] Test framework setup
- [x] TypeScript configuration
- [x] Build system

### 🚧 TODO

- [ ] Implement real MCP server integration
- [ ] Add watch mode functionality
- [ ] Create integration tests
- [ ] Implement actual file writing logic
- [ ] Add validation system
- [ ] Implement hooks system
- [ ] Create web UI (optional)
- [ ] Add more examples
- [ ] Publish to npm
- [ ] CI/CD pipeline

## Next Steps

### For Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build Packages**
   ```bash
   npm run build
   ```

3. **Run Tests**
   ```bash
   npm test
   ```

4. **Try Examples**
   ```bash
   cd examples/basic
   npx ts-node run.ts
   ```

### For Production Use

1. **Set Up MCP Servers**
   - Configure Figma MCP server
   - Configure Design System MCP server
   - Update paths in `.env`

2. **Implement File Writing**
   - Currently, agent generates code conceptually
   - Need to implement actual file system writes
   - Add validation and testing

3. **Test with Real Designs**
   - Use actual Figma files
   - Verify generated code quality
   - Iterate on prompts and logic

4. **Deploy to CI/CD**
   - Set up automated workflows
   - Schedule regular syncs
   - Integrate with PR process

## Key Features

### 🤖 Autonomous Execution
Set it and forget it - agent runs end-to-end without supervision.

### 🔧 Multi-MCP Orchestration
Coordinates between Figma and Design System MCP servers.

### 📊 Real-Time Progress
Track agent's thinking and tool usage in real-time.

### 🎨 Design System Compliance
Only uses approved design system components.

### 🔍 Gap Detection
Identifies missing components in your design system.

### 🧪 Test Generation
Creates comprehensive Jest test suites automatically.

### 📚 Documentation
Auto-generates Storybook stories and README files.

### ✅ Validation
Ensures design-dev parity with scoring.

## Technical Highlights

### TypeScript First
Full type safety across the codebase.

### Monorepo Structure
Clean separation of concerns with npm workspaces.

### Extensible
Easy to add new commands, hooks, and plugins.

### Well Documented
Comprehensive docs, examples, and inline comments.

### Testable
Unit test structure in place for TDD.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) file.

---

**Built with ❤️ using Claude AI and MCP**
