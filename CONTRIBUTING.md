# Contributing to DesignForge

Thank you for your interest in contributing to DesignForge! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Git
- Anthropic API key (for testing)

### Setup Development Environment

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/designforge.git
   cd designforge
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build packages:
   ```bash
   npm run build
   ```

5. Create `.env` file:
   ```bash
   cp .env.example .env
   # Add your API keys
   ```

## Development Workflow

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Run tests:
   ```bash
   npm test
   ```

4. Run linter:
   ```bash
   npm run lint
   ```

5. Build packages:
   ```bash
   npm run build
   ```

### Commit Messages

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes

**Examples:**
```
feat(agent): add support for Vue framework
fix(cli): handle missing environment variables
docs(readme): update installation instructions
```

## Project Structure

```
designforge/
├── packages/
│   ├── core/        # Core agent logic
│   ├── cli/         # CLI interface
│   └── ...
├── examples/        # Usage examples
├── docs/            # Documentation
└── tests/           # Integration tests
```

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run specific package tests
npm test --workspace=packages/core

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### Integration Tests

```bash
# Run integration tests (requires API key)
npm run test:integration
```

### Manual Testing

```bash
# Test CLI locally
cd packages/cli
node dist/cli.js start --figma <url> --output ./test-output --verbose
```

## Code Style

We use ESLint and Prettier for code formatting.

```bash
# Lint
npm run lint

# Fix linting issues
npm run lint:fix

# Format with Prettier
npx prettier --write "packages/*/src/**/*.ts"
```

## Documentation

### Update Documentation

- README.md - Main project overview
- docs/ - Detailed guides
- API comments - JSDoc for public APIs
- CHANGELOG.md - Record of changes

### Writing Docs

- Use clear, concise language
- Include code examples
- Add screenshots where helpful
- Keep documentation up to date

## Pull Request Process

1. **Update Documentation**: Ensure docs reflect your changes

2. **Add Tests**: Include tests for new features

3. **Update CHANGELOG**: Add entry to CHANGELOG.md

4. **Submit PR**:
   - Use descriptive title
   - Reference related issues
   - Provide detailed description
   - Add screenshots/examples if applicable

5. **Code Review**:
   - Address reviewer feedback
   - Keep PR focused and small
   - Squash commits if needed

6. **Merge**:
   - Maintainers will merge after approval
   - Delete branch after merge

## Issue Guidelines

### Reporting Bugs

Include:
- DesignForge version
- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs

Template:
```markdown
**Bug Description**
Clear description of the bug

**To Reproduce**
1. Step 1
2. Step 2
3. ...

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- DesignForge: v0.1.0
- Node: v18.0.0
- OS: macOS 13.0

**Logs**
```
paste logs here
```
```

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternative solutions
- Additional context

## Development Tips

### Debugging

Enable verbose logging:
```bash
designforge start --figma <url> --output ./output --verbose
```

View agent conversation:
```typescript
const agent = new DesignForgeAgent(config);
agent.run((progress) => {
  console.log('Turn:', progress.turn);
  console.log('Message:', progress.message);
});
```

### Testing with Mock MCP Servers

The agent includes mock MCP responses for development. To use real MCP servers:

1. Set up Figma MCP server
2. Set up Design System MCP server
3. Configure paths in `.env`

### Performance Testing

```bash
# Profile agent execution
node --prof packages/cli/dist/cli.js start ...

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

## Release Process

(For maintainers)

1. Update version in package.json files
2. Update CHANGELOG.md
3. Create git tag: `git tag v0.x.0`
4. Push tag: `git push origin v0.x.0`
5. Publish to npm: `npm publish --workspace=packages/core`

## Questions?

- Open an issue for questions
- Join our Discord community
- Email: support@brevo.com

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
