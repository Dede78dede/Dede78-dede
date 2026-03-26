import { StorageProviderType, BackupStrategy, FileMimeType } from './enums';
import { Result } from './errors';

/**
 * Represents a file or folder metadata in the storage system.
 */
export interface StorageNode {
  readonly id: string;
  readonly name: string;
  readonly mimeType: FileMimeType | string;
  readonly modifiedTime: string;
  readonly size?: number;
  readonly parentId?: string;
}

/**
 * Represents the content of a file.
 */
export interface StorageFileContent<T = unknown> {
  readonly data: T;
  readonly metadata: StorageNode;
}

/**
 * Protocol (Interface) for any storage provider (Cloud or Local).
 * Ensures the app is agnostic to the underlying storage mechanism.
 */
export interface IStorageProvider {
  readonly type: StorageProviderType;
  
  /**
   * Initializes the connection or authenticates the user.
   */
  initialize(): Promise<Result<void>>;
  
  /**
   * Reads a file's content.
   */
  readFile<T>(fileId: string): Promise<Result<StorageFileContent<T>>>;
  
  /**
   * Writes content to a file. Creates if it doesn't exist, updates otherwise.
   */
  writeFile<T>(name: string, content: T, parentId?: string, mimeType?: FileMimeType): Promise<Result<StorageNode>>;
  
  /**
   * Lists files in a directory.
   */
  listFiles(parentId?: string): Promise<Result<StorageNode[]>>;
  
  /**
   * Deletes a file.
   */
  deleteFile(fileId: string): Promise<Result<void>>;
}

/**
 * Configuration for the backup engine.
 */
export interface BackupConfig {
  readonly strategy: BackupStrategy;
  readonly autoSyncIntervalMs: number;
  readonly cloudProvider: StorageProviderType;
  readonly localProvider: StorageProviderType;
}
