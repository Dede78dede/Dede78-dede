import { ILLMBackend, StandardLLMResponse, BackendType } from '../types';
import { AdapterError, Result } from '../../errors';

export class OllamaAdapter implements ILLMBackend {
  public id: string;
  public type: BackendType = 'ollama';
  private baseUrl: string;
  private modelName: string;

  constructor(modelName: string = 'llama3', baseUrl: string = 'http://localhost:11434', id: string = 'ollama-local') {
    this.id = id;
    this.modelName = modelName;
    this.baseUrl = baseUrl;
  }

  public async isAvailable(): Promise<boolean> {
    try {
      // Ping veloce per vedere se il demone Ollama è attivo
      const res = await fetch(`${this.baseUrl}/api/tags`, { 
        method: 'GET', 
        signal: AbortSignal.timeout(2000) 
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  public async generate(prompt: string, options?: Record<string, unknown>): Promise<Result<StandardLLMResponse, AdapterError>> {
    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt: prompt,
          system: options?.system_prompt,
          stream: false,
          options: {
            temperature: options?.temperature,
            num_predict: options?.max_tokens
          }
        })
      });

      if (!res.ok) {
        return [new AdapterError(`OllamaAdapter Error: ${res.statusText}`, 'Ollama'), null];
      }
      
      const data = await res.json() as { 
        response: string; 
        prompt_eval_count?: number; 
        eval_count?: number; 
      };

      return [null, {
        text: data.response,
        provider: 'Ollama',
        model: this.modelName,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        }
      }];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return [new AdapterError(`Generazione fallita: ${errorMessage}`, 'Ollama'), null];
    }
  }
}
