import { GoogleGenAI } from "@google/genai";
import db from "../db/database";
import { JobStatus } from "../types/enums";

export interface A2AMessage {
  messageId: string;
  sourceAgent: string;   // es. "Vertex_Main_Agent"
  targetAgent: string;   // es. "ADK_Diagnostic_Agent", "FULL_CYCLE_ORCHESTRATOR"
  taskType: "DIAGNOSIS" | "CODE_REVIEW" | "SECURITY_SCAN" | "IMPACT_ANALYSIS" | "FULL_CYCLE_RESOLUTION";
  payload: Record<string, unknown> | string;          // I dati del problema (es. log di errore, codice)
  context: string;       // Il contesto della conversazione con l'utente
}

export interface A2AResponse {
  messageId: string;
  status: "SUCCESS" | "FAILED" | "REQUIRES_HUMAN" | "RESOLVED_AUTONOMOUSLY";
  result: unknown;
  suggestedActions?: string[];
  workflowTrace?: Record<string, unknown>[]; // Traccia dei passaggi tra agenti
}

/**
 * Google A2A (Agent-to-Agent) Broker
 * 
 * Questo servizio funge da "Interprete Universale" (Fase 4).
 * Permette ad agenti costruiti su framework diversi di scambiarsi task complessi.
 */
export class A2ABroker {
  private static ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  /**
   * Invia un messaggio da un agente all'altro e attende la risoluzione del task.
   */
  static async delegateTask(message: A2AMessage): Promise<A2AResponse> {
    console.log(`[A2A Broker] Routing task '${message.taskType}' from ${message.sourceAgent} to ${message.targetAgent}...`);

    try {
      switch (message.targetAgent) {
        case "ADK_Diagnostic_Agent":
          return await this.runDiagnosticAgent(message);
        case "Jules_Code_Agent":
          return await this.runJulesAgent(message);
        case "Antigravity_Security_Agent":
          return await this.runAntigravityAgent(message);
        case "FULL_CYCLE_ORCHESTRATOR":
          return await this.runFullCycleResolution(message);
        default:
          throw new Error(`Target agent ${message.targetAgent} not found or not supported.`);
      }
    } catch (error: unknown) {
      console.error(`[A2A Broker] Error during delegation:`, error);
      return {
        messageId: message.messageId,
        status: "FAILED",
        result: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Simula l'Agente Diagnostico (Backend ADK) che utilizza la FileSearch API (RAG).
   */
  private static async runDiagnosticAgent(message: A2AMessage): Promise<A2AResponse> {
    const prompt = `
Sei l'Agente Diagnostico (ADK). Hai ricevuto una richiesta di delega dall'Agente Principale.
Contesto utente: ${message.context}
Log/Errore da analizzare: ${JSON.stringify(message.payload)}

Usa la tua conoscenza tecnica (simulazione RAG su manuali aziendali) per diagnosticare il problema e fornire una soluzione chiara.
Se la soluzione richiede una modifica al codice, suggerisci di aprire un ticket per Jules e Antigravity.
`;

    const response = await this.ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: "Sei un agente tecnico di backend specializzato in diagnostica di sistema.",
        temperature: 0.2
      }
    });

    return {
      messageId: message.messageId,
      status: "SUCCESS",
      result: response.text,
      suggestedActions: ["CREATE_TICKET", "NOTIFY_JULES"]
    };
  }

  private static async runJulesAgent(message: A2AMessage): Promise<A2AResponse> {
    const { JulesAgent } = await import('./JulesAgent');
    const jules = new JulesAgent();
    const payload = message.payload as Record<string, unknown>;
    const impact = await jules.analyzeImpact(String(payload.file || "unknown"), String(payload.content || ""), message.context);
    
    return {
      messageId: message.messageId,
      status: "SUCCESS",
      result: impact
    };
  }

  private static async runAntigravityAgent(message: A2AMessage): Promise<A2AResponse> {
    const { AntigravityAgent } = await import('./AntigravityAgent');
    type AntigravityPayloadType = import('./AntigravityAgent').AntigravityPayloadType;
    const antigravity = new AntigravityAgent();
    const payload = message.payload as Record<string, unknown>;
    const scan = await antigravity.scanPayload(String(payload.type || "CODE_PR") as AntigravityPayloadType, String(payload.content || ""));
    
    return {
      messageId: message.messageId,
      status: scan.riskLevel === "CRITICAL" ? "REQUIRES_HUMAN" : "SUCCESS",
      result: scan
    };
  }

  /**
   * Esegue il Flusso Completo (Fase 4 Avanzata):
   * Vertex -> ADK (Diagnosi) -> Jules (Patch) -> Antigravity (Verifica Sicurezza) -> Risoluzione
   */
  private static async runFullCycleResolution(message: A2AMessage): Promise<A2AResponse> {
    const trace: Record<string, unknown>[] = [];
    
    // 1. ADK Diagnosi
    trace.push({ step: "ADK_DIAGNOSIS", status: "STARTED" });
    const diagnostic = await this.runDiagnosticAgent({...message, targetAgent: "ADK_Diagnostic_Agent"});
    trace.push({ step: "ADK_DIAGNOSIS", status: "COMPLETED", output: diagnostic.result });

    // 2. Jules genera la patch basata sulla diagnosi
    trace.push({ step: "JULES_PATCH_GENERATION", status: "STARTED" });
    const { JulesAgent } = await import('./JulesAgent');
    const jules = new JulesAgent();
    const payload = message.payload as Record<string, unknown>;
    const mockOriginalCode = typeof message.payload === 'string' ? message.payload : String(payload.prompt || payload.sourceCode || "function login() { /* old code */ }");
    const patch = await jules.generateRefactoringPatch("auth.ts", mockOriginalCode, String(diagnostic.result));
    trace.push({ step: "JULES_PATCH_GENERATION", status: "COMPLETED", output: patch });

    // 3. Antigravity verifica la patch generata da Jules
    trace.push({ step: "ANTIGRAVITY_SECURITY_SCAN", status: "STARTED" });
    const { AntigravityAgent } = await import('./AntigravityAgent');
    const antigravity = new AntigravityAgent();
    const securityCheck = await antigravity.scanPayload("CODE_PR", patch);
    trace.push({ step: "ANTIGRAVITY_SECURITY_SCAN", status: "COMPLETED", output: securityCheck });

    if (securityCheck.riskLevel === "CRITICAL" || securityCheck.riskLevel === "HIGH") {
      return {
        messageId: message.messageId,
        status: "REQUIRES_HUMAN",
        result: {
          finalMessage: "La patch generata autonomamente non ha superato i controlli di sicurezza di Antigravity.",
          diagnosis: diagnostic.result,
          appliedPatch: patch,
          securityAudit: securityCheck
        },
        workflowTrace: trace
      };
    }

    // 4. Se tutto è ok, il sistema ha risolto il problema autonomamente
    return {
      messageId: message.messageId,
      status: "RESOLVED_AUTONOMOUSLY",
      result: {
        finalMessage: "Il problema è stato diagnosticato, patchato e verificato in sicurezza in modo completamente autonomo.",
        diagnosis: diagnostic.result,
        appliedPatch: patch,
        securityAudit: securityCheck
      },
      workflowTrace: trace
    };
  }
}
