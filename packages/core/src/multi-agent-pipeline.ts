import Anthropic from '@anthropic-ai/sdk';

// ==============================================================================
// Multi-Agent Pipeline Types
// ==============================================================================

export interface PlannerOutput {
  plan: string[];
  files: string[];
  interfaces: string[];
  dependencies: string[];
  risks: string[];
  validation: string[];
  rawResponse: string;
}

export interface CoderOutput {
  code: string;
  rawResponse: string;
}

export interface ReviewerOutput {
  issues: string[];
  fixRequired: boolean;
  rawResponse: string;
}

export interface FixerOutput {
  code: string;
  rawResponse: string;
}

export interface PipelineConfig {
  anthropicApiKey: string;
  baseURL?: string;
  model: string;
  verbose?: boolean;
}

export interface PipelineContext {
  figmaData: string;
  naosComponents: string;
  naosTokens: string;
  userRequest: string;
}

// ==============================================================================
// Agent-Specific Configuration
// ==============================================================================

const AGENT_CONFIG = {
  planner: {
    temperature: 0.1,
    maxTokens: 4096,
    repeatPenalty: 1.1,
  },
  coder: {
    temperature: 0.2,
    maxTokens: 8192,
    repeatPenalty: 1.15,
  },
  reviewer: {
    temperature: 0.1,
    maxTokens: 4096,
  },
  fixer: {
    temperature: 0.15,
    maxTokens: 8192,
  },
};

// ==============================================================================
// System Prompts
// ==============================================================================

const PLANNER_SYSTEM_PROMPT = `You are a senior software architect and technical planner for a Figma-to-React code generation system.

Your task is to break down the user's request into precise, step-by-step implementation instructions for generating React/TypeScript components from Figma designs.

Do NOT write any code.

Focus on:
- architecture and component structure
- file structure and naming
- which @dtsl/react components to use
- React component hierarchy
- props and TypeScript interfaces
- state management approach
- data flow from Figma design to React components
- edge cases (empty states, loading, errors)
- accessibility considerations
- responsive design requirements
- dependencies from @dtsl/react

Be specific and concrete.

Bad example:
- Create component

Good example:
- Create file ConversionsROI/ConversionsROI.tsx
- Define ConversionsROIProps interface with fields: title (string), metrics (MetricData[]), onRefresh (function)
- Import Button, Card, Typography from @dtsl/react
- Implement MetricCard child component for displaying individual metrics

Output EXACTLY in this format:

PLAN:
1. [First step]
2. [Second step]
3. [Third step]

FILES:
- path/ComponentName.tsx
- path/ComponentName.test.tsx
- path/ComponentName.stories.tsx

INTERFACES:
- InterfaceName: description of fields

DEPENDENCIES:
- @dtsl/react/Button
- @dtsl/react/Card

RISKS:
- [Potential issue or edge case]

VALIDATION:
- [How to validate this implementation]

This forces structured thinking.`;

const CODER_SYSTEM_PROMPT = `You are a senior software engineer specializing in React and TypeScript.

Implement the requested code strictly following the provided PLAN.

Follow these rules:
- Follow the plan exactly - do NOT deviate
- Do NOT add unnecessary features or embellishments
- Do NOT use React.FC (use regular function components)
- Use TypeScript with proper types
- Use functional components with hooks
- Write clean, production-quality code
- No placeholders or TODO comments
- No pseudo-code
- ONLY use components from @dtsl/react that are available in the Naos component docs
- Do NOT use custom CSS classes - use @dtsl/react components and their props
- Export components as named exports
- Include proper TypeScript interfaces for all props

Code style:
- Use const for components: \`const ComponentName = (props: Props) => { ... }\`
- Destructure props in the parameter
- Use early returns for conditional rendering
- Keep components focused and single-responsibility

Output ONLY code blocks with file paths.
Format each file as:

\`\`\`tsx path/to/File.tsx
// code here
\`\`\`

Do NOT write explanations.`;

