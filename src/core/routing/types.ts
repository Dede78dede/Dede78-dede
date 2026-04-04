import { ILLMBackend } from '../hal/types';
import { MCPTool } from '../mcp/types';

export enum PrivacyLevel {
  MINIMUM = 'MINIMUM',
  STRICT = 'STRICT',
  CONFIDENTIAL = 'CONFIDENTIAL'
}

export interface RoutingContext {
  prompt: string;
  privacyLevel: PrivacyLevel;
  requiresHighReasoning: boolean;
  maxCost?: number;
  selectedBackend?: ILLMBackend;
  metadata: Record<string, unknown>;
  tools?: MCPTool[];
}

export interface IRouterMiddleware {
  handle(context: RoutingContext, next: () => Promise<void>): Promise<void>;
}
