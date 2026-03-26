import { SyncStatus, FileMimeType, ErrorCode } from '../core/enums';
import { IStorageProvider, StorageNode, BackupConfig } from '../core/protocols';

/**
 * The SyncEngine orchestrates the synchronization and backup process between
 * a local storage provider and a cloud storage provider.
 * It is completely agnostic to the UI and relies entirely on the IStorageProvider protocol.
 */
export class SyncEngine {
  private readonly localProvider: IStorageProvider;
  private readonly cloudProvider: IStorageProvider;
  private readonly config: BackupConfig;
  private syncIntervalId: number | null = null;
  private status: SyncStatus = SyncStatus.IDLE;

  constructor(
    localProvider: IStorageProvider,
    cloudProvider: IStorageProvider,
    config: BackupConfig
  ) {
    this.localProvider = localProvider;
    this.cloudProvider = cloudProvider;
    this.config = config;
  }

  /**
   * Starts the automatic synchronization process based on the configured interval.
   */
  public startAutoSync(): void {
    if (this.syncIntervalId !== null) {
      return; // Already running
    }

    this.syncIntervalId = window.setInterval(async () => {
      await this.sync();
    }, this.config.autoSyncIntervalMs);
  }

  /**
   * Stops the automatic synchronization process.
   */
  public stopAutoSync(): void {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Gets the current synchronization status.
   */
  public getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Performs a manual synchronization between local and cloud storage.
   * Handles conflict resolution based on modified timestamps.
   */
  public async sync(): Promise<void> {
    if (this.status === SyncStatus.SYNCING) {
      return; // Prevent concurrent syncs
    }

    this.status = SyncStatus.SYNCING;

    try {
      // 1. Initialize both providers
      const [localInitErr] = await this.localProvider.initialize();
      if (localInitErr) throw localInitErr;

      const [cloudInitErr] = await this.cloudProvider.initialize();
      if (cloudInitErr) throw cloudInitErr;

      // 2. List files from both providers
      const [localListErr, localFiles] = await this.localProvider.listFiles();
      if (localListErr) throw localListErr;

      const [cloudListErr, cloudFiles] = await this.cloudProvider.listFiles();
      if (cloudListErr) throw cloudListErr;

      // 3. Compare and synchronize
      await this.reconcile(localFiles, cloudFiles);

      this.status = SyncStatus.SUCCESS;
    } catch (error) {
      this.status = SyncStatus.ERROR;
      throw error;
    }
  }

  /**
   * Core logic for reconciling differences between local and cloud files.
   * Implements a "last write wins" strategy based on modifiedTime.
   */
  private async reconcile(localFiles: StorageNode[], cloudFiles: StorageNode[]): Promise<void> {
    const localMap = new Map(localFiles.map(f => [f.name, f]));
    const cloudMap = new Map(cloudFiles.map(f => [f.name, f]));

    const allFileNames = new Set([...localMap.keys(), ...cloudMap.keys()]);

    for (const fileName of allFileNames) {
      const localFile = localMap.get(fileName);
      const cloudFile = cloudMap.get(fileName);

      if (localFile && !cloudFile) {
        // Exists locally, not in cloud -> Upload to cloud
        await this.uploadToCloud(localFile);
      } else if (!localFile && cloudFile) {
        // Exists in cloud, not locally -> Download to local
        await this.downloadToLocal(cloudFile);
      } else if (localFile && cloudFile) {
        // Exists in both -> Compare timestamps
        const localTime = new Date(localFile.modifiedTime).getTime();
        const cloudTime = new Date(cloudFile.modifiedTime).getTime();

        if (localTime > cloudTime) {
          // Local is newer -> Upload to cloud
          await this.uploadToCloud(localFile);
        } else if (cloudTime > localTime) {
          // Cloud is newer -> Download to local
          await this.downloadToLocal(cloudFile);
        }
        // If timestamps are identical, do nothing.
      }
    }
  }

  /**
   * Uploads a file from local storage to cloud storage.
   */
  private async uploadToCloud(localFile: StorageNode): Promise<void> {
    const [readErr, content] = await this.localProvider.readFile<unknown>(localFile.id);
    if (readErr) throw readErr;

    const [writeErr] = await this.cloudProvider.writeFile(
      localFile.name,
      content.data,
      undefined, // parentId handling can be added here if needed
      localFile.mimeType as FileMimeType
    );
    if (writeErr) throw writeErr;
  }

  /**
   * Downloads a file from cloud storage to local storage.
   */
  private async downloadToLocal(cloudFile: StorageNode): Promise<void> {
    const [readErr, content] = await this.cloudProvider.readFile<unknown>(cloudFile.id);
    if (readErr) throw readErr;

    const [writeErr] = await this.localProvider.writeFile(
      cloudFile.name,
      content.data,
      undefined, // parentId handling can be added here if needed
      cloudFile.mimeType as FileMimeType
    );
    if (writeErr) throw writeErr;
  }
}
