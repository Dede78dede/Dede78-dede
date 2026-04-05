import { IRouterMiddleware, RoutingContext, PrivacyLevel } from '../types';
import { BackendRegistry } from '../../hal/BackendRegistry';
import { BackendType } from '../../enums';

export class CostMiddleware implements IRouterMiddleware {
  public async handle(context: RoutingContext, next: () => Promise<void>): Promise<void> {
    const registry = BackendRegistry.getInstance();
    
    // Fase 3: Selezione del Backend basata su Costo/Privacy/Competenza

    // 1. Se la privacy è STRICT o CONFIDENTIAL, DEVE usare un modello locale
    if (context.privacyLevel === PrivacyLevel.STRICT || context.privacyLevel === PrivacyLevel.CONFIDENTIAL) {
      const localBackends = [
        ...registry.getBackendsByType(BackendType.WEBGPU), 
        ...registry.getBackendsByType(BackendType.OLLAMA), 
        ...registry.getBackendsByType(BackendType.WASM)
      ];
      
      for (const backend of localBackends) {
        if (await backend.isAvailable()) {
          context.selectedBackend = backend;
          context.metadata.routingReason = 'Forzato locale per requisiti di privacy';
          break;
        }
      }
      
      if (!context.selectedBackend) {
        throw new Error('Privacy STRICT richiesta, ma nessun backend locale è disponibile.');
      }
    } 
    // 2. Se richiede High Reasoning e la privacy lo permette, preferisci il Cloud
    else if (context.requiresHighReasoning) {
      const cloudBackends = registry.getBackendsByType(BackendType.CLOUD);
      if (cloudBackends.length > 0 && await cloudBackends[0].isAvailable()) {
        context.selectedBackend = cloudBackends[0];
        context.metadata.routingReason = 'Selezionato Cloud per alto ragionamento';
      }
    }
    
    // 3. Default su locale se disponibile (Risparmio costi)
    if (!context.selectedBackend) {
      const localBackends = [...registry.getBackendsByType(BackendType.WEBGPU), ...registry.getBackendsByType(BackendType.WASM), ...registry.getBackendsByType(BackendType.OLLAMA)];
      for (const backend of localBackends) {
        if (await backend.isAvailable()) {
          context.selectedBackend = backend;
          context.metadata.routingReason = 'Default su locale per risparmio costi';
          break;
        }
      }
    }

    // 4. Fallback finale su Cloud se il locale non è disponibile
    if (!context.selectedBackend) {
      const cloudBackends = registry.getBackendsByType(BackendType.CLOUD);
      if (cloudBackends.length > 0 && await cloudBackends[0].isAvailable()) {
        context.selectedBackend = cloudBackends[0];
        context.metadata.routingReason = 'Fallback su Cloud (locale non disponibile)';
      }
    }

    if (!context.selectedBackend) {
      throw new Error('Nessun backend LLM disponibile per processare la richiesta.');
    }

    await next();
  }
}
