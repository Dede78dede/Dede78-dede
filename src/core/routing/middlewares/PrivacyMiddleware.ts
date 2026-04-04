import { IRouterMiddleware, RoutingContext, PrivacyLevel } from '../types';

export class PrivacyMiddleware implements IRouterMiddleware {
  public async handle(context: RoutingContext, next: () => Promise<void>): Promise<void> {
    // Fase 1: Default su MINIMUM se non specificato
    if (!context.privacyLevel) {
      context.privacyLevel = PrivacyLevel.MINIMUM;
    }

    // Controllo dinamico: se il prompt contiene dati sensibili, eleva la privacy
    // (In futuro questo può essere un micro-modello NLP, ora usiamo euristiche veloci)
    const sensitiveKeywords = ['password', 'ssn', 'confidential', 'secret', 'iban', 'carta di credito'];
    const lowerPrompt = context.prompt.toLowerCase();
    
    if (sensitiveKeywords.some(kw => lowerPrompt.includes(kw))) {
      context.privacyLevel = PrivacyLevel.STRICT;
      context.metadata.privacyReason = 'Dati sensibili rilevati nel prompt';
    }

    await next();
  }
}
