export interface RoutingPolicy {
  maxCostPer1kTokens?: number;
  maxLatencyMs?: number;
  requireLocalPrivacy?: boolean;
}

export interface ModelCapabilities {
  provider: string;
  model: string;
  costPer1kTokens: number;
  estimatedLatencyMs: number;
  isLocal: boolean;
}

export class PolicyEngine {
  private static availableModels: ModelCapabilities[] = [
    { provider: 'local', model: 'ollama', costPer1kTokens: 0, estimatedLatencyMs: 500, isLocal: true },
    { provider: 'groq', model: 'llama3-70b-8192', costPer1kTokens: 0.0007, estimatedLatencyMs: 300, isLocal: false },
    { provider: 'openai', model: 'gpt-4o-mini', costPer1kTokens: 0.00015, estimatedLatencyMs: 800, isLocal: false },
    { provider: 'anthropic', model: 'claude-3-haiku-20240307', costPer1kTokens: 0.00025, estimatedLatencyMs: 1000, isLocal: false },
    { provider: 'openai', model: 'gpt-4o', costPer1kTokens: 0.005, estimatedLatencyMs: 1500, isLocal: false },
    { provider: 'anthropic', model: 'claude-3-5-sonnet-20240620', costPer1kTokens: 0.003, estimatedLatencyMs: 2000, isLocal: false },
    { provider: 'deepseek', model: 'deepseek-chat', costPer1kTokens: 0.00014, estimatedLatencyMs: 1200, isLocal: false }
  ];

  /**
   * Evaluates the prompt and policy to select the best model.
   */
  static evaluate(prompt: string, policy: RoutingPolicy): ModelCapabilities {
    // 1. Privacy Check: If prompt contains PII or policy requires local, force local.
    if (policy.requireLocalPrivacy || this.containsPII(prompt)) {
      const localModels = this.availableModels.filter(m => m.isLocal);
      if (localModels.length > 0) return localModels[0];
      throw new Error("Privacy policy requires a local model, but none are available.");
    }

    // 2. Filter models based on cost and latency constraints
    let candidates = this.availableModels.filter(m => {
      if (policy.maxCostPer1kTokens !== undefined && m.costPer1kTokens > policy.maxCostPer1kTokens) return false;
      if (policy.maxLatencyMs !== undefined && m.estimatedLatencyMs > policy.maxLatencyMs) return false;
      return true;
    });

    if (candidates.length === 0) {
      // Fallback to the cheapest available model if constraints are too strict
      candidates = [...this.availableModels].sort((a, b) => a.costPer1kTokens - b.costPer1kTokens);
    }

    // 3. Select the best model (e.g., cheapest among those that meet the criteria)
    candidates.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens);
    
    return candidates[0];
  }

  /**
   * Simple heuristic to detect Personally Identifiable Information (PII).
   */
  private static containsPII(text: string): boolean {
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b(?:\d[ -]*?){13,16}\b/, // Credit Card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ // Email
    ];
    return piiPatterns.some(pattern => pattern.test(text));
  }
}
