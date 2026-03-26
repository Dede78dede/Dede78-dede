import { GoogleGenAI } from "@google/genai";

export type AntigravityPayloadType = "CODE_PR" | "API_REQUEST" | "FINANCIAL_TX" | "DLP_SCAN" | "IAC_AUDIT" | "SRE_LOGS" | "SOCIAL_ENGINEERING";

/**
 * Antigravity: La Sentinella Autonoma (Intelligent Development System & Security Sentinel)
 * 
 * Antigravity è un IDS attivo che intercetta codice, payload o transazioni in tempo reale.
 * Funzionalità estese:
 * - WAF Intelligente (API_REQUEST)
 * - Anti-Money Laundering (FINANCIAL_TX)
 * - Data Loss Prevention (DLP_SCAN)
 * - Infrastructure as Code Audit (IAC_AUDIT)
 * - Auto-Remediation SRE (SRE_LOGS)
 * - Anti-Phishing (SOCIAL_ENGINEERING)
 */
export class AntigravityAgent {
  private ai: GoogleGenAI;
  private model = "gemini-3.1-pro-preview";

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || "";
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Analizza un payload in tempo reale alla ricerca di vulnerabilità o comportamenti anomali.
   */
  async scanPayload(payloadType: AntigravityPayloadType, payloadContent: string): Promise<any> {
    let specificInstruction = "";
    switch(payloadType) {
      case "CODE_PR": specificInstruction = "Cerca vulnerabilità OWASP, iniezioni SQL/XSS e bug di sicurezza nel codice."; break;
      case "API_REQUEST": specificInstruction = "Analizza la richiesta API per attacchi zero-day, SQL injection, o anomalie nei parametri."; break;
      case "FINANCIAL_TX": specificInstruction = "Analizza la transazione per pattern di frode o riciclaggio (AML)."; break;
      case "DLP_SCAN": specificInstruction = "Esegui Data Loss Prevention. Cerca PII, segreti industriali, carte di credito o dati sensibili non mascherati. Se presenti, fornisci la versione redatta (oscurata)."; break;
      case "IAC_AUDIT": specificInstruction = "Analizza il codice IaC (Terraform, Kubernetes). Cerca misconfiguration come bucket pubblici, permessi di root, o porte esposte."; break;
      case "SRE_LOGS": specificInstruction = "Analizza i log di produzione. Identifica root cause di crash (OOM, deadlock) e suggerisci script di auto-remediation."; break;
      case "SOCIAL_ENGINEERING": specificInstruction = "Analizza il testo (es. ticket di supporto o email) per pattern di phishing, ingegneria sociale o tentativi di manipolazione per ottenere accessi."; break;
    }

    const systemInstruction = `Sei Antigravity, un sistema IDS, WAF e Security Sentinel autonomo.
Il tuo compito è analizzare payload in tempo reale.
Istruzione specifica: ${specificInstruction}

Restituisci SEMPRE un JSON valido con questa struttura esatta:
{
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "findings": ["dettaglio 1", "dettaglio 2"],
  "mitigation": "azioni da intraprendere",
  "redactedPayload": "payload con dati sensibili oscurati (solo se applicabile)",
  "remediationScript": "script di fix (solo se applicabile)"
}`;

    const prompt = `
Tipo di Payload: ${payloadType}
Contenuto da analizzare:
${payloadContent}

Esegui un'analisi di sicurezza profonda e genera il report strutturato in JSON.`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.1 // Estremamente deterministico per la sicurezza
        }
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("[Antigravity] Errore durante la scansione di sicurezza:", error);
      throw error;
    }
  }

  /**
   * Genera una patch di sicurezza (o una regola WAF) per mitigare una vulnerabilità rilevata.
   */
  async generateSecurityPatch(vulnerabilityDetails: string, originalCode: string): Promise<string> {
    const prompt = `Sei un esperto di sicurezza informatica. Genera una patch sicura per il seguente codice vulnerabile.
Dettagli vulnerabilità: ${vulnerabilityDetails}

Codice originale:
${originalCode}

Restituisci SOLO il codice patchato e sicuro, senza markdown wrapper.`;

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { temperature: 0.1 }
    });

    return response.text || originalCode;
  }
}
