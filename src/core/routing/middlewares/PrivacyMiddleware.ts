import { IRouterMiddleware, RoutingContext, PrivacyLevel } from '../types';

export class PrivacyMiddleware implements IRouterMiddleware {
  public async handle(context: RoutingContext, next: () => Promise<void>): Promise<void> {
    // Fase 1: Default su MINIMUM se non specificato
    if (!context.privacyLevel) {
      context.privacyLevel = PrivacyLevel.MINIMUM;
    }

    // Controllo dinamico: se il prompt contiene dati sensibili, eleva la privacy
    const sensitiveKeywords = ['password', 'ssn', 'confidential', 'secret', 'iban', 'carta di credito'];
    const lowerPrompt = context.prompt.toLowerCase();
    
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b(?:\d[ -]*?){13,16}\b/, // Credit Card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ // Email
    ];

    const hasKeywords = sensitiveKeywords.some(kw => lowerPrompt.includes(kw));
    const hasPII = piiPatterns.some(pattern => pattern.test(context.prompt));

    if (hasKeywords || hasPII) {
      context.privacyLevel = PrivacyLevel.STRICT;
      context.metadata.privacyReason = 'Dati sensibili o PII rilevati nel prompt';
    }

    await next();
  }
}
