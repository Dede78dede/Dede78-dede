import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateWithGemini } from './geminiService';

const generateContentMock = vi.fn().mockResolvedValue({
  text: 'Mocked response'
});

// Mock the @google/genai module
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: generateContentMock
      };
      constructor(options: any) {}
    },
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING'
    }
  };
});

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('should pass systemPrompt to Gemini API', async () => {
    const prompt = 'Hello';
    const systemPrompt = 'You are a helpful assistant.';
    
    await generateWithGemini(prompt, undefined, 'gemini-2.5-flash', systemPrompt);
    
    expect(generateContentMock).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: expect.objectContaining({
        systemInstruction: systemPrompt
      })
    });
  });

  it('should use default systemPrompt if not provided', async () => {
    const prompt = 'Hello';
    
    await generateWithGemini(prompt, undefined, 'gemini-2.5-flash');
    
    expect(generateContentMock).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: expect.objectContaining({
        systemInstruction: expect.stringContaining('Sei un assistente AI esperto')
      })
    });
  });
});
