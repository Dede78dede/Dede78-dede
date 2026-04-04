import { z } from 'zod';
import { MCPTool, MCPRegistry } from './types';
import { MCP_TOOL_NAMES, API_ENDPOINTS, ERROR_MESSAGES } from '../abc/constants';
import { MCPError, Result } from '../errors';

export class ObsidianMCP implements MCPRegistry {
  private tools: Map<string, MCPTool> = new Map();
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
    this.registerTools();
  }

  private registerTools(): void {
    // Tool 1: Leggi un file Markdown
    this.tools.set(MCP_TOOL_NAMES.READ_MARKDOWN, {
      name: MCP_TOOL_NAMES.READ_MARKDOWN,
      description: 'Legge il contenuto di un file markdown specifico nel Vault Obsidian. Restituisce il testo del file.',
      schema: z.object({
        filePath: z.string().describe('Il percorso relativo del file nel vault (es. "Progetti/App.md")')
      }),
      execute: async (args: { filePath: string }): Promise<string> => {
        if (typeof window !== 'undefined') {
          const res = await fetch(API_ENDPOINTS.OBSIDIAN_READ, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vaultPath: this.vaultPath, filePath: args.filePath })
          });
          if (!res.ok) throw new MCPError(await res.text(), MCP_TOOL_NAMES.READ_MARKDOWN);
          const data = await res.json() as { content: string };
          return data.content;
        } else {
          throw new MCPError(ERROR_MESSAGES.NODE_EXECUTION_NOT_IMPLEMENTED, MCP_TOOL_NAMES.READ_MARKDOWN);
        }
      }
    });

    // Tool 2: Scrivi o sovrascrivi un file Markdown
    this.tools.set(MCP_TOOL_NAMES.WRITE_MARKDOWN, {
      name: MCP_TOOL_NAMES.WRITE_MARKDOWN,
      description: 'Scrive o sovrascrive un file markdown nel Vault Obsidian.',
      schema: z.object({
        filePath: z.string().describe('Il percorso relativo del file nel vault (es. "Note/NuovaNota.md")'),
        content: z.string().describe('Il contenuto markdown da scrivere nel file')
      }),
      execute: async (args: { filePath: string, content: string }): Promise<string> => {
        if (typeof window !== 'undefined') {
          const res = await fetch(API_ENDPOINTS.OBSIDIAN_WRITE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vaultPath: this.vaultPath, filePath: args.filePath, content: args.content })
          });
          if (!res.ok) throw new MCPError(await res.text(), MCP_TOOL_NAMES.WRITE_MARKDOWN);
          return 'File scritto con successo.';
        }
        throw new MCPError(ERROR_MESSAGES.NODE_EXECUTION_NOT_IMPLEMENTED, MCP_TOOL_NAMES.WRITE_MARKDOWN);
      }
    });

    // Tool 3: Elenca i file in una cartella
    this.tools.set(MCP_TOOL_NAMES.LIST_DIRECTORY, {
      name: MCP_TOOL_NAMES.LIST_DIRECTORY,
      description: 'Elenca tutti i file markdown presenti in una specifica cartella del Vault.',
      schema: z.object({
        directory: z.string().describe('Il percorso della cartella (usa "" per la root)')
      }),
      execute: async (args: { directory: string }): Promise<string> => {
        if (typeof window !== 'undefined') {
          const res = await fetch(API_ENDPOINTS.OBSIDIAN_LIST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vaultPath: this.vaultPath, directory: args.directory })
          });
          if (!res.ok) throw new MCPError(await res.text(), MCP_TOOL_NAMES.LIST_DIRECTORY);
          const data = await res.json() as { files: string[] };
          return `File trovati: ${data.files.join(', ')}`;
        }
        throw new MCPError(ERROR_MESSAGES.NODE_EXECUTION_NOT_IMPLEMENTED, MCP_TOOL_NAMES.LIST_DIRECTORY);
      }
    });
  }

  public getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  public getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  public async executeTool(name: string, args: unknown, context?: unknown): Promise<Result<unknown, MCPError>> {
    const tool = this.tools.get(name);
    if (!tool) {
      return [new MCPError(`Tool ${name} ${ERROR_MESSAGES.TOOL_NOT_FOUND}`, name), null];
    }
    
    try {
      // Validazione rigorosa degli argomenti tramite Zod
      const parsedArgs = tool.schema.parse(args);
      const result = await tool.execute(parsedArgs, context);
      return [null, result];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return [new MCPError(errorMessage, name), null];
    }
  }
}
