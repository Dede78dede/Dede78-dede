import { IRouterMiddleware, RoutingContext, PrivacyLevel } from '../types';
import { BackendRegistry } from '../../hal/BackendRegistry';
import { BackendType } from '../../enums';

export class CostMiddleware implements IRouterMiddleware {
  public async handle(context: RoutingContext, next: () => Promise<void>): Promise<void> {
    const registry = BackendRegistry.getInstance();
    const allBackends = registry.getAllBackends();
    
    // Fase 3: Selezione del Backend basata su Costo/Privacy/Competenza

    // 1. Se la privacy è STRICT o CONFIDENTIAL, DEVE usare un modello locale
    if (context.privacyLevel === PrivacyLevel.STRICT || context.privacyLevel === PrivacyLevel.CONFIDENTIAL) {
      context.selectedBackendType = 'local';
      context.metadata.routingReason = 'Forzato locale per requisiti di privacy';
      
      if (allBackends.length > 0) {
        const localBackends = [
          ...registry.getBackendsByType(BackendType.WEBGPU), 
          ...registry.getBackendsByType(BackendType.OLLAMA), 
          ...registry.getBackendsByType(BackendType.WASM)
        ];
        for (const backend of localBackends) {
          if (await backend.isAvailable()) {
            context.selectedBackend = backend;
            break;
          }
        }
      }
    } 
    // 2. Se richiede High Reasoning e la privacy lo permette, preferisci il Cloud
    else if (context.requiresHighReasoning) {
      context.selectedBackendType = 'cloud';
      context.metadata.routingReason = 'Selezionato Cloud per alto ragionamento';
      
      if (allBackends.length > 0) {
        const cloudBackends = registry.getBackendsByType(BackendType.CLOUD);
        if (cloudBackends.length > 0 && await cloudBackends[0].isAvailable()) {
          context.selectedBackend = cloudBackends[0];
        }
      }
    }
    
    // 3. Default su locale se disponibile (Risparmio costi)
    if (!context.selectedBackendType) {
      context.selectedBackendType = 'local';
      context.metadata.routingReason = 'Default su locale per risparmio costi';
      
      if (allBackends.length > 0) {
        const localBackends = [...registry.getBackendsByType(BackendType.WEBGPU), ...registry.getBackendsByType(BackendType.WASM), ...registry.getBackendsByType(BackendType.OLLAMA)];
        for (const backend of localBackends) {
          if (await backend.isAvailable()) {
            context.selectedBackend = backend;
            break;
          }
        }
      }
    }

    // 4. Fallback finale su Cloud se il locale non è disponibile (solo se stiamo usando il registry)
    if (allBackends.length > 0 && !context.selectedBackend && context.selectedBackendType === 'local') {
      const cloudBackends = registry.getBackendsByType(BackendType.CLOUD);
      if (cloudBackends.length > 0 && await cloudBackends[0].isAvailable()) {
        context.selectedBackend = cloudBackends[0];
        context.selectedBackendType = 'cloud';
        context.metadata.routingReason = 'Fallback su Cloud (locale non disponibile)';
      }
    }

    await next();
  }
}
