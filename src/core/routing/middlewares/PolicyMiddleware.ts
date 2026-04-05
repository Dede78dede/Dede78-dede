import { IRouterMiddleware, RoutingContext } from '../types';
import { PolicyEngine } from '../PolicyEngine';

export class PolicyMiddleware implements IRouterMiddleware {
  private engine: PolicyEngine;

  constructor() {
    this.engine = new PolicyEngine();
  }

  public async handle(context: RoutingContext, next: () => Promise<void>): Promise<void> {
    // Fase 4: Policy Engine (Regole interne e gerarchia)
    
    // Valuta tutte le regole registrate nel PolicyEngine
    await this.engine.evaluateAll(context);

    await next();
  }
}
