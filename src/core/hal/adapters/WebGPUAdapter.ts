import { CreateMLCEngine, MLCEngine } from '@mlc-ai/web-llm';
import { ILLMBackend, StandardLLMResponse, BackendType } from '../types';
import { AdapterError, Result } from '../../errors';

export class WebGPUAdapter implements ILLMBackend {
  public id: string;
  public type: BackendType = BackendType.WEBGPU;
  private engine: MLCEngine | null = null;
  private modelId: string;
  private isInitializing = false;

  constructor(modelId: string = 'Qwen2-0.5B-Instruct-q4f16_1-MLC', id: string = 'webgpu-local') {
    this.id = id;
    this.modelId = modelId;
  }

  public async isAvailable(): Promise<boolean> {
    // Verifica se l'ambiente supporta WebGPU (SSR-safe)
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('gpu' in navigator)) {
      return false;
    }
    return true;
  }

  private async initEngine(): Promise<Result<void, AdapterError>> {
    if (this.engine) return [null, void 0];
    
    // Evita inizializzazioni concorrenti
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return [null, void 0];
    }

    this.isInitializing = true;
    try {
      this.engine = await CreateMLCEngine(this.modelId, {
        initProgressCallback: (progress) => {
          console.log(`[WebGPU] Caricamento modello in VRAM: ${progress.text}`);
        }
      });
      return [null, void 0];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[WebGPU] Errore inizializzazione:', errorMessage);
      return [new AdapterError(`Inizializzazione fallita: ${errorMessage}`, 'WebLLM'), null];
    } finally {
      this.isInitializing = false;
    }
  }

  public async generate(prompt: string, options?: Record<string, unknown>): Promise<Result<StandardLLMResponse, AdapterError>> {
    const [initError] = await this.initEngine();
    if (initError) return [initError, null];
    
    if (!this.engine) {
      return [new AdapterError('WebGPU Engine non inizializzato correttamente.', 'WebLLM'), null];
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (options?.system_prompt) {
      messages.push({ role: 'system', content: options.system_prompt as string });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      const response = await this.engine.chat.completions.create({
        messages: messages,
        temperature: options?.temperature as number | undefined,
        max_tokens: options?.max_tokens as number | undefined,
      });

      return [null, {
        text: response.choices[0]?.message.content || '',
        provider: 'WebLLM',
        model: this.modelId,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      }];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return [new AdapterError(`Generazione fallita: ${errorMessage}`, 'WebLLM'), null];
    }
  }
}
