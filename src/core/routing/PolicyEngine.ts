import { RoutingContext } from './types';
import { BackendType } from '../enums';

export interface RoutingRule {
  id: string;
  description: string;
  evaluate: (context: RoutingContext) => boolean | Promise<boolean>;
  action: (context: RoutingContext) => void | Promise<void>;
}

export class PolicyEngine {
  private rules: Map<string, RoutingRule> = new Map();

  constructor() {
    this.registerDefaultRules();
  }

  public registerRule(rule: RoutingRule): void {
    this.rules.set(rule.id, rule);
  }

  public async evaluateAll(context: RoutingContext): Promise<void> {
    for (const rule of this.rules.values()) {
      if (await rule.evaluate(context)) {
        await rule.action(context);
      }
    }
  }

  private registerDefaultRules(): void {
    // Regola 1: Prevenzione Out of Memory (OOM) per modelli locali
    this.registerRule({
      id: 'PREVENT_LOCAL_OOM',
      description: 'Impedisce l\'uso di modelli locali per prompt eccessivamente lunghi',
      evaluate: (context) => {
        return context.selectedBackend?.type !== BackendType.CLOUD && context.prompt.length > 50000;
      },
      action: (context) => {
        if (!context.metadata.securityFlags) context.metadata.securityFlags = [];
        context.metadata.securityFlags.push('PREVENT_LOCAL_OOM');
        throw new Error('Policy Violation: Prompt troppo lungo per il backend locale selezionato. Rischio OOM.');
      }
    });

    // Regola 2: Blocco chiamate a tool non sicuri in contesti non autorizzati
    this.registerRule({
      id: 'RESTRICT_UNSAFE_TOOLS',
      description: 'Blocca l\'uso di tool di scrittura se non esplicitamente richiesto',
      evaluate: (context) => {
        const hasWriteTools = context.tools?.some(t => t.name.includes('write') || t.name.includes('delete'));
        const isSafeContext = !context.prompt.toLowerCase().includes('ignora le istruzioni');
        return !!hasWriteTools && !isSafeContext;
      },
      action: (context) => {
        if (!context.metadata.securityFlags) context.metadata.securityFlags = [];
        context.metadata.securityFlags.push('RESTRICT_UNSAFE_TOOLS');
        throw new Error('Policy Violation: Rilevato potenziale prompt injection con tool di scrittura abilitati.');
      }
    });
  }
}
