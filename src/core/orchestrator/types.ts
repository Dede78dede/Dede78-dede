import { PrivacyLevel } from '../routing/types';
import { MCPTool } from '../mcp/types';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string; // Nome del tool se role === 'tool'
}

export interface OrchestratorOptions {
  maxToolIterations?: number;
  privacyLevel?: PrivacyLevel;
  temperature?: number;
  systemPrompt?: string;
}

export interface ReflectionOptions extends OrchestratorOptions {
  maxReflections?: number;
  criticPrivacyLevel?: PrivacyLevel; // Spesso il critico è un modello Cloud più intelligente
}

export interface DistillationTask {
  id: string;
  taskDescription: string;
  fewShotExamples: Array<{ input: string; output: string }>;
  createdAt: number;
}
