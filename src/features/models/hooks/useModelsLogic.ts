import { useState, useEffect, useCallback } from 'react';
import { pipeline, env } from '@huggingface/transformers';
import { useSettings } from '../../../context/SettingsContext';

// Skip local model check for browser environment
env.allowLocalModels = false;

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  size: string;
  type: 'webgpu' | 'wasm';
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'Xenova/Qwen1.5-0.5B-Chat',
    name: 'Qwen 0.5B (WebGPU)',
    description: 'Modello ultra-leggero e veloce, ottimizzato per WebGPU. Ideale per task semplici e routing.',
    size: '~300MB',
    type: 'webgpu'
  },
  {
    id: 'Xenova/TinyLlama-1.1B-Chat-v1.0',
    name: 'TinyLlama 1.1B',
    description: 'Modello compatto per conversazioni generali. Buon bilanciamento tra velocità e qualità.',
    size: '~600MB',
    type: 'wasm'
  },
  {
    id: 'Xenova/LaMini-Flan-T5-783M',
    name: 'LaMini Flan-T5',
    description: 'Modello eccellente per seguire istruzioni e task di NLP.',
    size: '~400MB',
    type: 'wasm'
  }
];

export function useModelsLogic() {
  const { settings, updateSettings } = useSettings();
  const [downloadProgress, setDownloadProgress] = useState<Record<string, { status: string, progress: number, file: string }>>({});
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [cachedModels, setCachedModels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Check which models are already in cache
  const checkCache = useCallback(async () => {
    try {
      if (!('caches' in window)) return;
      const cacheKeys = await caches.keys();
      const transformersCaches = cacheKeys.filter(key => key.includes('transformers'));
      
      const foundModels: string[] = [];
      for (const cacheName of transformersCaches) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const model of AVAILABLE_MODELS) {
          // Check if any request URL includes the model ID
          if (requests.some(req => req.url.includes(model.id))) {
            if (!foundModels.includes(model.id)) {
              foundModels.push(model.id);
            }
          }
        }
      }
      setCachedModels(foundModels);
    } catch (err) {
      console.error("Error checking cache:", err);
    }
  }, []);

  useEffect(() => {
    checkCache();
  }, [checkCache]);

  const downloadModel = async (model: ModelInfo) => {
    if (downloadingModel) return;
    
    setDownloadingModel(model.id);
    setError(null);
    setDownloadProgress({});

    try {
      // We just initialize the pipeline to trigger the download and caching
      await pipeline('text-generation', model.id, {
        device: model.type === 'webgpu' && !!(navigator as any).gpu ? 'webgpu' : 'wasm',
        progress_callback: (progressInfo: any) => {
          setDownloadProgress(prev => ({
            ...prev,
            [progressInfo.file || 'model']: {
              status: progressInfo.status,
              progress: progressInfo.progress || 0,
              file: progressInfo.file || 'model'
            }
          }));
        }
      });
      
      // Update settings to use this model as the edge model if it's the first one downloaded
      if (!settings.edgeModel || settings.edgeModel === 'bitnet-b1') {
        updateSettings({ edgeModel: model.id });
      }

      await checkCache();
    } catch (err: any) {
      console.error("Download failed:", err);
      setError(`Errore durante il download: ${err.message}`);
    } finally {
      setDownloadingModel(null);
    }
  };

  const clearCache = async (modelId: string) => {
    try {
      if (!('caches' in window)) return;
      const cacheKeys = await caches.keys();
      const transformersCaches = cacheKeys.filter(key => key.includes('transformers'));
      
      for (const cacheName of transformersCaches) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const req of requests) {
          if (req.url.includes(modelId)) {
            await cache.delete(req);
          }
        }
      }
      await checkCache();
      
      // If we deleted the active edge model, reset it
      if (settings.edgeModel === modelId) {
        updateSettings({ edgeModel: 'bitnet-b1' });
      }
    } catch (err) {
      console.error("Error clearing cache:", err);
    }
  };

  const setAsActive = (modelId: string) => {
    updateSettings({ edgeModel: modelId });
  };

  // Calculate overall progress for the currently downloading model
  const getOverallProgress = () => {
    const files = Object.values(downloadProgress);
    if (files.length === 0) return 0;
    
    const totalProgress = files.reduce((acc, curr) => acc + curr.progress, 0);
    return Math.round(totalProgress / files.length);
  };

  return {
    settings,
    downloadProgress,
    downloadingModel,
    cachedModels,
    error,
    downloadModel,
    clearCache,
    setAsActive,
    getOverallProgress
  };
}
