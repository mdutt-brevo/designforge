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

      // Mock the Anthropic API
      jest.spyOn(agent as any, 'anthropic.messages.create').mockResolvedValue({
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

      await agent.run(progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback.mock.calls[0][0]).toHaveProperty('turn');
      expect(progressCallback.mock.calls[0][0]).toHaveProperty('status');
    });

    it('should throw if max turns exceeded', async () => {
      const agent = new DesignForgeAgent({ ...mockConfig, maxTurns: 1 });

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
