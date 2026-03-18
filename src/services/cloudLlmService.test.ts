import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateWithOpenAI, generateWithAnthropic, generateWithGroq, generateWithDeepSeek } from './cloudLlmService';

describe('cloudLlmService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Mocked response' } }],
        content: [{ text: 'Mocked response' }]
      })
    });
  });

  it('should pass systemPrompt to OpenAI API', async () => {
    const prompt = 'Hello';
    const apiKey = 'test-key';
    const systemPrompt = 'You are a helpful assistant.';
    
    await generateWithOpenAI(prompt, apiKey, undefined, systemPrompt);
    
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/llm/generate',
      expect.objectContaining({
        body: expect.stringContaining(JSON.stringify({
          provider: "openai",
          prompt,
          apiKey,
          stream: false,
          systemPrompt
        }))
      })
    );
  });

  it('should pass systemPrompt to Anthropic API', async () => {
    const prompt = 'Hello';
    const apiKey = 'test-key';
    const systemPrompt = 'You are a helpful assistant.';
    
    await generateWithAnthropic(prompt, apiKey, undefined, systemPrompt);
    
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/llm/generate',
      expect.objectContaining({
        body: expect.stringContaining(JSON.stringify({
          provider: "anthropic",
          prompt,
          apiKey,
          stream: false,
          systemPrompt
        }))
      })
    );
  });

  it('should pass systemPrompt to Groq API', async () => {
    const prompt = 'Hello';
    const apiKey = 'test-key';
    const systemPrompt = 'You are a helpful assistant.';
    
    await generateWithGroq(prompt, apiKey, undefined, systemPrompt);
    
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/llm/generate',
      expect.objectContaining({
        body: expect.stringContaining(JSON.stringify({
          provider: "groq",
          prompt,
          apiKey,
          stream: false,
          systemPrompt
        }))
      })
    );
  });

  it('should pass systemPrompt to DeepSeek API', async () => {
    const prompt = 'Hello';
    const apiKey = 'test-key';
    const systemPrompt = 'You are a helpful assistant.';
    
    await generateWithDeepSeek(prompt, apiKey, undefined, systemPrompt);
    
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/llm/generate',
      expect.objectContaining({
        body: expect.stringContaining(JSON.stringify({
          provider: "deepseek",
          prompt,
          apiKey,
          stream: false,
          systemPrompt
        }))
      })
    );
  });
});
