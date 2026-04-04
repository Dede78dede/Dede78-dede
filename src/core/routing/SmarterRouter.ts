import { RouterPipeline } from './RouterPipeline';
import { PrivacyMiddleware } from './middlewares/PrivacyMiddleware';
import { CompetenceMiddleware } from './middlewares/CompetenceMiddleware';
import { CostMiddleware } from './middlewares/CostMiddleware';
import { PolicyMiddleware } from './middlewares/PolicyMiddleware';
import { RoutingContext, PrivacyLevel } from './types';
import { MCPTool } from '../mcp/types';
import { Result, RoutingError, AdapterError } from '../errors';
import { StandardLLMResponse } from '../hal/types';

/**
 * @class SmarterRouter
 * @description Facade principale per il motore di routing ibrido.
 * Gestisce la catena di responsabilità (RouterPipeline) per determinare
 * il backend LLM ottimale in base a privacy, competenza, costo e policy.
 */
export class SmarterRouter {
  private pipeline: RouterPipeline;

  constructor() {
    this.pipeline = new RouterPipeline();
    
    // Registrazione della Chain of Responsibility nell'ordine esatto
    this.pipeline.use(new PrivacyMiddleware());
    this.pipeline.use(new CompetenceMiddleware());
    this.pipeline.use(new CostMiddleware());
    this.pipeline.use(new PolicyMiddleware());
  }

  /**
   * Esegue il processo di routing per determinare il backend migliore.
   * @param {string} prompt - Il testo di input dell'utente.
   * @param {PrivacyLevel} [initialPrivacy=PrivacyLevel.MINIMUM] - Il livello di privacy richiesto.
   * @param {MCPTool[]} [tools] - Lista opzionale di tool (Model Context Protocol) disponibili.
   * @returns {Promise<RoutingContext>} Il contesto finale con la decisione di routing.
   */
  public async route(prompt: string, initialPrivacy: PrivacyLevel = PrivacyLevel.MINIMUM, tools?: MCPTool[]): Promise<RoutingContext> {
    const context: RoutingContext = {
      prompt,
      privacyLevel: initialPrivacy,
      requiresHighReasoning: false,
      metadata: {},
      tools
    };

    await this.pipeline.execute(context);
    return context;
  }

  /**
   * Esegue il routing E la generazione in un solo passaggio.
   * @param {string} prompt - Il testo di input dell'utente.
   * @param {Object} [options] - Opzioni di configurazione.
   * @param {PrivacyLevel} [options.privacy] - Livello di privacy.
   * @param {MCPTool[]} [options.tools] - Tool disponibili.
   * @param {string} [options.system_prompt] - Prompt di sistema.
   * @param {number} [options.temperature] - Temperatura per la generazione.
   * @returns {Promise<Result<{response: StandardLLMResponse, context: RoutingContext}, RoutingError | AdapterError>>} La risposta del backend e il contesto di routing.
   */
  public async execute(prompt: string, options?: { privacy?: PrivacyLevel, tools?: MCPTool[], system_prompt?: string, temperature?: number }): Promise<Result<{response: StandardLLMResponse, context: RoutingContext}, RoutingError | AdapterError>> {
    const context = await this.route(prompt, options?.privacy, options?.tools);
    
    if (!context.selectedBackend) {
      return [new RoutingError("Routing fallito: Nessun backend selezionato.", "Final Selection"), null];
    }

    const [error, response] = await context.selectedBackend.generate(prompt, {
      tools: context.tools,
      system_prompt: options?.system_prompt,
      temperature: options?.temperature
    });

    if (error) {
      return [error, null];
    }

    return [null, {
      response: response as StandardLLMResponse,
      context
    }];
  }

  /**
   * Metodo statico di utilità per retrocompatibilità con il vecchio codice in useInferenceLogic.
   * @deprecated Usare l'istanza di SmarterRouter per un controllo più granulare.
   */
  public static async orchestrate(prompt: string, systemPrompt: string, policy: unknown) {
    const router = new SmarterRouter();
    const context = await router.route(prompt);
    
    return {
      action: context.selectedBackend?.type === 'cloud' ? 'MASTER_DELEGATION' : 'LOCAL_DELEGATION',
      message: `Routing completato. Backend selezionato: ${context.selectedBackend?.id || 'Sconosciuto'}`,
      reasoningDomain: context.requiresHighReasoning ? 'GENERAL' : undefined,
      selectedBackend: context.selectedBackend?.id
    };
  }
}
