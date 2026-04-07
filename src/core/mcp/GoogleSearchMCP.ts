import { MCPTool } from './types';
import { z } from 'zod';
import { generateWithGemini } from '../../services/geminiService';

export const GoogleSearchTool: MCPTool<{ query: string }> = {
  name: 'google_search',
  description: 'Esegue una ricerca su Google per trovare informazioni aggiornate e recenti.',
  schema: z.object({
    query: z.string().describe('La query di ricerca da eseguire su Google.')
  }),
  execute: async (args) => {
    try {
      // Utilizziamo Gemini con il tool googleSearch abilitato per ottenere i risultati
      const response = await generateWithGemini(
        `Cerca su Google e fornisci un riassunto dettagliato per: ${args.query}`,
        undefined,
        "gemini-3.1-pro-preview",
        "Sei un assistente di ricerca. Usa il tool di ricerca web per rispondere.",
        true // enableWebSearch
      );
      return { result: response };
    } catch (error: any) {
      return { error: `Errore durante la ricerca web: ${error.message}` };
    }
  }
};
