import { ILLMBackend, BackendType } from './types';

export class BackendRegistry {
  private static instance: BackendRegistry;
  private backends: Map<string, ILLMBackend> = new Map();

  private constructor() {}

  public static getInstance(): BackendRegistry {
    if (!BackendRegistry.instance) {
      BackendRegistry.instance = new BackendRegistry();
    }
    return BackendRegistry.instance;
  }

  public register(backend: ILLMBackend): void {
    this.backends.set(backend.id, backend);
  }

  public getBackend(id: string): ILLMBackend | undefined {
    return this.backends.get(id);
  }

  public getBackendsByType(type: BackendType): ILLMBackend[] {
    return Array.from(this.backends.values()).filter(b => b.type === type);
  }

  public getAllBackends(): ILLMBackend[] {
    return Array.from(this.backends.values());
  }
}