const REVIEWER_SYSTEM_PROMPT = `You are a senior code reviewer with expertise in React, TypeScript, and design systems.

Review the provided code for:
- bugs and incorrect logic
- violations of the plan or instructions
- TypeScript type errors or \`any\` usage
- React anti-patterns (e.g., using React.FC, incorrect hooks usage)
- improper use of @dtsl/react components
- custom CSS classes instead of design system components
- missing TypeScript interfaces
- accessibility issues
- repetitive code patterns (code degeneration)
- incorrect imports
- missing error boundaries
- unused imports or variables

Be critical and thorough.

Output format:

ISSUES:
- [Specific issue with location, e.g., "File.tsx line 15: Using React.FC instead of regular function"]
- [Another issue]

FIX_REQUIRED: YES or NO

If there are no issues, output:
ISSUES:
- None

FIX_REQUIRED: NO`;

const FIXER_SYSTEM_PROMPT = `You are a senior software engineer.

Fix ALL issues identified in the review.

Return the FULL corrected code for ALL files.

Do NOT explain anything.
Do NOT add comments about what was fixed.
Output ONLY code blocks with file paths.

Format each file as:

\`\`\`tsx path/to/File.tsx
// corrected code here
\`\`\``;

// ==============================================================================
// Multi-Agent Pipeline
// ==============================================================================

export class MultiAgentPipeline {
  private anthropic: Anthropic;
  private config: PipelineConfig;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
      baseURL: config.baseURL || 'http://127.0.0.1:1234',
    });
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[MultiAgentPipeline] ${message}`);
    }
  }

  /**
   * Stage 1: Planner
   * Breaks down the request into structured plan
   */
  async runPlanner(context: PipelineContext): Promise<PlannerOutput> {
    this.log('Running Planner...');

    const userMessage = `# User Request
${context.userRequest}

# Figma Design Data (YAML)
${context.figmaData}

# Available Naos Components (@dtsl/react)
${context.naosComponents}

# Naos Design Tokens
${context.naosTokens}

Based on the Figma design data and available Naos components, create a detailed implementation plan.`;

    const response = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: AGENT_CONFIG.planner.maxTokens,
      temperature: AGENT_CONFIG.planner.temperature,
      system: PLANNER_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const rawResponse = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    this.log(`Planner output:\n${rawResponse.substring(0, 500)}...`);

    return this.parsePlannerOutput(rawResponse);
  }

  private parsePlannerOutput(text: string): PlannerOutput {
    const plan: string[] = [];
    const files: string[] = [];
    const interfaces: string[] = [];
    const dependencies: string[] = [];
    const risks: string[] = [];
    const validation: string[] = [];

    const sections = {
      PLAN: plan,
      FILES: files,
      INTERFACES: interfaces,
      DEPENDENCIES: dependencies,
      RISKS: risks,
      VALIDATION: validation,
    };

    let currentSection: string[] | null = null;

    for (const line of text.split('\n')) {
      const trimmed = line.trim();

      // Check for section headers
      if (trimmed === 'PLAN:') {
        currentSection = plan;
        continue;
      } else if (trimmed === 'FILES:') {
        currentSection = files;
        continue;
      } else if (trimmed === 'INTERFACES:') {
        currentSection = interfaces;
        continue;
      } else if (trimmed === 'DEPENDENCIES:') {
        currentSection = dependencies;
        continue;
      } else if (trimmed === 'RISKS:') {
        currentSection = risks;
        continue;
      } else if (trimmed === 'VALIDATION:') {
        currentSection = validation;
        continue;
      }

      // Add content to current section
      if (currentSection && trimmed && trimmed.match(/^[-\d]/)) {
        // Remove leading dash or number
        const content = trimmed.replace(/^[-\d]+\.?\s*/, '');
        if (content) {
          currentSection.push(content);
        }
      }
    }

    return {
      plan,
      files,
      interfaces,
      dependencies,
      risks,
      validation,
      rawResponse: text,
    };
  }

  /**
   * Stage 2: Coder
   * Implements the plan
   */
  async runCoder(
    context: PipelineContext,
    plannerOutput: PlannerOutput
  ): Promise<CoderOutput> {
    this.log('Running Coder...');

    const userMessage = `# Implementation Plan
${plannerOutput.rawResponse}

