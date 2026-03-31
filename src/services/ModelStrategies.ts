
import { ModelProvider } from '../types/enums';

export interface ModelConfig {
  provider: 'gemini' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | string;
  model: string;
  temperature?: number;
  systemPrompt?: string;
  apiKey?: string; // Optional, can be injected later
}

export interface WorkflowContext {
  [key: string]: unknown;
}

export interface IModelStrategy {
  execute(prompt: string, config: ModelConfig, context: WorkflowContext): Promise<string>;
}

export class GeminiStrategy implements IModelStrategy {
  async execute(prompt: string, config: ModelConfig, context: WorkflowContext): Promise<string> {
    throw new Error("Gemini tasks must be executed on the frontend.");
  }
}

abstract class BaseCloudStrategy implements IModelStrategy {
  protected abstract getUrl(): string;
  protected abstract getHeaders(apiKey: string): Record<string, string>;
  protected abstract getBody(prompt: string, config: ModelConfig): Record<string, unknown>;
  protected abstract extractResponse(data: unknown): string;

  async execute(prompt: string, config: ModelConfig, context: WorkflowContext): Promise<string> {
    if (!config.apiKey) throw new Error(`${config.provider} API Key is missing`);

    const url = this.getUrl();
    const headers = this.getHeaders(config.apiKey);
    const body = this.getBody(prompt, config);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${config.provider} API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return this.extractResponse(data);
  }
}

export class OpenAIStrategy extends BaseCloudStrategy {
  protected getUrl() { return "https://api.openai.com/v1/chat/completions"; }
  protected getHeaders(apiKey: string) {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    };
  }
  protected getBody(prompt: string, config: ModelConfig) {
    const messages = [];
    if (config.systemPrompt) messages.push({ role: "system", content: config.systemPrompt });
    messages.push({ role: "user", content: prompt });
    return {
      model: config.model || "gpt-4o",
      messages,
      temperature: config.temperature
    };
  }
  protected extractResponse(data: unknown) {
    const response = data as { choices?: { message?: { content?: string } }[] };
    return response.choices?.[0]?.message?.content || "";
  }
}

export class AnthropicStrategy extends BaseCloudStrategy {
  protected getUrl() { return "https://api.anthropic.com/v1/messages"; }
  protected getHeaders(apiKey: string) {
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    };
  }
  protected getBody(prompt: string, config: ModelConfig) {
    const body: Record<string, unknown> = {
      model: config.model || "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    };
    if (config.systemPrompt) body.system = config.systemPrompt;
    if (config.temperature !== undefined) body.temperature = config.temperature;
    return body;
  }
  protected extractResponse(data: unknown) {
    const response = data as { content?: { text?: string }[] };
    return response.content?.[0]?.text || "";
  }
}

export class GroqStrategy extends OpenAIStrategy {
  protected getUrl() { return "https://api.groq.com/openai/v1/chat/completions"; }
  protected getBody(prompt: string, config: ModelConfig) {
    const body = super.getBody(prompt, config);
    body.model = config.model || "llama3-70b-8192";
    return body;
  }
}

export class DeepSeekStrategy extends OpenAIStrategy {
  protected getUrl() { return "https://api.deepseek.com/chat/completions"; }
  protected getBody(prompt: string, config: ModelConfig) {
    const body = super.getBody(prompt, config);
    body.model = config.model || "deepseek-chat";
    return body;
  }
}

export class StrategyFactory {
  static getStrategy(provider: string): IModelStrategy {
    switch (provider) {
      case ModelProvider.GEMINI: return new GeminiStrategy();
      case ModelProvider.OPENAI: return new OpenAIStrategy();
      case ModelProvider.ANTHROPIC: return new AnthropicStrategy();
      case ModelProvider.GROQ: return new GroqStrategy();
      case ModelProvider.DEEPSEEK: return new DeepSeekStrategy();
      default: throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}
