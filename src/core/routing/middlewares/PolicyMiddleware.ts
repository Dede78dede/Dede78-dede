import { IRouterMiddleware, RoutingContext } from '../types';

export class PolicyMiddleware implements IRouterMiddleware {
  public async handle(context: RoutingContext, next: () => Promise<void>): Promise<void> {
    // Fase 4: Policy Engine (Regole interne e gerarchia)
    
    // Esempio di Hard Limit di sistema:
    // Se il prompt è eccessivamente lungo e stiamo usando un modello locale con poca VRAM
    if (context.selectedBackend?.type !== 'cloud' && context.prompt.length > 50000) {
        // Override forzato per evitare OOM (Out of Memory)
        throw new Error('Policy Violation: Prompt troppo lungo per il backend locale selezionato.');
    }

    // Qui in futuro possiamo iniettare regole specifiche del Workspace o dell'Utente
    // es. context.metadata.userTier === 'free' -> blocca modelli cloud costosi

    await next();
  }
}
