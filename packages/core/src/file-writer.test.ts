import * as fs from 'fs';
import * as path from 'path';
import { parseCodeBlocks, writeCodeBlocks } from './file-writer';

describe('parseCodeBlocks', () => {
  it('should parse blocks with file path in info string', () => {
    const text = [
      'Here is the component:',
      '',
      '```tsx Button/Button.tsx',
      'export function Button() {',
      '  return <button>Click</button>;',
      '}',
      '```',
    ].join('\n');

    const blocks = parseCodeBlocks(text);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].filePath).toBe('Button/Button.tsx');
    expect(blocks[0].language).toBe('tsx');
    expect(blocks[0].content).toContain('export function Button()');
  });

  it('should parse blocks with filename="..." attribute', () => {
    const text = [
      '```tsx filename="Card/Card.tsx"',
      'export function Card() { return <div />; }',
      '```',
    ].join('\n');

    const blocks = parseCodeBlocks(text);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].filePath).toBe('Card/Card.tsx');
  });

  it('should parse blocks with first-line comment file path', () => {
    const text = [
      '```typescript',
      '// Header/Header.types.ts',
      'export interface HeaderProps {',
      '  title: string;',
      '}',
      '```',
    ].join('\n');

    const blocks = parseCodeBlocks(text);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].filePath).toBe('Header/Header.types.ts');
    // The comment line with the filename should be removed from content
    expect(blocks[0].content).not.toContain('// Header/Header.types.ts');
    expect(blocks[0].content).toContain('export interface HeaderProps');
  });

  it('should parse blocks with preceding **File:** label', () => {
    const text = [
      '**File:** Modal/index.ts',
      '```ts',
      "export { Modal } from './Modal';",
      '```',
    ].join('\n');

    const blocks = parseCodeBlocks(text);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].filePath).toBe('Modal/index.ts');
  });

  it('should parse blocks with preceding ### heading', () => {
    const text = [
      '### Toggle/Toggle.test.tsx',
      '```tsx',
      "import { render } from '@testing-library/react';",
      '```',
    ].join('\n');

    const blocks = parseCodeBlocks(text);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].filePath).toBe('Toggle/Toggle.test.tsx');
  });

  it('should parse multiple blocks from one response', () => {
    const text = [
      '```tsx Form/Form.tsx',
      'export function Form() { return <form />; }',
      '```',
      '',
      '```tsx Form/Form.test.tsx',
      "import { render } from '@testing-library/react';",
      '```',
      '',
      '```tsx Form/Form.stories.tsx',
      "import type { Meta } from '@storybook/react';",
      '```',
    ].join('\n');

    const blocks = parseCodeBlocks(text);

    expect(blocks).toHaveLength(3);
    expect(blocks[0].filePath).toBe('Form/Form.tsx');
    expect(blocks[1].filePath).toBe('Form/Form.test.tsx');
    expect(blocks[2].filePath).toBe('Form/Form.stories.tsx');
  });

  it('should skip blocks without a recognizable file path', () => {
    const text = [
      'Here is an example of usage:',
      '',
      '```tsx',
      '<Button variant="primary">Click</Button>',
      '```',
    ].join('\n');

    const blocks = parseCodeBlocks(text);

    expect(blocks).toHaveLength(0);
  });

  it('should skip empty code blocks', () => {
    const text = [
      '```tsx Button.tsx',
      '',
      '```',
    ].join('\n');

    const blocks = parseCodeBlocks(text);

    expect(blocks).toHaveLength(0);
  });
});

describe('writeCodeBlocks', () => {
  const testOutputDir = path.join(__dirname, '__test_output__');

  beforeEach(() => {
    // Clean test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  });

  it('should write files to the output directory', async () => {
    const blocks = [
      {
        filePath: 'Button/Button.tsx',
        content: 'export function Button() {}\n',
        language: 'tsx',
      },
    ];

    const written = await writeCodeBlocks(blocks, testOutputDir);

    expect(written).toHaveLength(1);
    const filePath = path.join(testOutputDir, 'Button/Button.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('export function Button() {}\n');
  });

  it('should create nested directories', async () => {
    const blocks = [
      {
        filePath: 'deep/nested/Component.tsx',
        content: 'export default {};\n',
        language: 'tsx',
      },
    ];

    const written = await writeCodeBlocks(blocks, testOutputDir);

    expect(written).toHaveLength(1);
    expect(fs.existsSync(path.join(testOutputDir, 'deep/nested/Component.tsx'))).toBe(true);
  });

  it('should reject directory traversal paths', async () => {
    const blocks = [
      {
        filePath: '../../etc/evil.sh',
        content: 'echo pwned\n',
        language: 'sh',
      },
    ];

    const written = await writeCodeBlocks(blocks, testOutputDir);

    // File should NOT be written — path escapes outputPath
    expect(written).toHaveLength(0);
  });

  it('should write multiple files', async () => {
    const blocks = [
      { filePath: 'a.ts', content: 'const a = 1;\n', language: 'ts' },
      { filePath: 'b.ts', content: 'const b = 2;\n', language: 'ts' },
    ];

    const written = await writeCodeBlocks(blocks, testOutputDir);

    expect(written).toHaveLength(2);
  });
});
