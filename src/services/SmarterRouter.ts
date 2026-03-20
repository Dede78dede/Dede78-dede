import { pipeline, FeatureExtractionPipeline } from '@huggingface/transformers';
import { PolicyEngine, RoutingPolicy } from './PolicyEngine';

/**
 * SmarterRouter is responsible for intelligently routing prompts to either
 * local or cloud models based on prompt complexity and user preferences.
 * It uses a hybrid approach: a machine learning model (feature extraction)
 * for semantic complexity analysis, and a heuristic fallback.
 */
export class SmarterRouter {
  private static extractor: FeatureExtractionPipeline | null = null;
  private static complexAnchor: any = null;
  private static simpleAnchor: any = null;
  private static isInitializing = false;

  /**
   * Initializes the machine learning model used for semantic routing.
   * Uses Xenova/all-MiniLM-L6-v2 for feature extraction.
   */
  static async initModel() {
    if (this.extractor || this.isInitializing) return;
    this.isInitializing = true;
    try {
      const pipe: any = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        dtype: 'q8'
      });
      this.extractor = pipe as FeatureExtractionPipeline;
      // Compute anchors
      const complexText = "Scrivi un server web in Python usando FastAPI con autenticazione JWT e database PostgreSQL. Spiega il ragionamento passo passo.";
      const simpleText = "Ciao, come stai? Che ore sono? Dimmi una barzelletta.";
      
