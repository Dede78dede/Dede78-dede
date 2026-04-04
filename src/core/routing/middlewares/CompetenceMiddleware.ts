import { IRouterMiddleware, RoutingContext } from '../types';

export class CompetenceMiddleware implements IRouterMiddleware {
  public async handle(context: RoutingContext, next: () => Promise<void>): Promise<void> {
    // Fase 2: Analisi della complessità (Competence)
    const reasoningKeywords = ['calcola', 'logica', 'codice', 'funzione', 'analizza', 'risolvi', 'algoritmo'];
    const lowerPrompt = context.prompt.toLowerCase();
    
    // Se richiede ragionamento complesso o è un prompt molto lungo, flagga per High Reasoning
    if (reasoningKeywords.some(kw => lowerPrompt.includes(kw)) || context.prompt.length > 1500) {
      context.requiresHighReasoning = true;
      context.metadata.competenceReason = 'Richiesto alto ragionamento logico o contesto lungo';
    } else {
      context.requiresHighReasoning = false;
    }

    await next();
  }
}
