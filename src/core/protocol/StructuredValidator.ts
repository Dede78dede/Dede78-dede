import { z } from 'zod';

// 1. Busta standard per la comunicazione tra Nodi/Agenti
export interface AgentStateEnvelope<T = unknown> {
  traceId: string;          // ID univoco del workflow
  sourceNode: string;       // Chi ha generato il messaggio (es. 'Critic', 'Router')
  targetNode?: string;      // Destinatario (opzionale)
  timestamp: number;
  payload: T;               // Il contenuto vero e proprio (validato da Zod)
  metadata: {
    tokensUsed?: number;
    cost?: number;
    confidenceScore?: number;
  };
}

// 2. Validatore di Output Strutturato (Structured Output Validator)
export class StructuredValidator {
  /**
   * Forza il parsing di una stringa (output del LLM) in un oggetto JSON validato da uno schema Zod.
   * Implementa logica di auto-riparazione base (es. rimozione di markdown ```json ... ```)
   */
  public static parse<T>(llmOutput: string, schema: z.ZodType<T>): T {
    try {
      // Pulizia base: rimuove i backtick del markdown se il modello li ha inseriti
      let cleanOutput = llmOutput.trim();
      if (cleanOutput.startsWith('```json')) {
        cleanOutput = cleanOutput.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanOutput.startsWith('```')) {
        cleanOutput = cleanOutput.replace(/^```/, '').replace(/```$/, '').trim();
      }

      // Trova il primo '{' o '[' e l'ultimo '}' o ']' per estrarre solo il JSON
      const firstBrace = cleanOutput.search(/[\{\[]/);
      const lastBrace = cleanOutput.search(/[\}\]][^}\]]*$/);
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanOutput = cleanOutput.substring(firstBrace, lastBrace + 1);
      }

      const parsedJson = JSON.parse(cleanOutput);
      
      // Validazione rigorosa tramite Zod
      return schema.parse(parsedJson);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validazione JSON fallita (Schema mismatch): ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Impossibile parsare l'output del LLM come JSON: ${errorMessage}\nOutput originale: ${llmOutput}`);
    }
  }
}
