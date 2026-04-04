import { GoogleGenAI, Type, FunctionDeclaration, Tool } from '@google/genai';
import { ILLMBackend, StandardLLMResponse, BackendType } from '../types';
import { MCPTool, zodToJsonSchema } from '../../mcp/types';
import { AdapterError, Result } from '../../errors';

export class CloudAdapter implements ILLMBackend {
  public id: string;
  public type: BackendType = 'cloud';
  private ai: GoogleGenAI;
  private modelName: string;

  constructor(modelName: string = 'gemini-3.1-flash-preview', id: string = 'gemini-cloud') {
    this.id = id;
    this.modelName = modelName;
    
    // Inizializza l'SDK di Gemini. 
    // Supporta sia l'ambiente Node.js (process.env) che Vite/Browser (import.meta.env)
    const apiKey = typeof process !== 'undefined' && process.env.GEMINI_API_KEY 
      ? process.env.GEMINI_API_KEY 
      : (typeof import.meta !== 'undefined' && (import.meta as unknown as { env: { VITE_GEMINI_API_KEY: string } }).env?.VITE_GEMINI_API_KEY);

    this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
  }

  public async isAvailable(): Promise<boolean> {
    const apiKey = typeof process !== 'undefined' && process.env.GEMINI_API_KEY 
      ? process.env.GEMINI_API_KEY 
      : (typeof import.meta !== 'undefined' && (import.meta as unknown as { env: { VITE_GEMINI_API_KEY: string } }).env?.VITE_GEMINI_API_KEY);
      
    return !!apiKey;
  }

  private mapMCPToolsToGemini(tools?: MCPTool[]): Tool[] | undefined {
    if (!tools || tools.length === 0) return undefined;

    const functionDeclarations: FunctionDeclaration[] = tools.map(tool => {
      const jsonSchema = zodToJsonSchema(tool.schema);
      
      // Gemini richiede che il type radice sia Type.OBJECT
      const parameters = {
        type: Type.OBJECT,
        properties: {} as Record<string, { type: Type; description: string }>,
        required: (jsonSchema.required as string[]) || []
      };

      if (jsonSchema.properties) {
        for (const [key, prop] of Object.entries(jsonSchema.properties)) {
          const propSchema = prop as { type: string; description?: string };
          parameters.properties[key] = {
            type: propSchema.type.toUpperCase() as Type,
            description: propSchema.description || ''
          };
        }
      }

      return {
        name: tool.name,
        description: tool.description,
        parameters
      };
    });

    return [{ functionDeclarations }];
  }

  public async generate(prompt: string, options?: Record<string, unknown>): Promise<Result<StandardLLMResponse, AdapterError>> {
    try {
      const tools = this.mapMCPToolsToGemini(options?.tools as MCPTool[] | undefined);
      
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          temperature: options?.temperature as number | undefined,
          maxOutputTokens: options?.max_tokens as number | undefined,
          systemInstruction: options?.system_prompt as string | undefined,
          tools: tools
        }
      });

      // Se il modello decide di chiamare un tool, gestiamo la risposta
      if (response.functionCalls && response.functionCalls.length > 0) {
        return [null, {
          text: '',
          provider: 'Google',
          model: this.modelName,
          toolCalls: response.functionCalls.map(call => ({
            name: call.name,
            args: call.args
          }))
        }];
      }

      return [null, {
        text: response.text || '',
        provider: 'Google',
        model: this.modelName,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0
        }
      }];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return [new AdapterError(`Generazione fallita: ${errorMessage}`, 'Google Gemini'), null];
    }
  }
}
