import React, { createContext, useContext, ReactNode } from 'react';
import { GoogleDriveConfig } from '../services/GoogleDriveProvider';
import { SyncStatus } from '../core/enums';
import { useBackupLogic } from '../features/backup/hooks/useBackupLogic';

interface BackupContextType {
  syncStatus: SyncStatus;
  isGoogleDriveConnected: boolean;
  lastBackupTime: string | null;
  connectGoogleDrive: (config: GoogleDriveConfig) => Promise<void>;
  disconnectGoogleDrive: () => void;
  triggerManualBackup: () => Promise<void>;
  restoreLatestBackup: () => Promise<void>;
}

const BackupContext = createContext<BackupContextType | undefined>(undefined);

export function BackupProvider({ children }: { children: ReactNode }) {
  const {
    syncStatus,
    isGoogleDriveConnected,
    lastBackupTime,
    connectGoogleDrive,
    disconnectGoogleDrive,
    triggerManualBackup,
    restoreLatestBackup
  } = useBackupLogic();

  return (
    <BackupContext.Provider value={{
      syncStatus,
      isGoogleDriveConnected,
      lastBackupTime,
      connectGoogleDrive,
      disconnectGoogleDrive,
      triggerManualBackup,
      restoreLatestBackup
    }}>
      {children}
    </BackupContext.Provider>
  );
}

export function useBackup() {
  const context = useContext(BackupContext);
  if (context === undefined) {
    throw new Error('useBackup must be used within a BackupProvider');
  }
  return context;
}
