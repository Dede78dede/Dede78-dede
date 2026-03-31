import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

/**
 * Jules: La Visione d'Insieme sul Codice (Global Context Agent)
 * 
 * Jules non si limita a leggere un singolo file, ma comprende l'intero grafo delle dipendenze.
 * Quando un file cambia, Jules calcola l'impatto a cascata e suggerisce o applica modifiche
 * coerenti in tutto il progetto.
 * 
 * Ambiti estesi: Può essere usato per l'analisi di impatto su documenti legali (se cambia una clausola),
 * specifiche ingegneristiche o documentazione medica.
 */
export interface JulesImpactAnalysis {
  impactedFiles: string[];
  reasoning: string;
  suggestedChanges: Record<string, string>;
}

export class JulesAgent {
  private ai: GoogleGenAI;
  private model = "gemini-3.1-pro-preview";

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || "";
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Analizza una modifica a un file e determina quali altri file nel sistema
   * potrebbero essere impattati (Dependency Graph Analysis).
   */
  async analyzeImpact(filePath: string, newContent: string, projectContext: string): Promise<JulesImpactAnalysis> {
    const systemInstruction = `Sei Jules, un agente di orchestrazione del codice e del contesto globale.
Il tuo compito è analizzare una modifica a un file e prevedere l'impatto sul resto del sistema.
Non limitarti al codice software: se il contesto è legale, finanziario o documentale, applica la stessa logica di coerenza globale.
Restituisci un JSON con l'elenco dei file impattati, il motivo e le modifiche suggerite.`;

    const prompt = `
File modificato: ${filePath}
Nuovo contenuto:
${newContent}

Contesto del progetto (struttura/dipendenze):
${projectContext}

Identifica i file impattati e suggerisci le modifiche necessarie per mantenere la coerenza.`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.2 // Bassa temperatura per analisi deterministica
        }
      });

      return JSON.parse(response.text || "{}") as JulesImpactAnalysis;
    } catch (error) {
      console.error("[Jules] Errore durante l'analisi di impatto:", error);
      throw error;
    }
  }

  /**
   * Genera una refactoring patch applicabile automaticamente.
   */
  async generateRefactoringPatch(targetFile: string, currentContent: string, requiredChanges: string): Promise<string> {
    const prompt = `Applica le seguenti modifiche al file per mantenere la coerenza globale.
File: ${targetFile}
Modifiche richieste: ${requiredChanges}

Contenuto attuale:
${currentContent}

Restituisci SOLO il nuovo contenuto del file, senza markdown wrapper se possibile.`;

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { temperature: 0.1 }
    });

    return response.text || currentContent;
  }
}
