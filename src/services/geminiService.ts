import { GoogleGenAI, Content, Part } from "@google/genai";
import { Message } from "../context/ChatContext";

/**
 * Service to interact with the Gemini API.
 * Provides a unified interface for both streaming and non-streaming text generation.
 * 
 * @param prompt The user's input prompt or an array of previous messages for context circulation.
 * @param onChunk Optional callback function to receive streaming chunks.
 * @param modelName The name of the Gemini model to use.
 * @param systemPrompt Optional system instruction to guide the model's behavior.
 * @returns A Promise resolving to the complete generated text.
 */
export async function generateWithGemini(
  prompt: string | Message[], 
  onChunk?: (chunk: string) => void, 
  modelName: string = "gemini-3.1-flash-preview",
  systemPrompt?: string,
  enableWebSearch?: boolean
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : undefined);
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = systemPrompt || `Sei un assistente AI esperto, parte di una piattaforma LLM avanzata (SmarterRouter). Rispondi in modo conciso e professionale in italiano.
Se ti viene chiesto di creare un file, usa il protocollo LLM-CL per indicare l'azione. Formato: @v1.0{#create_file #filename "nome_file.md" #content "contenuto del file"}`;

  let contents: Content[] | string;

  if (Array.isArray(prompt)) {
    // Context Circulation: Convert Message[] to Content[]
    contents = prompt.filter(m => m.role !== 'system').map(msg => {
      const parts: Part[] = [];
      
      // Add text part
      if (msg.content) {
        parts.push({ text: msg.content });
      }

      // Add attachment parts (File Handling Ampliato)
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          if (att.data) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.data
              }
            });
          } else if (att.url) {
            parts.push({
              fileData: {
                mimeType: att.mimeType,
                fileUri: att.url
              }
            });
          }
        }
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts
      };
    });
  } else {
    contents = prompt;
  }

  const config: any = {
    systemInstruction,
  };

  if (enableWebSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  try {
    if (onChunk) {
      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: contents,
        config
      });
      let fullText = "";
      let groundingMetadata: any = null;
      
      for await (const chunk of responseStream) {
        const text = chunk.text || "";
        fullText += text;
        
        if (chunk.candidates?.[0]?.groundingMetadata) {
          groundingMetadata = chunk.candidates[0].groundingMetadata;
        }
        
        onChunk(text);
      }
      
      if (groundingMetadata?.groundingChunks?.length > 0) {
        let sourcesText = "\n\n**Fonti Web:**\n";
        groundingMetadata.groundingChunks.forEach((c: any) => {
          if (c.web?.uri && c.web?.title) {
            sourcesText += `- [${c.web.title}](${c.web.uri})\n`;
          }
        });
        fullText += sourcesText;
        onChunk(sourcesText);
      }
      
      return fullText || "Nessuna risposta generata.";
    } else {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config
      });
      
      let text = response.text || "Nessuna risposta generata.";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0) {
        text += "\n\n**Fonti Web:**\n";
        chunks.forEach((chunk: any) => {
          if (chunk.web?.uri && chunk.web?.title) {
            text += `- [${chunk.web.title}](${chunk.web.uri})\n`;
          }
        });
      }
      
      return text;
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Errore durante la chiamata a Gemini API.");
  }
}
