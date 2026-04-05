import { Result, AdapterError } from '../errors';
import { BackendType } from '../enums';

export { BackendType };

export interface StandardLLMResponse {
  text: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: Array<{
    name: string;
    args: unknown;
  }>;
}

export interface ILLMBackend {
  id: string;
  type: BackendType;
  /** Verifica se il backend è pronto e raggiungibile */
  isAvailable(): Promise<boolean>;
  /** Esegue la generazione del testo astraendo l'implementazione specifica */
  generate(prompt: string, options?: Record<string, unknown>): Promise<Result<StandardLLMResponse, AdapterError>>;
}
