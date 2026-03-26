import { ErrorCode } from './enums';

/**
 * Base custom error class for the application.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(message: string, code: ErrorCode = ErrorCode.UNKNOWN_ERROR, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Result tuple pattern for functional error handling (ex-try/ex-catch).
 * Returns [Error, null] on failure, or [null, Data] on success.
 */
export type Result<T, E = AppError> = [E, null] | [null, T];

/**
 * Decorator for class methods to automatically wrap execution in a try-catch block
 * and return a Result tuple.
 */
export function TryCatch(errorCode: ErrorCode = ErrorCode.UNKNOWN_ERROR) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]): Promise<Result<any>> {
      try {
        const result = await originalMethod.apply(this, args);
        // If the result is already a Result tuple, return it directly
        if (Array.isArray(result) && result.length === 2 && (result[0] === null || result[0] instanceof Error)) {
          return result as Result<any>;
        }
        return [null, result];
      } catch (error) {
        if (error instanceof AppError) {
          return [error, null];
        }
        const appError = new AppError(
          error instanceof Error ? error.message : String(error),
          errorCode,
          error
        );
        return [appError, null];
      }
    };

    return descriptor;
  };
}