# Figma Design Data
${context.figmaData}

# Available Naos Components
${context.naosComponents}

# Naos Design Tokens
${context.naosTokens}

Implement ALL files from the plan. Output code blocks ONLY.`;

    const response = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: AGENT_CONFIG.coder.maxTokens,
      temperature: AGENT_CONFIG.coder.temperature,
      system: CODER_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const rawResponse = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    this.log(`Coder generated ${rawResponse.length} characters of code`);

    return {
      code: rawResponse,
      rawResponse,
    };
  }

  /**
   * Stage 3: Reviewer
   * Reviews the code for issues
   */
  async runReviewer(
    plannerOutput: PlannerOutput,
    coderOutput: CoderOutput
  ): Promise<ReviewerOutput> {
    this.log('Running Reviewer...');

    const userMessage = `# Original Plan
${plannerOutput.rawResponse}

# Generated Code
${coderOutput.code}

Review the code against the plan and best practices. Identify ALL issues.`;

    const response = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: AGENT_CONFIG.reviewer.maxTokens,
      temperature: AGENT_CONFIG.reviewer.temperature,
      system: REVIEWER_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const rawResponse = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    this.log(`Reviewer output:\n${rawResponse}`);

    return this.parseReviewerOutput(rawResponse);
  }

  private parseReviewerOutput(text: string): ReviewerOutput {
    const issues: string[] = [];
    let fixRequired = false;

    let inIssuesSection = false;

    for (const line of text.split('\n')) {
      const trimmed = line.trim();

      if (trimmed === 'ISSUES:') {
        inIssuesSection = true;
        continue;
      }

      if (trimmed.startsWith('FIX_REQUIRED:')) {
        inIssuesSection = false;
        fixRequired = trimmed.includes('YES');
        continue;
      }

      if (inIssuesSection && trimmed && trimmed.startsWith('-')) {
        const issue = trimmed.replace(/^-\s*/, '');
        if (issue && issue.toLowerCase() !== 'none') {
          issues.push(issue);
        }
      }
    }

    return {
      issues,
      fixRequired: fixRequired || issues.length > 0,
      rawResponse: text,
    };
  }

  /**
   * Stage 4: Fixer
   * Fixes the issues identified by the reviewer
   */
  async runFixer(
    plannerOutput: PlannerOutput,
    coderOutput: CoderOutput,
    reviewerOutput: ReviewerOutput
  ): Promise<FixerOutput> {
    this.log('Running Fixer...');

    const userMessage = `# Original Plan
${plannerOutput.rawResponse}

# Generated Code
${coderOutput.code}

# Review Issues to Fix
${reviewerOutput.rawResponse}

Fix ALL issues. Return FULL corrected code.`;

    const response = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: AGENT_CONFIG.fixer.maxTokens,
      temperature: AGENT_CONFIG.fixer.temperature,
      system: FIXER_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const rawResponse = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    this.log(`Fixer generated ${rawResponse.length} characters of corrected code`);

    return {
      code: rawResponse,
      rawResponse,
    };
  }

  /**
   * Run the complete pipeline
   */
  async run(context: PipelineContext): Promise<string> {
    this.log('Starting multi-agent pipeline...');

    // Stage 1: Planning
    const plannerOutput = await this.runPlanner(context);
    this.log(`Plan created with ${plannerOutput.plan.length} steps`);

    // Stage 2: Coding
    const coderOutput = await this.runCoder(context, plannerOutput);

    // Stage 3: Review
    const reviewerOutput = await this.runReviewer(plannerOutput, coderOutput);
    this.log(`Review found ${reviewerOutput.issues.length} issues`);

    // Stage 4: Fix (if needed)
    if (reviewerOutput.fixRequired && reviewerOutput.issues.length > 0) {
      this.log('Fixes required - running Fixer...');
      const fixerOutput = await this.runFixer(
        plannerOutput,
        coderOutput,
        reviewerOutput
      );
      this.log('Pipeline complete (with fixes)');
      return fixerOutput.code;
    }

    this.log('Pipeline complete (no fixes needed)');
    return coderOutput.code;
  }
}
