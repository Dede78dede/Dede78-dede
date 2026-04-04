/**
 * @fileoverview Abstract Base Classes (ABC) e Protocolli per il Core Engine.
 * Definisce i contratti rigorosi, i metadati e le flag interne per tutti i moduli.
 */

import { z } from 'zod';
import { Result, AdapterError } from '../errors';
import { StandardLLMResponse } from '../hal/types';

/**
 * Flag interne di stato per il tracciamento del ciclo di vita dell'esecuzione.
 */
export enum ExecutionStateFlag {
  IDLE = 'IDLE',
  ROUTING = 'ROUTING',
  GENERATING = 'GENERATING',
  TOOL_CALLING = 'TOOL_CALLING',
  REFLECTING = 'REFLECTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

/**
 * Metadati standardizzati per ogni transazione LLM.
 */
export interface TransactionMetadata {
  /** Timestamp di inizio operazione (ms) */
  startTime: number;
  /** Timestamp di fine operazione (ms) */
  endTime?: number;
  /** Provider utilizzato (es. 'Google', 'WebLLM') */
  provider?: string;
  /** Modello specifico utilizzato (es. 'gemini-3.1-flash') */
  model?: string;
  /** Token consumati */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Flag interne di sicurezza o policy scattate durante il routing */
  securityFlags: string[];
  /** Punteggio di confidenza (se applicabile, es. nel ReflectionEngine) */
  confidenceScore?: number;
}

/**
 * Protocollo ABC: Astrazione per un Backend LLM (Hardware Abstraction Layer).
 * Qualsiasi motore fisico DEVE estendere questa classe.
 */
export abstract class AbstractLLMBackend {
  public abstract readonly id: string;
  public abstract readonly type: 'cloud' | 'webgpu' | 'ollama' | 'wasm';

  /**
   * Verifica la disponibilità hardware/network del backend.
   * @returns {Promise<boolean>} True se il backend è pronto per ricevere richieste.
   */
  public abstract isAvailable(): Promise<boolean>;

  /**
   * Esegue la generazione del testo o la chiamata ai tool.
   * @param {string} prompt - Il testo di input dell'utente o del sistema.
   * @param {Record<string, unknown>} options - Opzioni di configurazione (temperatura, tool, ecc.).
   * @returns {Promise<Result<StandardLLMResponse, AdapterError>>} La risposta standardizzata.
   */
  public abstract generate(prompt: string, options?: Record<string, unknown>): Promise<Result<StandardLLMResponse, AdapterError>>;
}

/**
 * Protocollo ABC: Astrazione per un Tool MCP (Model Context Protocol).
 */
export abstract class AbstractMCPTool<T = unknown> {
  public abstract readonly name: string;
  public abstract readonly description: string;
  /** Schema Zod per la validazione forte degli argomenti in ingresso */
  public abstract readonly schema: z.ZodType<T>;

  /**
   * Esegue la logica di business del tool.
   * @param {T} args - Argomenti validati dallo schema.
   * @param {unknown} context - Contesto opzionale di esecuzione.
   * @returns {Promise<unknown>} Il risultato dell'operazione.
   */
  public abstract execute(args: T, context?: unknown): Promise<unknown>;
}

/**
 * Protocollo ABC: Astrazione per l'Orchestratore di Agenti.
 */
export abstract class AbstractAgentOrchestrator {
  /** Flag di stato interno in tempo reale */
  public currentState: ExecutionStateFlag = ExecutionStateFlag.IDLE;
  /** Metadati accumulati durante l'esecuzione */
  public metadata: TransactionMetadata = { startTime: Date.now(), securityFlags: [] };

  /**
   * Esegue un task complesso gestendo autonomamente chiamate a tool e routing.
   * @param {string} prompt - La richiesta iniziale.
   * @param {Record<string, unknown>} options - Opzioni di orchestrazione.
   * @returns {Promise<string>} Il risultato finale elaborato.
   */
  public abstract executeTask(prompt: string, options?: Record<string, unknown>): Promise<string>;
}