      this.complexAnchor = await this.extractor(complexText, { pooling: 'mean', normalize: true });
      this.simpleAnchor = await this.extractor(simpleText, { pooling: 'mean', normalize: true });
      // console.log("[SmarterRouter] ML Model initialized successfully.");
    } catch (e) {
      console.error("[SmarterRouter] Failed to initialize ML Model:", e);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Calculates the dot product of two vectors.
   */
  private static dotProduct(a: any, b: any) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Calculates a heuristic complexity score for a prompt based on length,
   * keywords, and special characters. Used as a fallback when ML routing fails.
   * @param prompt The user's input prompt.
   * @returns A score between 0 and 1.
   */
  private static heuristicScore(prompt: string): number {
    let score = 0;
    if (prompt.length > 100) score += 0.2;
    if (prompt.length > 300) score += 0.3;
    if (prompt.length > 1000) score += 0.4;
    
    const complexKeywords = [
      'codice', 'code', 'python', 'javascript', 'react', 'typescript',
      'spiega', 'analizza', 'calcola', 'matematica', 'math', 'reasoning',
      'perché', 'why', 'how', 'come', 'confronta', 'differenza', 'riassumi',
      'traduci', 'translate', 'struttura', 'architettura'
    ];
    const promptLower = prompt.toLowerCase();
    const keywordMatches = complexKeywords.filter(kw => promptLower.includes(kw)).length;
    score += Math.min(keywordMatches * 0.15, 0.5);
    
    if (promptLower.includes('json') || promptLower.includes('markdown') || promptLower.includes('tabella') || promptLower.includes('csv')) {
      score += 0.2;
    }
    if (/[{}\[\]<>]/.test(prompt)) {
      score += 0.1;
    }
    return Math.min(score, 1.0);
  }

  /**
   * Determines whether to route the request to a local or cloud model
   * based on the prompt's complexity and the user's quality preference.
   * Supports probabilistic ML-based routing.
   * 
   * @param prompt The user's input prompt.
   * @param qualityPreference The user's preference for quality vs. speed (0 to 1).
   * @returns 'local' or 'cloud'
   */
  static async route(prompt: string, qualityPreference: number): Promise<'local' | 'cloud'> {
    let complexityScore = 0;
    
    try {
      // Try ML-based routing
      if (!this.extractor && !this.isInitializing) {
        // Non-blocking init per la prossima volta
        this.initModel().catch(console.error);
      }

      if (this.extractor && this.complexAnchor && this.simpleAnchor) {
        const promptEmbedding = await this.extractor(prompt, { pooling: 'mean', normalize: true });
        
        // Cosine similarity (tensors are normalized)
        const simComplex = this.dotProduct(promptEmbedding.data, this.complexAnchor.data);
        const simSimple = this.dotProduct(promptEmbedding.data, this.simpleAnchor.data);
        
        // Normalize score between 0 and 1 based on relative similarity
        const totalSim = Math.max(0.0001, simComplex + simSimple);
        complexityScore = Math.max(0, Math.min(1, simComplex / totalSim));
        
        // Adjust with length factor as ML models might not fully capture length complexity
        if (prompt.length > 500) complexityScore += 0.2;
        complexityScore = Math.min(1, complexityScore);
        
        // console.log(`[SmarterRouter ML] SimComplex: ${simComplex.toFixed(3)}, SimSimple: ${simSimple.toFixed(3)} -> Score: ${complexityScore.toFixed(2)}`);
      } else {
        // Fallback to heuristics
        complexityScore = this.heuristicScore(prompt);
      }
    } catch (e) {
      console.warn("[SmarterRouter] ML routing failed, falling back to heuristics", e);
      complexityScore = this.heuristicScore(prompt);
    }

    const threshold = 1.0 - qualityPreference; 
    // console.log(`[SmarterRouter] Final Complexity: ${complexityScore.toFixed(2)}, Threshold: ${threshold.toFixed(2)} -> Routing to: ${complexityScore >= threshold ? 'cloud' : 'local'}`);

    return complexityScore >= threshold ? 'cloud' : 'local';
  }

  /**
   * Invia il prompt al MasterOrchestrator (MaAS) per l'analisi e l'azione.
   */
  static async orchestrate(prompt: string, systemPrompt?: string, policy?: RoutingPolicy): Promise<{ action: string, message: string, jobId?: string, reasoningDomain?: string }> {
    // 1. Evaluate Policy before sending data to cloud
    if (policy) {
      try {
        const selectedModel = PolicyEngine.evaluate(prompt, policy);
        if (selectedModel.isLocal) {
           console.log("[PolicyEngine] Forcing LOCAL_DELEGATION due to policy constraints.");
           return {
             action: "LOCAL_DELEGATION",
             message: "⚡ *Policy Engine*: Instradamento forzato al modello locale (Privacy/Costo)."
           };
        }
      } catch (e: any) {
        console.warn("[PolicyEngine] Evaluation failed or constraints too strict:", e.message);
      }
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : undefined);
    if (!apiKey) {
      throw new Error("API key non configurata per il Master Orchestrator.");
    }

    try {
      const { GoogleGenAI, Type } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      
      const systemInstruction = systemPrompt || `Sei il MasterOrchestrator di SmarterRouter.
Il tuo compito è analizzare la richiesta dell'utente e decidere come gestirla.
Scegli una delle seguenti azioni:
- DIRECT_ANSWER: Per domande generali, programmazione, scrittura, o richieste che richiedono la tua intelligenza superiore ma senza un ragionamento esplicito passo-passo.
- REASONING_TASK: Per problemi complessi, logica, matematica, o quando l'utente chiede esplicitamente di ragionare, pensare passo dopo passo o mostrare il processo.
- LOCAL_DELEGATION: Per domande molto semplici, saluti, o richieste banali che un piccolo modello locale può gestire.
- AGENT_JOB: Per richieste di addestramento (training/fine-tuning), valutazione (evaluation/benchmarking), o unione (merging) di modelli.

Se scegli AGENT_JOB, devi anche estrarre i parametri per il job (es. task_type: 'TRAINING', dataset: '...', epochs: ...).`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              action: {
                type: Type.STRING,
                enum: ["DIRECT_ANSWER", "REASONING_TASK", "LOCAL_DELEGATION", "AGENT_JOB"],
                description: "L'azione da intraprendere."
              },
              reasoningDomain: {
                type: Type.STRING,
                enum: ["MATH", "LOGIC", "CODE", "GENERAL"],
                description: "Il dominio di ragionamento (solo se action è REASONING_TASK)."
              },
              jobDetails: {
                type: Type.OBJECT,
                description: "Dettagli del job (solo se action è AGENT_JOB).",
                properties: {
                  task_type: { type: Type.STRING, description: "TRAINING, EVALUATION, o MERGING" },
                  payload: { type: Type.OBJECT, description: "Parametri estratti dalla richiesta" }
                }
              },
              directResponse: {
                type: Type.STRING,
                description: "La tua risposta diretta all'utente (solo se action è DIRECT_ANSWER)."
              }
            },
            required: ["action"]
          }
        }
      });

      const resultText = response.text;
      if (!resultText) throw new Error("Empty response from Gemini");
      
      const result = JSON.parse(resultText);

      if (result.action === "AGENT_JOB" && result.jobDetails) {
        // Create a job in the database via API
        const jobRes = await fetch("/api/jobs/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_type: result.jobDetails.task_type,
            payload: result.jobDetails.payload || {}
          })
        });
        
        if (!jobRes.ok) throw new Error("Errore creazione job");
        const jobData = await jobRes.json();
        
        return {
          action: "AGENT_JOB",
          jobId: jobData.jobId,
          message: `Ho creato un job di tipo ${result.jobDetails.task_type} per gli agenti specializzati. Puoi monitorarlo nella Dashboard.`
        };
      } else if (result.action === "LOCAL_DELEGATION") {
        return {
          action: "LOCAL_DELEGATION",
          message: "Delego questa richiesta al modello locale per risparmiare risorse."
        };
      } else if (result.action === "REASONING_TASK") {
        return {
          action: "REASONING_TASK",
          reasoningDomain: result.reasoningDomain || "GENERAL",
          message: `Richiesto ragionamento complesso (${result.reasoningDomain || "GENERAL"}). Attivazione esperto CoT...`
        };
      } else {
        // DIRECT_ANSWER
        return {
          action: "DIRECT_ANSWER",
          message: result.directResponse || "Non ho una risposta specifica, ma ho elaborato la tua richiesta."
        };
      }
    } catch (error: any) {
      console.error("Orchestrator error:", error);
      throw new Error(`Errore Orchestrator: ${error.message || 'Errore sconosciuto'}`);
    }
  }
}
