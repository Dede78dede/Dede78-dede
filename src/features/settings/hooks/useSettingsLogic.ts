import { useState, useEffect, useCallback } from 'react';
import { useSettings, Macro, Profile } from '../../../context/SettingsContext';
import { useBackup } from '../../../context/BackupContext';
import { authenticatedFetch } from '../../../utils/api';

export const WEBLLM_MODELS = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B (q4)' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B (q4)' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi 3.5 Mini (q4)' }
];

export function useSettingsLogic() {
  const { settings, updateSettings } = useSettings();
  const { 
    syncStatus, 
    isGoogleDriveConnected, 
    lastBackupTime, 
    connectGoogleDrive, 
    disconnectGoogleDrive, 
    triggerManualBackup, 
    restoreLatestBackup 
  } = useBackup();
  
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaved, setIsSaved] = useState(false);

  // Ollama Sync State
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isSyncingOllama, setIsSyncingOllama] = useState(false);
  const [ollamaSyncStatus, setOllamaSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [ragStatus, setRagStatus] = useState<{isIndexing: boolean, totalChunks: number} | null>(null);

  // WebLLM Cache State
  const [webLlmCacheStatus, setWebLlmCacheStatus] = useState<Record<string, boolean>>({});
  const [isCheckingCache, setIsCheckingCache] = useState(false);

  const checkWebLlmCache = useCallback(async () => {
    setIsCheckingCache(true);
    try {
      const { hasModelInCache } = await import('@mlc-ai/web-llm');
      const status: Record<string, boolean> = {};
      for (const model of WEBLLM_MODELS) {
        status[model.id] = await hasModelInCache(model.id);
      }
      setWebLlmCacheStatus(status);
    } catch (error) {
      console.error("Failed to check WebLLM cache:", error);
    } finally {
      setIsCheckingCache(false);
    }
  }, []);

  useEffect(() => {
    checkWebLlmCache();
  }, [checkWebLlmCache]);

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const deleteWebLlmModel = useCallback(async (modelId: string) => {
    try {
      const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm');
      await deleteModelAllInfoInCache(modelId);
      showNotification(`Modello rimosso dalla cache.`, 'success');
      checkWebLlmCache();
    } catch (error: any) {
      showNotification(`Errore durante la rimozione: ${error.message}`, 'error');
    }
  }, [showNotification, checkWebLlmCache]);

  useEffect(() => {
    if (localSettings.useLocalRag) {
      const checkStatus = async () => {
        try {
          const res = await authenticatedFetch('/api/rag/status');
          if (res.ok) {
            setRagStatus(await res.json());
          }
        } catch (e) {}
      };
      checkStatus();
      const interval = setInterval(checkStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [localSettings.useLocalRag]);

  const handleChange = useCallback(<K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setIsSaved(false);
  }, []);

  const syncOllamaModels = useCallback(async () => {
    if (!localSettings.ollamaUrl) return;
    setIsSyncingOllama(true);
    setOllamaSyncStatus('idle');
    try {
      if (window.location.protocol === 'https:' && localSettings.ollamaUrl.startsWith('http://')) {
        console.warn("Attenzione: Stai tentando di accedere a un server HTTP da un ambiente HTTPS. Questo potrebbe essere bloccato dal browser (Mixed Content).");
      }

      const response = await fetch(`${localSettings.ollamaUrl}/api/tags`);
      if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
      const data = await response.json();
      if (data.models && Array.isArray(data.models)) {
        const models = data.models.map((m: any) => m.name);
        setOllamaModels(models);
        setOllamaSyncStatus('success');
        if (models.length > 0 && !models.includes(localSettings.fallbackModel)) {
          handleChange('fallbackModel', models[0]);
        }
      }
    } catch (error: any) {
      console.warn("Avviso: Sincronizzazione con Ollama non riuscita. Dettagli:", error.message || error);
      if (error.message === 'Failed to fetch') {
        console.warn("Questo è normale se Ollama non è in esecuzione localmente, se CORS non è abilitato (OLLAMA_ORIGINS=\"*\"), o per blocchi Mixed Content.");
      }
      setOllamaSyncStatus('error');
    } finally {
      setIsSyncingOllama(false);
    }
  }, [localSettings.ollamaUrl, localSettings.fallbackModel, handleChange]);

  useEffect(() => {
    if (localSettings.ollamaUrl) {
      syncOllamaModels();
    }
  }, []);

  const handleSave = useCallback(async () => {
    updateSettings(localSettings);
    setIsSaved(true);
    
    if (isGoogleDriveConnected) {
      try {
        await triggerManualBackup();
        showNotification('Impostazioni salvate e sincronizzate con Google Drive.', 'success');
      } catch (e) {
        showNotification('Impostazioni salvate, ma errore durante la sincronizzazione.', 'error');
      }
    } else {
      showNotification('Impostazioni salvate localmente.', 'success');
    }

    setTimeout(() => setIsSaved(false), 3000);
  }, [localSettings, updateSettings, isGoogleDriveConnected, triggerManualBackup, showNotification]);

  const addMacro = useCallback(() => {
    const newMacro: Macro = {
      id: `macro_${Date.now()}`,
      trigger: 'new',
      template: '',
      label: 'Nuova macro'
    };
    handleChange('macros', [...localSettings.macros, newMacro]);
  }, [localSettings.macros, handleChange]);

  const updateMacro = useCallback((id: string, field: keyof Macro, value: string) => {
    handleChange('macros', localSettings.macros.map(m => m.id === id ? { ...m, [field]: value } : m));
  }, [localSettings.macros, handleChange]);

  const deleteMacro = useCallback((id: string) => {
    handleChange('macros', localSettings.macros.filter(m => m.id !== id));
  }, [localSettings.macros, handleChange]);

  const addProfile = useCallback(() => {
    const newProfile: Profile = {
      id: `profile_${Date.now()}`,
      name: 'Nuovo Profilo',
      icon: 'User',
      systemPrompt: 'Sei un assistente utile.',
      masterModel: localSettings.masterModel,
      fallbackModel: localSettings.fallbackModel
    };
    handleChange('profiles', [...localSettings.profiles, newProfile]);
  }, [localSettings.profiles, localSettings.masterModel, localSettings.fallbackModel, handleChange]);

  const updateProfile = useCallback((id: string, field: keyof Profile, value: string) => {
    handleChange('profiles', localSettings.profiles.map(p => p.id === id ? { ...p, [field]: value } : p));
  }, [localSettings.profiles, handleChange]);

  const deleteProfile = useCallback((id: string) => {
    if (localSettings.profiles.length <= 1) {
      showNotification('Devi avere almeno un profilo.', 'error');
      return;
    }
    handleChange('profiles', localSettings.profiles.filter(p => p.id !== id));
    if (localSettings.activeProfileId === id) {
      handleChange('activeProfileId', localSettings.profiles[0].id);
    }
  }, [localSettings.profiles, localSettings.activeProfileId, handleChange, showNotification]);

  return {
    localSettings,
    isSaved,
    ollamaModels,
    isSyncingOllama,
    ollamaSyncStatus,
    notification,
    ragStatus,
    webLlmCacheStatus,
    isCheckingCache,
    syncStatus,
    isGoogleDriveConnected,
    lastBackupTime,
    handleChange,
    handleSave,
    addMacro,
    updateMacro,
    deleteMacro,
    addProfile,
    updateProfile,
    deleteProfile,
    syncOllamaModels,
    checkWebLlmCache,
    deleteWebLlmModel,
    showNotification,
    connectGoogleDrive,
    disconnectGoogleDrive,
    triggerManualBackup,
    restoreLatestBackup
  };
}
