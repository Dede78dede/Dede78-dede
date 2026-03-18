import { GoogleGenAI } from "@google/genai";

/**
 * Service to interact with the Gemini API.
 * Provides a unified interface for both streaming and non-streaming text generation.
 * 
 * @param prompt The user's input prompt.
 * @param onChunk Optional callback function to receive streaming chunks.
 * @returns A Promise resolving to the complete generated text.
 */
export async function generateWithGemini(
  prompt: string, 
  onChunk?: (chunk: string) => void, 
  modelName: string = "gemini-3-flash-preview",
  systemPrompt?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = systemPrompt || `Sei un assistente AI esperto, parte di una piattaforma LLM avanzata (SmarterRouter). Rispondi in modo conciso e professionale in italiano.
Se ti viene chiesto di creare un file, usa il protocollo LLM-CL per indicare l'azione. Formato: @v1.0{#create_file #filename "nome_file.md" #content "contenuto del file"}`;

  try {
    if (onChunk) {
      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
        }
      });
      let fullText = "";
      for await (const chunk of responseStream) {
        const text = chunk.text || "";
        fullText += text;
        onChunk(text);
      }
      return fullText || "Nessuna risposta generata.";
    } else {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
        }
      });
      return response.text || "Nessuna risposta generata.";
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Errore durante la chiamata a Gemini API.");
  }
}
