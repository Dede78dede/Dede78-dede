import { FileMimeType, ErrorCode } from '../core/enums';
import { Result, AppError, TryCatch } from '../core/errors';
import { IStorageProvider, StorageNode } from '../core/protocols';

/**
 * Represents the structure of the data being backed up.
 */
export interface AppBackupPayload<T = unknown> {
  readonly version: string;
  readonly timestamp: string;
  readonly data: T;
}

/**
 * Manages the creation, restoration, and tracking of backups.
 * Enforces atomicity and separation of business logic.
 */
export class BackupManager {
  private readonly provider: IStorageProvider;
  private readonly BACKUP_PREFIX = 'app_state_v';

  constructor(provider: IStorageProvider) {
    this.provider = provider;
  }

  /**
   * Creates a new incremental backup of the provided data.
   * @param data The application state or model to backup.
   */
  @TryCatch(ErrorCode.SYNC_CONFLICT)
  public async createBackup<T>(data: T): Promise<Result<StorageNode>> {
    const [initErr] = await this.provider.initialize();
    if (initErr) throw initErr;

    const timestamp = new Date().toISOString();
    const version = Date.now().toString();
    const backupFilename = `${this.BACKUP_PREFIX}${version}.json`;

    const payload: AppBackupPayload<T> = {
      version,
      timestamp,
      data,
    };

    // Write the new backup file
    const [writeErr, backupNode] = await this.provider.writeFile(
      backupFilename,
      payload,
      undefined,
      FileMimeType.JSON
    );
    if (writeErr) throw writeErr;

    return [null, backupNode];
  }

  /**
   * Restores the latest backup from the storage provider.
   */
  @TryCatch(ErrorCode.NOT_FOUND)
  public async restoreLatest<T>(): Promise<Result<AppBackupPayload<T>>> {
    const [initErr] = await this.provider.initialize();
    if (initErr) throw initErr;

    const [listErr, files] = await this.provider.listFiles();
    if (listErr) throw listErr;

    // Filter and sort backups by version (timestamp)
    const backupFiles = files
      .filter(f => f.name.startsWith(this.BACKUP_PREFIX) && f.name.endsWith('.json'))
      .sort((a, b) => {
        const versionA = parseInt(a.name.replace(this.BACKUP_PREFIX, '').replace('.json', ''), 10);
        const versionB = parseInt(b.name.replace(this.BACKUP_PREFIX, '').replace('.json', ''), 10);
        return versionA - versionB;
      });

    if (backupFiles.length === 0) {
      throw new AppError('No backups found', ErrorCode.NOT_FOUND);
    }

    const latestBackupNode = backupFiles[backupFiles.length - 1];
    
    const [readErr, fileContent] = await this.provider.readFile<AppBackupPayload<T>>(latestBackupNode.id);
    if (readErr) throw readErr;

    return [null, fileContent.data];
  }
}
