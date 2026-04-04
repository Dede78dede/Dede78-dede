import { SmarterRouter } from '../routing/SmarterRouter';
import { MCPRegistry } from '../mcp/types';
import { OrchestratorOptions, Message } from './types';
import { PrivacyLevel } from '../routing/types';
import { AbstractAgentOrchestrator, ExecutionStateFlag } from '../abc/protocols';

export class AgentOrchestrator extends AbstractAgentOrchestrator {
  private router: SmarterRouter;
  private mcpRegistry?: MCPRegistry;

  constructor(router: SmarterRouter, mcpRegistry?: MCPRegistry) {
    super();
    this.router = router;
    this.mcpRegistry = mcpRegistry;
  }

  public async executeTask(prompt: string, options?: OrchestratorOptions & Record<string, unknown>): Promise<string> {
    this.currentState = ExecutionStateFlag.ROUTING;
    this.metadata.startTime = Date.now();
    
    const maxIterations = options?.maxToolIterations || 5;
    let iteration = 0;
    
    // In un'implementazione reale, l'HAL dovrebbe accettare un array di messaggi.
    // Per semplicità in questo prototipo, accumuliamo il contesto nel prompt testuale
    // (o usiamo le API native se l'adapter le supporta).
    let currentContext = prompt;
    const tools = this.mcpRegistry ? this.mcpRegistry.getTools() : undefined;

    while (iteration < maxIterations) {
      iteration++;
      console.log(`[Orchestrator] Iterazione ${iteration}/${maxIterations}...`);
      this.currentState = ExecutionStateFlag.GENERATING;

      const [routeError, routeResult] = await this.router.execute(currentContext, {
        privacy: options?.privacyLevel || PrivacyLevel.MINIMUM,
        tools: tools,
        system_prompt: options?.systemPrompt,
        temperature: options?.temperature
      });

      if (routeError) {
        this.currentState = ExecutionStateFlag.FAILED;
        this.metadata.endTime = Date.now();
        throw new Error(`[Orchestrator] Errore durante il routing o la generazione: ${routeError.message}`);
      }

      const { response, context } = routeResult;

      // Aggiorna i metadati con il provider scelto dal router
      this.metadata.provider = context.selectedBackend?.type;
      this.metadata.model = context.selectedBackend?.id;

      // Se il modello ha deciso di chiamare uno o più tool
      if (response.toolCalls && response.toolCalls.length > 0 && this.mcpRegistry) {
        this.currentState = ExecutionStateFlag.TOOL_CALLING;
        console.log(`[Orchestrator] Il modello ha richiesto ${response.toolCalls.length} tool(s).`);
        
        let toolResultsContext = `\n\n--- Risultati dei Tool (Iterazione ${iteration}) ---\n`;
        
        for (const call of response.toolCalls) {
          const [error, result] = await this.mcpRegistry.executeTool(call.name, call.args);
          
          if (error) {
            console.error(`[Orchestrator] Errore tool ${call.name}:`, error);
            toolResultsContext += `Tool '${call.name}' ha fallito con errore:\n${error.message}\n\n`;
          } else {
            console.log(`[Orchestrator] Esecuzione tool: ${call.name}`);
            toolResultsContext += `Tool '${call.name}' ha restituito:\n${JSON.stringify(result)}\n\n`;
          }
        }

        // Aggiungiamo i risultati al contesto e facciamo un nuovo giro del loop
        toolResultsContext += `Usa queste informazioni per completare la richiesta originale. Se hai finito, rispondi normalmente senza chiamare altri tool.`;
        currentContext += toolResultsContext;
        
      } else {
        // Nessun tool chiamato, il modello ha prodotto la risposta finale
        console.log(`[Orchestrator] Task completato in ${iteration} iterazioni.`);
        this.currentState = ExecutionStateFlag.COMPLETED;
        this.metadata.endTime = Date.now();
        return response.text;
      }
    }

    this.currentState = ExecutionStateFlag.FAILED;
    this.metadata.endTime = Date.now();
    throw new Error(`[Orchestrator] Raggiunto il limite massimo di iterazioni (${maxIterations}) senza completare il task.`);
  }
}
