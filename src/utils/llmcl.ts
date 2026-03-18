/**
 * LLM-CL (LLM Communication Language)
 * 
 * Un protocollo di comunicazione compresso per ridurre il consumo di token
 * quando gli agenti (o il MasterOrchestrator) comunicano tra loro.
 * 
 * Formato: <LLMCL>base64_encoded_minified_json</LLMCL>
 * Oppure formato testuale compresso: <LLMCL|INTENT|KEY:VAL|KEY:VAL>
 */

export interface AgentMessage {
  intent: string;
  payload: Record<string, any>;
  sender?: string;
  target?: string;
}

export const LLMCL = {
  /**
   * Codifica un messaggio strutturato in una stringa LLM-CL ultra-compatta.
   */
  encode: (message: AgentMessage): string => {
    // Minimizziamo le chiavi per risparmiare token
    const minified = {
      i: message.intent,
      p: message.payload,
      s: message.sender,
      t: message.target
    };
    
    // Convertiamo in JSON compatto
    const jsonString = JSON.stringify(minified);
    
    // Usiamo un formato delimitato chiaro per le regex del Master
    return `<LLMCL>${jsonString}</LLMCL>`;
  },

  /**
   * Decodifica una stringa LLM-CL (estratta da una risposta testuale di un LLM)
   * nel formato strutturato AgentMessage.
   */
  decode: (text: string): AgentMessage | null => {
    const regex = /<LLMCL>(.*?)<\/LLMCL>/s;
    const match = text.match(regex);
    
    if (!match || !match[1]) return null;
    
    try {
      const parsed = JSON.parse(match[1]);
      return {
        intent: parsed.i,
        payload: parsed.p || {},
        sender: parsed.s,
        target: parsed.t
      };
    } catch (e) {
      console.error("Errore di decodifica LLM-CL:", e);
      return null;
    }
  },

  /**
   * Estrae e rimuove il blocco LLM-CL dal testo, restituendo il testo pulito e il messaggio decodificato.
   */
  extract: (text: string): { cleanText: string, message: AgentMessage | null } => {
    const message = LLMCL.decode(text);
    const cleanText = text.replace(/<LLMCL>.*?<\/LLMCL>/s, '').trim();
    return { cleanText, message };
  }
};
