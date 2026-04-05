import { useState, useEffect, useCallback } from 'react';
import { pipeline, env } from '@huggingface/transformers';
import { useSettings } from '../../../context/SettingsContext';
import { KnownModelId, DeviceType } from '../../../core/enums';

// Skip local model check for browser environment
env.allowLocalModels = false;

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  size: string;
  type: DeviceType;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: KnownModelId.GEMINI_4_EDGE,
    name: 'Gemma 4 (Edge)',
    description: 'Il nuovo LLM Gemma 4, altamente ottimizzato per l\'esecuzione su dispositivi Edge. Offre capacità di ragionamento avanzate con un footprint ridotto.',
    size: '~1.8GB',
    type: DeviceType.WEBGPU
  },
  {
    id: KnownModelId.QWEN_0_5B_WEBGPU,
    name: 'Qwen 0.5B (WebGPU)',
    description: 'Modello ultra-leggero e veloce, ottimizzato per WebGPU. Ideale per task semplici e routing.',
    size: '~300MB',
    type: DeviceType.WEBGPU
  },
  {
    id: KnownModelId.TINY_LLAMA_1_1B,
    name: 'TinyLlama 1.1B',
    description: 'Modello compatto per conversazioni generali. Buon bilanciamento tra velocità e qualità.',
    size: '~600MB',
    type: DeviceType.WASM
  },
  {
    id: KnownModelId.LA_MINI_FLAN_T5,
    name: 'LaMini Flan-T5',
    description: 'Modello eccellente per seguire istruzioni e task di NLP.',
    size: '~400MB',
    type: DeviceType.WASM
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
      const isWebGPUSupported = typeof navigator !== 'undefined' && 'gpu' in navigator;
      await pipeline('text-generation', model.id, {
        device: model.type === DeviceType.WEBGPU && isWebGPUSupported ? 'webgpu' : 'wasm',
        progress_callback: (progressInfo: unknown) => {
          const p = progressInfo as { status?: string; progress?: number; file?: string };
          setDownloadProgress(prev => ({
            ...prev,
            [p.file || 'model']: {
              status: p.status || 'unknown',
              progress: p.progress || 0,
              file: p.file || 'model'
            }
          }));
        }
      });
      
      // Update settings to use this model as the edge model if it's the first one downloaded
      if (!settings.edgeModel || settings.edgeModel === KnownModelId.BITNET_B1) {
        updateSettings({ edgeModel: model.id });
      }

      await checkCache();
    } catch (err: unknown) {
      console.error("Download failed:", err);
      setError(`Errore durante il download: ${err instanceof Error ? err.message : String(err)}`);
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
        updateSettings({ edgeModel: KnownModelId.BITNET_B1 });
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
