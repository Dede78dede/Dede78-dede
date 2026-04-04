import { pipeline, TextGenerationPipeline } from '@huggingface/transformers';
import { ILLMBackend, StandardLLMResponse, BackendType } from '../types';
import { AdapterError, Result } from '../../errors';

export class WASMAdapter implements ILLMBackend {
  public id: string;
  public type: BackendType = 'wasm';
  private generator: TextGenerationPipeline | null = null;
  private modelId: string;
  private isInitializing = false;

  constructor(modelId: string = 'Xenova/TinyLlama-1.1B-Chat-v1.0', id: string = 'wasm-local') {
    this.id = id;
    this.modelId = modelId;
  }

  public async isAvailable(): Promise<boolean> {
    // WASM è supportato praticamente ovunque nei browser moderni, ma non lo usiamo in Node.js per ora
    return typeof window !== 'undefined';
  }

  private async initGenerator(): Promise<Result<void, AdapterError>> {
    if (this.generator) return [null, void 0];
    
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return [null, void 0];
    }

    this.isInitializing = true;
    try {
      // Determina il device ottimale
      const isWebGPUSupported = typeof navigator !== 'undefined' && 'gpu' in navigator;
      const device = isWebGPUSupported ? 'webgpu' : 'wasm';
      
      this.generator = (await pipeline('text-generation', this.modelId, {
        device: device as any,
        progress_callback: (progress: unknown) => {
          const p = progress as { status?: string; file?: string; progress?: number };
          if (p.status === 'downloading' && p.file && p.progress !== undefined) {
            console.log(`[WASM] Download pesi: ${p.file} - ${Math.round(p.progress)}%`);
          }
        }
      })) as unknown as TextGenerationPipeline;
      return [null, void 0];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[WASM] Errore inizializzazione:', errorMessage);
      return [new AdapterError(`Inizializzazione fallita: ${errorMessage}`, 'Transformers.js'), null];
    } finally {
      this.isInitializing = false;
    }
  }

  public async generate(prompt: string, options?: Record<string, unknown>): Promise<Result<StandardLLMResponse, AdapterError>> {
    const [initError] = await this.initGenerator();
    if (initError) return [initError, null];
    
    if (!this.generator) {
      return [new AdapterError('WASM Generator non inizializzato correttamente.', 'Transformers.js'), null];
    }

    // Formattazione base del prompt (dipende dal modello, qui usiamo un template generico)
    const systemPrompt = options?.system_prompt ? `<|system|>\n${options.system_prompt}\n` : '';
    const formattedPrompt = `${systemPrompt}<|user|>\n${prompt}\n<|assistant|>\n`;

    try {
      const result = await this.generator(formattedPrompt, {
        max_new_tokens: (options?.max_tokens as number) || 256,
        temperature: (options?.temperature as number) || 0.7,
      });

      let generatedText = '';
      if (Array.isArray(result) && result.length > 0) {
          const res = result[0] as { generated_text: string };
          generatedText = res.generated_text.replace(formattedPrompt, '').trim();
      }

      return [null, {
        text: generatedText,
        provider: 'Transformers.js',
        model: this.modelId,
        usage: {
          promptTokens: 0, // Transformers.js non espone nativamente il conteggio token
          completionTokens: 0,
          totalTokens: 0
        }
      }];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return [new AdapterError(`Generazione fallita: ${errorMessage}`, 'Transformers.js'), null];
    }
  }
}
