import * as fs from 'fs';
import * as path from 'path';

// ==============================================================================
// Parsed Code Block
// ==============================================================================

export interface ParsedCodeBlock {
  filePath: string;
  content: string;
  language: string;
}

// ==============================================================================
// Code Block Parser
// ==============================================================================
// Extracts fenced code blocks from LLM markdown output and attempts to
// determine the target file path for each block.
//
// Recognized patterns (checked in priority order):
//   1. Explicit attribute:  ```tsx filename="Button/Button.tsx"
//   2. Info-string path:    ```tsx Button/Button.tsx
//   3. First-line comment:  // Button/Button.tsx  (must contain a file extension)
//   4. Preceding context:   **File:** Button.tsx  or  ### Button.tsx
//
// Blocks without a recognizable file path are skipped — they're likely
// inline code examples in the LLM's explanation.

// Regex for fenced code blocks: opening ```, optional language + metadata,
// then content until closing ``` on its own line.
// [ \t]* instead of \s* — only match horizontal whitespace after the language
// tag, NOT newlines. Otherwise \s* eats the newline and shifts the info
// string capture to the first line of the code body.
const CODE_FENCE_REGEX = /^```(\w*)[ \t]*(.*?)\n([\s\S]*?)^```$/gm;

// Patterns to extract a file path from different locations
const FILENAME_ATTR_REGEX = /filename\s*=\s*"([^"]+)"/;
const FILE_EXTENSION_REGEX = /\.(tsx?|jsx?|css|scss|less|json|md|html|yaml|yml)$/i;
const FIRST_LINE_COMMENT_REGEX = /^\/\/\s*(.+\.\w+)\s*$/;
const PRECEDING_FILE_REGEX = /(?:\*\*File:\*\*|###)\s*`?([^\n`]+\.\w+)`?\s*$/;

export function parseCodeBlocks(text: string): ParsedCodeBlock[] {
  const blocks: ParsedCodeBlock[] = [];

  // Split text into lines so we can look at context before each code fence
  let match: RegExpExecArray | null;

  // Reset lastIndex since we reuse the regex
  CODE_FENCE_REGEX.lastIndex = 0;

  while ((match = CODE_FENCE_REGEX.exec(text)) !== null) {
    const language = match[1] || '';
    const infoString = match[2] || '';
    const content = match[3];
    const matchStart = match.index;

    // Skip empty blocks
    if (!content.trim()) continue;

    let filePath: string | null = null;

    // Strategy 1: filename="..." attribute in info string
    const attrMatch = infoString.match(FILENAME_ATTR_REGEX);
    if (attrMatch) {
      filePath = attrMatch[1];
    }

    // Strategy 2: file path directly in info string (after language)
    if (!filePath && infoString.trim()) {
      const candidate = infoString.trim();
      if (FILE_EXTENSION_REGEX.test(candidate)) {
        filePath = candidate;
      }
    }

    // Strategy 3: first line of content is a comment with a file path
    if (!filePath) {
      const firstLine = content.split('\n')[0].trim();
      const commentMatch = firstLine.match(FIRST_LINE_COMMENT_REGEX);
      if (commentMatch && FILE_EXTENSION_REGEX.test(commentMatch[1])) {
        filePath = commentMatch[1];
      }
    }

    // Strategy 4: look at the text immediately before the code fence
    if (!filePath) {
      const textBefore = text.slice(Math.max(0, matchStart - 200), matchStart);
      const precedingMatch = textBefore.match(PRECEDING_FILE_REGEX);
      if (precedingMatch) {
        filePath = precedingMatch[1].trim();
      }
    }

    // Only include blocks where we found a file path
    if (filePath) {
      // Clean the content: if first line was the filename comment, remove it
      let cleanContent = content;
      const firstLine = content.split('\n')[0].trim();
      const commentMatch = firstLine.match(FIRST_LINE_COMMENT_REGEX);
      if (commentMatch && commentMatch[1] === filePath) {
        cleanContent = content.split('\n').slice(1).join('\n');
      }

      blocks.push({
        filePath: filePath.trim(),
        content: cleanContent.trimEnd() + '\n',
        language,
      });
    }
  }

  return blocks;
}

// ==============================================================================
// File Writer
// ==============================================================================
// Writes parsed code blocks to disk. Creates directories as needed.
// Returns the list of absolute paths that were written.

export async function writeCodeBlocks(
  blocks: ParsedCodeBlock[],
  outputPath: string,
): Promise<string[]> {
  const writtenPaths: string[] = [];

  for (const block of blocks) {
    const fullPath = path.resolve(outputPath, block.filePath);

    // Safety: ensure the resolved path is actually under outputPath
    // to prevent directory traversal attacks from LLM output
    const resolvedOutput = path.resolve(outputPath);
    if (!fullPath.startsWith(resolvedOutput)) {
      continue; // Skip paths that escape the output directory
    }

    // Create parent directories
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, block.content, 'utf-8');
    writtenPaths.push(fullPath);
  }

  return writtenPaths;
}
