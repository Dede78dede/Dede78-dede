/**
 * Implementazione del protocollo LLM-CL per comunicazione efficiente.
 * Formato: @v1.0{#tipo {#campo "valore"}}
 */
export class LLMCL {
  /**
   * Encodes a request into the LLM-CL format.
   * Example output: `@v1.0{#type #key{"value"}}`
   * 
   * @param type The type of the request or action.
   * @param params A dictionary of parameters to include.
   * @returns The encoded LLM-CL string.
   */
  static encodeRequest(type: string, params: Record<string, unknown>): string {
    const version = "@v1.0";
    const content = `#${type}`;
    
    const fields = Object.entries(params).map(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        const subFields = Object.entries(value)
          .map(([k, v]) => `#${k}{${String(v)}}`)
          .join(' ');
        return `#${key}{${subFields}}`;
      }
      return `#${key}{"${String(value)}"}`;
    });
    
    return `${version}{${content} ${fields.join(' ')}}`;
  }

  /**
   * Decodes a basic LLM-CL string response.
   * 
   * @param llmClString The raw LLM-CL string.
   * @returns An object containing the parsed content or raw string on failure.
   */
  static decodeResponse(llmClString: string): Record<string, unknown> {
    try {
      const firstBrace = llmClString.indexOf("{");
      const lastBrace = llmClString.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1) throw new Error("Invalid format");
      
      const content = llmClString.substring(firstBrace + 1, lastBrace);
      return { raw: llmClString, parsed: true, content };
    } catch (e) {
      return { raw: llmClString, parsed: false };
    }
  }

  /**
   * Estrae azioni LLM-CL dal testo generato dal modello.
   * Ritorna il testo ripulito e un array di azioni.
   */
  static parseActions(text: string): { cleanText: string, actions: Record<string, unknown>[] } {
    const actions: Record<string, unknown>[] = [];
    let cleanText = text;
    
    // Regex per trovare blocchi LLM-CL: @v1.0{#action_name {#param "value"}}
    // Supporta anche formati più semplici come @v1.0{#action_name #param="value"}
    const regex = /@v1\.0\{#([a-zA-Z0-9_]+)\s+([^}]+)\}/g;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      const actionType = match[1];
      const paramsStr = match[2];
      
      // Estrai i parametri (es. #filename{"test.md"} o #filename "test.md")
      const params: Record<string, string> = {};
      const paramRegex = /#([a-zA-Z0-9_]+)(?:\{"([^"]*)"\}|\s+"([^"]*)")/g;
      let paramMatch;
      while ((paramMatch = paramRegex.exec(paramsStr)) !== null) {
        params[paramMatch[1]] = paramMatch[2] || paramMatch[3];
      }
      
      actions.push({ type: actionType, params });
      
      // Rimuovi l'azione dal testo visibile
      cleanText = cleanText.replace(match[0], '');
    }
    
    return { cleanText: cleanText.trim(), actions };
  }
}
