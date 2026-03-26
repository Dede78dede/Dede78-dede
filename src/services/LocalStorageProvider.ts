import { StorageProviderType, FileMimeType, ErrorCode } from '../core/enums';
import { Result, AppError } from '../core/errors';
import { IStorageProvider, StorageNode, StorageFileContent } from '../core/protocols';

/**
 * LocalStorage implementation of the IStorageProvider protocol.
 * Agnostic storage mechanism for offline/local use.
 */
export class LocalStorageProvider implements IStorageProvider {
  public readonly type = StorageProviderType.LOCAL_STORAGE;
  private readonly PREFIX = 'app_backup_';

  /**
   * Initializes the local storage provider.
   * @returns Result tuple indicating success or failure.
   */
  public async initialize(): Promise<Result<void>> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return [new AppError('LocalStorage not available', ErrorCode.UNAUTHORIZED), null];
      }
      return [null, undefined];
    } catch (error) {
      return [new AppError('Failed to initialize LocalStorage', ErrorCode.UNKNOWN_ERROR, error), null];
    }
  }

  /**
   * Reads a file from LocalStorage.
   * @param fileId The unique identifier (key) of the file.
   * @returns Result tuple containing the file content or an error.
   */
  public async readFile<T>(fileId: string): Promise<Result<StorageFileContent<T>>> {
    try {
      const rawData = localStorage.getItem(fileId);
      if (!rawData) {
        return [new AppError(`File not found: ${fileId}`, ErrorCode.NOT_FOUND), null];
      }

      const parsed = JSON.parse(rawData) as StorageFileContent<T>;
      return [null, parsed];
    } catch (error) {
      return [new AppError(`Failed to read file: ${fileId}`, ErrorCode.UNKNOWN_ERROR, error), null];
    }
  }

  /**
   * Writes content to LocalStorage.
   * @param name The name of the file (used to generate the ID).
   * @param content The content to save.
   * @param parentId Optional parent directory ID (not fully supported in flat LocalStorage, used as prefix).
   * @param mimeType The MIME type of the file.
   * @returns Result tuple containing the saved node metadata or an error.
   */
  public async writeFile<T>(
    name: string,
    content: T,
    parentId?: string,
    mimeType: FileMimeType = FileMimeType.JSON
  ): Promise<Result<StorageNode>> {
    try {
      const id = parentId ? `${this.PREFIX}${parentId}_${name}` : `${this.PREFIX}${name}`;
      const now = new Date().toISOString();

      const metadata: StorageNode = {
        id,
        name,
        mimeType,
        modifiedTime: now,
        parentId,
      };

      const fileContent: StorageFileContent<T> = {
        data: content,
        metadata,
      };

      localStorage.setItem(id, JSON.stringify(fileContent));
      return [null, metadata];
    } catch (error) {
      return [new AppError(`Failed to write file: ${name}`, ErrorCode.UNKNOWN_ERROR, error), null];
    }
  }

  /**
   * Lists all files managed by this provider in LocalStorage.
   * @param parentId Optional parent directory ID to filter by.
   * @returns Result tuple containing an array of node metadata or an error.
   */
  public async listFiles(parentId?: string): Promise<Result<StorageNode[]>> {
    try {
      const nodes: StorageNode[] = [];
      const prefix = parentId ? `${this.PREFIX}${parentId}_` : this.PREFIX;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const rawData = localStorage.getItem(key);
          if (rawData) {
            try {
              const parsed = JSON.parse(rawData) as StorageFileContent<unknown>;
              if (parsed.metadata) {
                nodes.push(parsed.metadata);
              }
            } catch (e) {
              // Ignore invalid JSON
              console.warn(`Invalid JSON in LocalStorage key: ${key}`, e);
            }
          }
        }
      }

      return [null, nodes];
    } catch (error) {
      return [new AppError('Failed to list files', ErrorCode.UNKNOWN_ERROR, error), null];
    }
  }

  /**
   * Deletes a file from LocalStorage.
   * @param fileId The unique identifier (key) of the file.
   * @returns Result tuple indicating success or failure.
   */
  public async deleteFile(fileId: string): Promise<Result<void>> {
    try {
      localStorage.removeItem(fileId);
      return [null, undefined];
    } catch (error) {
      return [new AppError(`Failed to delete file: ${fileId}`, ErrorCode.UNKNOWN_ERROR, error), null];
    }
  }
}
