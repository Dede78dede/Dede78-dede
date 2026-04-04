import { ErrorCode } from './enums';

// --- VECCHIE CLASSI (Ripristinate per compatibilità) ---

export class AppError extends Error {
  public code: ErrorCode;
  public details?: unknown;
  constructor(message: string, code: ErrorCode = ErrorCode.UNKNOWN_ERROR, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

export type Result<T, E = AppError> = [E, null] | [null, T];

export function TryCatch(defaultErrorCode: ErrorCode = ErrorCode.UNKNOWN_ERROR) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: unknown[]) {
      try {
        const result = await originalMethod.apply(this, args);
        return result; // Assuming the original method already returns a Result tuple
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const appError = error instanceof AppError ? error : new AppError(errorMessage, defaultErrorCode);
        return [appError, null];
      }
    };
    return descriptor;
  };
}

// --- NUOVE CLASSI (Core Engine) ---

export class CoreEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class RoutingError extends CoreEngineError {
  public phase: string;
  constructor(message: string, phase: string) {
    super(`[Routing - ${phase}] ${message}`);
    this.phase = phase;
  }
}

export class AdapterError extends CoreEngineError {
  public provider: string;
  constructor(message: string, provider: string) {
    super(`[Adapter - ${provider}] ${message}`);
    this.provider = provider;
  }
}

export class MCPError extends CoreEngineError {
  public toolName: string;
  constructor(message: string, toolName: string) {
    super(`[MCP Tool - ${toolName}] ${message}`);
    this.toolName = toolName;
  }
}
