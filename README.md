# DesignForge

**Autonomous AI Agent: Figma → Design System → Production Code**

Transform Figma designs into production-ready code automatically using Claude AI and MCP servers.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Build packages
npm run build

# Run DesignForge
cd packages/cli
node dist/cli.js start --figma https://figma.com/file/abc123 --output ./src/components
```

---

## 📦 Installation

### Prerequisites

- Node.js 18+
- Claude API key
- Figma MCP server configured
- Design System MCP server configured

### Setup

```bash
# Clone the repository
git clone https://github.com/brevo/designforge.git
cd designforge

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Build all packages
npm run build
```

### Environment Variables

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
FIGMA_MCP_PATH=/path/to/figma-mcp
DESIGN_SYSTEM_MCP_PATH=/path/to/design-system-mcp
PROJECT_ROOT=/path/to/your/project
```

---

## 🎯 Features

✅ **Autonomous Execution** - Set it and forget it

✅ **Multi-MCP Orchestration** - Figma + Design System integration

✅ **Real-Time Progress** - See what the agent is thinking

✅ **Design System Compliance** - Only uses approved components

✅ **Gap Detection** - Identifies missing design system components

✅ **Test Generation** - Creates comprehensive test suites

✅ **Storybook Stories** - Auto-generates documentation

✅ **TypeScript First** - Full type safety

✅ **Design-Dev Parity** - Validates against Figma specs

---

## 📖 Usage

### Basic Usage

```bash
designforge start \
  --figma https://figma.com/file/abc123/UserSettings \
  --output ./src/pages/UserSettings \
  --coverage 85
```

### Advanced Options

```bash
designforge start \
  --figma <figma-url> \
  --output <output-path> \
  --coverage <number>         # Minimum test coverage (default: 80)
  --storybook                 # Generate Storybook stories (default: true)
  --validate                  # Validate against Figma after generation
  --max-turns <number>        # Maximum AI turns (default: 30)
  --verbose                   # Detailed logging
  --dry-run                   # Preview without writing files
```

### Watch Mode

Automatically rebuild when Figma design changes:

```bash
designforge watch \
  --figma https://figma.com/file/abc123 \
  --output ./src/components \
  --interval 60  # Check every 60 seconds
```

### Interactive Mode

```bash
designforge interactive

# Prompts:
# ? Enter Figma URL: https://figma.com/file/...
# ? Output directory: ./src/components
# ? Generate tests? (Y/n)
# ? Generate Storybook? (Y/n)
# ? Minimum coverage: 80
```

---

## 🏗️ Project Structure

```
designforge/
├── packages/
│   ├── cli/                 # CLI interface
│   ├── core/                # Core agent logic
│   ├── mcp-figma/          # Figma MCP integration (TODO)
│   ├── mcp-design-system/  # Design System MCP integration (TODO)
│   └── ui/                  # Web UI (TODO)
├── examples/
│   ├── basic/
│   ├── advanced/
│   └── custom-workflow/
├── docs/
│   ├── getting-started.md
│   ├── configuration.md
│   ├── workflows.md
│   └── api-reference.md
└── tests/
```

---

## 🔧 Configuration

### `designforge.config.js`

See `designforge.config.js` for full configuration options including:
- MCP server paths
- Code generation settings
- Agent behavior
- Validation rules
- Output preferences

---

## 🤖 How It Works

### The Agent Workflow

```
1. 🎨 ANALYZE FIGMA
   ├─ Extract design specs via Figma MCP
   ├─ Identify components, variants, tokens
   └─ Document interactions & states

2. 📦 MAP TO DESIGN SYSTEM
   ├─ Query Design System MCP
   ├─ Match Figma components to DS components
   ├─ Identify gaps in design system
   └─ Create component mapping

3. 💻 GENERATE CODE
   ├─ Create TypeScript components
   ├─ Use only design system components
   ├─ Implement business logic
   └─ Add proper error handling

4. 🧪 CREATE TESTS
   ├─ Generate unit tests
   ├─ Create integration tests
   ├─ Ensure coverage targets
   └─ Add accessibility tests

5. 📚 DOCUMENTATION
   ├─ Generate Storybook stories
   ├─ Create README with usage
   ├─ Document props & examples
   └─ Add inline code comments

6. ✅ VALIDATE
   ├─ Compare against Figma specs
   ├─ Run linting & type checking
   ├─ Execute test suite
   └─ Generate quality report
```

---

## 🔍 Troubleshooting

### Common Issues

**Agent gets stuck in a loop:**

```bash
# Increase max turns or adjust temperature
designforge start --max-turns 50
```

**Design system component not found:**

```bash
# Check your Design System MCP connection
designforge debug --check-mcp design-system
```

**Low test coverage:**

```bash
# Adjust coverage threshold
designforge start --coverage 70
```

### Debug Mode

```bash
# Enable verbose logging
designforge start --verbose

# Check MCP connectivity
designforge debug --check-mcp all

# Validate configuration
designforge validate-config
```

---

## 📊 Development

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=packages/core
```

### Testing

```bash
# Run all tests
npm test

# Run specific package tests
npm test --workspace=packages/core
```

### Development Mode

```bash
# Watch mode for CLI
npm run dev
```

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- Built with Claude AI by Anthropic
- Uses Model Context Protocol (MCP) for extensibility
- Inspired by modern design-to-code workflows
