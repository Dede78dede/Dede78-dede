import { z } from 'zod';
import { Result, MCPError } from '../errors';

export interface MCPTool<T = unknown> {
  name: string;
  description: string;
  schema: z.ZodType<T>;
  execute: (args: T, context?: unknown) => Promise<unknown>;
}

export interface MCPRegistry {
  getTools(): MCPTool[];
  getTool(name: string): MCPTool | undefined;
  executeTool(name: string, args: unknown, context?: unknown): Promise<Result<unknown, MCPError>>;
}

// Utility per convertire uno schema Zod nel formato JSON Schema richiesto dai LLM (es. Gemini/OpenAI)
export function zodToJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  // Implementazione semplificata per i tipi base. 
  // In produzione si usa una libreria come 'zod-to-json-schema'
  const def = schema._def as unknown as Record<string, unknown>;
  const typeName = def.typeName;

  if (typeName === 'ZodObject') {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    const shape = (def.shape as () => Record<string, z.ZodType<unknown>>)();
    
    for (const [key, propSchema] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(propSchema);
      if (!(propSchema as unknown as { isOptional: () => boolean }).isOptional()) {
        required.push(key);
      }
    }
    
    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined
    };
  } else if (typeName === 'ZodString') {
    return { type: 'string', description: def.description };
  } else if (typeName === 'ZodNumber') {
    return { type: 'number', description: def.description };
  } else if (typeName === 'ZodBoolean') {
    return { type: 'boolean', description: def.description };
  } else if (typeName === 'ZodArray') {
    return { 
      type: 'array', 
      items: zodToJsonSchema(def.type as z.ZodType<unknown>),
      description: def.description 
    };
  }

  return { type: 'string' }; // Fallback
}
