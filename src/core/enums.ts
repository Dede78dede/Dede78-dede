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
