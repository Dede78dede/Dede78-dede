import React, { useState, useEffect, useCallback } from 'react';
import { Download, CheckCircle2, AlertCircle, HardDrive, Trash2, Play, Loader2 } from 'lucide-react';
import { pipeline, env } from '@huggingface/transformers';
import { useSettings } from '../context/SettingsContext';

// Skip local model check for browser environment
env.allowLocalModels = false;

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  size: string;
  type: 'webgpu' | 'wasm';
}

const AVAILABLE_MODELS: ModelInfo[] = [
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

export function Models() {
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

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-zinc-100">Modelli Locali</h2>
        <p className="text-zinc-400 mt-1">Scarica e gestisci i modelli da eseguire direttamente nel tuo browser per la massima privacy.</p>
      </header>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {AVAILABLE_MODELS.map(model => {
          const isCached = cachedModels.includes(model.id);
          const isDownloading = downloadingModel === model.id;
          const isActive = settings.edgeModel === model.id;

          return (
            <div key={model.id} className={`bg-zinc-900 border rounded-xl overflow-hidden flex flex-col ${isActive ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-zinc-800'}`}>
              <div className="p-5 flex-1 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-zinc-100">{model.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-md border border-zinc-700">
                        {model.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <HardDrive className="w-3 h-3" /> {model.size}
                      </span>
                    </div>
                  </div>
                  {isActive && (
                    <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-1 rounded-md border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Attivo
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {model.description}
                </p>

                {isDownloading && (
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Download in corso...</span>
                      <span>{getOverallProgress()}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                        style={{ width: `${getOverallProgress()}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {Object.values(downloadProgress).filter(p => p.status === 'downloading').map(p => p.file).join(', ') || 'Inizializzazione...'}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex gap-2">
                {!isCached && !isDownloading && (
                  <button
                    onClick={() => downloadModel(model)}
                    disabled={downloadingModel !== null}
                    className="flex-1 flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    Scarica e Salva
                  </button>
                )}

                {isDownloading && (
                  <button
                    disabled
                    className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 text-zinc-400 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scaricamento...
                  </button>
                )}

                {isCached && !isDownloading && (
                  <>
                    {!isActive ? (
                      <button
                        onClick={() => setAsActive(model.id)}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        Imposta come Attivo
                      </button>
                    ) : (
                      <div className="flex-1 flex items-center justify-center gap-2 bg-zinc-800/50 text-zinc-500 px-4 py-2 rounded-lg text-sm font-medium cursor-default">
                        <CheckCircle2 className="w-4 h-4" />
                        Pronto all'uso
                      </div>
                    )}
                    <button
                      onClick={() => clearCache(model.id)}
                      className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-zinc-800 hover:border-red-500/20"
                      title="Elimina modello salvato"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 flex gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <HardDrive className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h4 className="text-zinc-100 font-medium mb-1">Salvataggio su Locale</h4>
          <p className="text-sm text-zinc-400 leading-relaxed">
            I modelli scaricati vengono salvati direttamente nella cache del tuo browser. 
            Questo significa che <strong>non dovrai riscaricarli</strong> la prossima volta che aprirai l'applicazione, 
            permettendoti di riprendere il lavoro immediatamente e anche offline.
          </p>
        </div>
      </div>
    </div>
  );
}
