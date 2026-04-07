import { MCPRegistry, MCPTool } from './types';
import { MCPError, Result } from '../errors';
import { GoogleSearchTool } from './GoogleSearchMCP';

export class SystemMCPRegistry implements MCPRegistry {
  private tools: Map<string, MCPTool> = new Map();

  constructor() {
    this.registerTool(GoogleSearchTool);
  }

  public registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
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
      return [new MCPError(`Tool ${name} non trovato.`, name), null];
    }
    
    try {
      const parsedArgs = tool.schema.parse(args);
      const result = await tool.execute(parsedArgs, context);
      return [null, result];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return [new MCPError(errorMessage, name), null];
    }
  }
}
