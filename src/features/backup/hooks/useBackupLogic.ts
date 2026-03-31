import { useState, useEffect, useCallback } from 'react';
import { SyncEngine } from '../../../services/SyncEngine';
import { BackupManager } from '../../../services/BackupManager';
import { LocalStorageProvider } from '../../../services/LocalStorageProvider';
import { GoogleDriveProvider, GoogleDriveConfig } from '../../../services/GoogleDriveProvider';
import { StorageProviderType, SyncStatus, BackupStrategy } from '../../../core/enums';
import { BackupConfig } from '../../../core/protocols';
import { useSettings } from '../../../context/SettingsContext';

export function useBackupLogic() {
  const { settings, updateSettings } = useSettings();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(SyncStatus.IDLE);
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState<boolean>(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);

  // Providers
  const localProvider = new LocalStorageProvider();
  const [driveProvider, setDriveProvider] = useState<GoogleDriveProvider | null>(null);
  const [syncEngine, setSyncEngine] = useState<SyncEngine | null>(null);
  const [backupManager, setBackupManager] = useState<BackupManager | null>(null);

  // Initialize Local Backup Manager
  useEffect(() => {
    const manager = new BackupManager(localProvider);
    setBackupManager(manager);
  }, []);

  const connectGoogleDrive = useCallback(async (config: GoogleDriveConfig) => {
    try {
      setSyncStatus(SyncStatus.SYNCING);
      const provider = new GoogleDriveProvider(config);
      const [initErr] = await provider.initialize();
      
      if (initErr) {
        console.error("Failed to connect to Google Drive", initErr);
        setSyncStatus(SyncStatus.ERROR);
        return;
      }

      setDriveProvider(provider);
      setIsGoogleDriveConnected(true);

      const backupConfig: BackupConfig = {
        strategy: BackupStrategy.INCREMENTAL,
        autoSyncIntervalMs: 60000, // 1 minute
        cloudProvider: StorageProviderType.GOOGLE_DRIVE,
        localProvider: StorageProviderType.LOCAL_STORAGE,
      };

      const engine = new SyncEngine(localProvider, provider, backupConfig);
      setSyncEngine(engine);
      engine.startAutoSync();
      
      setSyncStatus(SyncStatus.SUCCESS);
    } catch (error) {
      console.error("Error connecting Google Drive:", error);
      setSyncStatus(SyncStatus.ERROR);
    }
  }, []);

  // Auto-connect to Google Drive if credentials exist
  useEffect(() => {
    if (settings.googleDriveClientId && settings.googleDriveApiKey && !isGoogleDriveConnected && syncStatus === SyncStatus.IDLE) {
      connectGoogleDrive({
        clientId: settings.googleDriveClientId,
        apiKey: settings.googleDriveApiKey,
        scopes: 'https://www.googleapis.com/auth/drive.appdata',
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
      });
    }
  }, [settings.googleDriveClientId, settings.googleDriveApiKey, isGoogleDriveConnected, syncStatus, connectGoogleDrive]);

  const disconnectGoogleDrive = useCallback(() => {
    if (syncEngine) {
      syncEngine.stopAutoSync();
    }
    setDriveProvider(null);
    setSyncEngine(null);
    setIsGoogleDriveConnected(false);
    setSyncStatus(SyncStatus.IDLE);
  }, [syncEngine]);

  const triggerManualBackup = useCallback(async () => {
    if (!backupManager) return;
    
    setSyncStatus(SyncStatus.SYNCING);
    
    // 1. Create local backup
    const [backupErr, node] = await backupManager.createBackup({ settings });
    
    if (backupErr) {
      console.error("Local backup failed", backupErr);
      setSyncStatus(SyncStatus.ERROR);
      return;
    }

    setLastBackupTime(new Date().toISOString());

    // 2. Sync to cloud if connected
    if (syncEngine && isGoogleDriveConnected) {
      try {
        await syncEngine.sync();
        setSyncStatus(SyncStatus.SUCCESS);
      } catch (error) {
        console.error("Cloud sync failed", error);
        setSyncStatus(SyncStatus.ERROR);
      }
    } else {
      setSyncStatus(SyncStatus.SUCCESS);
    }
  }, [backupManager, syncEngine, isGoogleDriveConnected, settings]);

  const restoreLatestBackup = useCallback(async () => {
    if (!backupManager) return;

    setSyncStatus(SyncStatus.SYNCING);

    // If cloud is connected, sync first to ensure we have the latest
    if (syncEngine && isGoogleDriveConnected) {
      try {
        await syncEngine.sync();
      } catch (error) {
        console.error("Cloud sync failed before restore", error);
        // Continue anyway to try restoring from local
      }
    }

    const [restoreErr, payload] = await backupManager.restoreLatest<{ settings: any }>();
    
    if (restoreErr) {
      console.error("Restore failed", restoreErr);
      setSyncStatus(SyncStatus.ERROR);
      return;
    }

    if (payload && payload.data && payload.data.settings) {
      updateSettings(payload.data.settings);
      setSyncStatus(SyncStatus.SUCCESS);
      alert("Restore completed successfully!");
    } else {
      setSyncStatus(SyncStatus.ERROR);
    }
  }, [backupManager, syncEngine, isGoogleDriveConnected, updateSettings]);

  return {
    syncStatus,
    isGoogleDriveConnected,
    lastBackupTime,
    connectGoogleDrive,
    disconnectGoogleDrive,
    triggerManualBackup,
    restoreLatestBackup
  };
}
