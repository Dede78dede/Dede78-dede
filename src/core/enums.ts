/**
 * Core Enums for the application to avoid magic strings.
 */

export enum StorageProviderType {
  GOOGLE_DRIVE = 'GOOGLE_DRIVE',
  LOCAL_STORAGE = 'LOCAL_STORAGE',
  INDEXED_DB = 'INDEXED_DB',
}

export enum SyncStatus {
  IDLE = 'IDLE',
  SYNCING = 'SYNCING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  CONFLICT = 'CONFLICT',
}

export enum BackupStrategy {
  FULL = 'FULL',
  INCREMENTAL = 'INCREMENTAL',
}

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
}

export enum FileMimeType {
  JSON = 'application/json',
  TEXT = 'text/plain',
}

export enum BackendType {
  CLOUD = 'cloud',
  OLLAMA = 'ollama',
  WEBGPU = 'webgpu',
  WASM = 'wasm',
}

export enum DeviceType {
  WEBGPU = 'webgpu',
  WASM = 'wasm',
  CPU = 'cpu',
}

export enum ModelProvider {
  GOOGLE = 'Google',
  OPENAI = 'OpenAI',
  ANTHROPIC = 'Anthropic',
  GROQ = 'Groq',
  DEEPSEEK = 'DeepSeek',
  OLLAMA = 'Ollama',
  TRANSFORMERS_JS = 'Transformers.js',
  WEB_LLM = 'WebLLM',
}

export enum KnownModelId {
  GEMINI_2_5_FLASH = 'gemini-2.5-flash',
  GEMINI_3_1_PRO = 'gemini',
  GPT_4O = 'openai',
  CLAUDE_3_5_SONNET = 'anthropic',
  LLAMA_3_70B = 'groq',
  DEEPSEEK_CHAT = 'deepseek',
  GEMINI_4_EDGE = 'onnx-community/gemma-4-E2B-it-ONNX',
  QWEN_0_5B_WEBGPU = 'Xenova/Qwen1.5-0.5B-Chat',
  TINY_LLAMA_1_1B = 'Xenova/TinyLlama-1.1B-Chat-v1.0',
  LA_MINI_FLAN_T5 = 'Xenova/LaMini-Flan-T5-783M',
  BITNET_B1 = 'bitnet-b1',
}
