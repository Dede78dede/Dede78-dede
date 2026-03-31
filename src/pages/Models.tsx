import React from 'react';
import { Download, CheckCircle2, AlertCircle, HardDrive, Trash2, Play, Loader2 } from 'lucide-react';
import { useModelsLogic, AVAILABLE_MODELS } from '../features/models/hooks/useModelsLogic';

export function Models() {
  const {
    settings,
    downloadProgress,
    downloadingModel,
    cachedModels,
    error,
    downloadModel,
    clearCache,
    setAsActive,
    getOverallProgress
  } = useModelsLogic();

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
