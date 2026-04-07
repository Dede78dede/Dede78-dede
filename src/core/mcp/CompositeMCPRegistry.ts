import { MCPRegistry, MCPTool } from './types';
import { MCPError, Result } from '../errors';

export class CompositeMCPRegistry implements MCPRegistry {
  private registries: MCPRegistry[];

  constructor(registries: MCPRegistry[]) {
    this.registries = registries;
  }

  public getTools(): MCPTool[] {
    return this.registries.flatMap(registry => registry.getTools());
  }

  public getTool(name: string): MCPTool | undefined {
    for (const registry of this.registries) {
      const tool = registry.getTool(name);
      if (tool) return tool;
    }
    return undefined;
  }

  public async executeTool(name: string, args: unknown, context?: unknown): Promise<Result<unknown, MCPError>> {
    for (const registry of this.registries) {
      const tool = registry.getTool(name);
      if (tool) {
        return registry.executeTool(name, args, context);
      }
    }
    return [new MCPError(`Tool ${name} non trovato nei registry combinati.`, name), null];
  }
}
