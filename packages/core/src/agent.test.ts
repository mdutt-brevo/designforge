import { DesignForgeAgent, DesignForgeConfig } from './agent';

describe('DesignForgeAgent', () => {
  const mockConfig: DesignForgeConfig = {
    figmaUrl: 'https://figma.com/file/test123',
    outputPath: './test-output',
    anthropicApiKey: 'sk-ant-test-key',
    minCoverage: 80,
    maxTurns: 5,
    verbose: false
  };

  describe('constructor', () => {
    it('should create an agent instance', () => {
      const agent = new DesignForgeAgent(mockConfig);
      expect(agent).toBeInstanceOf(DesignForgeAgent);
    });

    it('should throw if API key is missing', () => {
      const invalidConfig = { ...mockConfig, anthropicApiKey: '' };
      expect(() => new DesignForgeAgent(invalidConfig)).toThrow();
    });
  });

  describe('run', () => {
    it('should execute workflow and return result', async () => {
      const agent = new DesignForgeAgent(mockConfig);

      // Mock the Anthropic API — spy on the nested object, not a dotted path
      jest.spyOn((agent as any).anthropic.messages, 'create').mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'WORKFLOW COMPLETE - Generated components successfully'
          }
        ],
        stop_reason: 'end_turn'
      });

      const result = await agent.run();

      expect(result).toBeDefined();
      expect(result.status).toBe('complete');
    });

    it('should call progress callback on each turn', async () => {
      const agent = new DesignForgeAgent(mockConfig);
      const progressCallback = jest.fn();

      // Mock multi-turn conversation: figma tool → design-system tool → completion
      jest.spyOn((agent as any).anthropic.messages, 'create')
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'figma',
              input: { action: 'get_file', file_url: mockConfig.figmaUrl }
            }
          ],
          stop_reason: 'tool_use'
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tool-2',
              name: 'design-system',
              input: { action: 'list_components' }
            }
          ],
          stop_reason: 'tool_use'
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: 'WORKFLOW COMPLETE - All components generated'
            }
          ],
          stop_reason: 'end_turn'
        });

      await agent.run(progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback.mock.calls[0][0]).toHaveProperty('turn');
      expect(progressCallback.mock.calls[0][0]).toHaveProperty('status');
    });

    it('should throw if max turns exceeded', async () => {
      const agent = new DesignForgeAgent({ ...mockConfig, maxTurns: 1 });

      // Mock LLM to return non-completion text so the loop exhausts maxTurns
      jest.spyOn((agent as any).anthropic.messages, 'create').mockResolvedValue({
        content: [
          { type: 'text', text: 'Still working on Phase 1...' }
        ],
        stop_reason: 'end_turn'
      });

      await expect(agent.run()).rejects.toThrow('Agent did not complete within 1 turns');
    });
  });

  describe('configuration', () => {
    it('should use default values for optional config', () => {
      const minimalConfig: DesignForgeConfig = {
        figmaUrl: 'https://figma.com/file/test123',
        outputPath: './output',
        anthropicApiKey: 'sk-ant-test-key'
      };

      const agent = new DesignForgeAgent(minimalConfig);

      // Check defaults are applied
      expect((agent as any).config.minCoverage).toBeUndefined(); // Uses 80 in system prompt
      expect((agent as any).config.maxTurns).toBeUndefined(); // Uses 30 default
    });
  });
});
