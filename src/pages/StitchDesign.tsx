import React from 'react';
import { Paintbrush, Code, Figma, Loader2, Play, RefreshCw, Layers } from 'lucide-react';
import { useStitchDesignLogic } from '../features/stitch/hooks/useStitchDesignLogic';

export const StitchDesign = React.memo(function StitchDesign() {
  const {
    user,
    login,
    prompt,
    setPrompt,
    isGenerating,
    currentDesign,
    error,
    activeTab,
    setActiveTab,
    isConnected,
    handleGenerate,
    handleSendToAntiGravity
  } = useStitchDesignLogic();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
            <Paintbrush className="w-8 h-8 text-emerald-500" />
            Google Stitch <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full ml-2">Labs</span>
          </h1>
          <p className="text-zinc-400 mt-2">
            Genera interfacce utente ad alta fedeltà e prototipi partendo da un prompt testuale, integrato via MCP.
          </p>
        </div>
        
        {!user ? (
          <button 
            onClick={login}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors border border-zinc-700"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Accedi con Google
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
              {isConnected ? 'Stitch MCP Connesso' : 'Connessione in corso...'}
            </div>
          </div>
        )}
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Descrivi l'interfaccia che vuoi generare
        </label>
        <div className="flex gap-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Es: Una dashboard analitica scura per monitorare server, con un grande grafico a linee verde smeraldo, 3 card per metriche chiave (CPU, RAM, Rete) e una sidebar di navigazione..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[120px] resize-y"
            disabled={isGenerating || !isConnected}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || !isConnected}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generazione in corso...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Genera UI con Stitch
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results Section */}
      {(isGenerating || currentDesign) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col min-h-[800px] h-[calc(100vh-200px)]">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'preview' 
                    ? 'bg-zinc-800 text-zinc-100' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Layers className="w-4 h-4" />
                Anteprima Visuale
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'code' 
                    ? 'bg-zinc-800 text-zinc-100' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Code className="w-4 h-4" />
                Codice (HTML/CSS)
              </button>
            </div>
            
            {currentDesign && (
              <div className="flex gap-3">
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors border border-zinc-700">
                  <RefreshCw className="w-4 h-4" />
                  Itera
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-md transition-colors border border-purple-500/30">
                  <Figma className="w-4 h-4" />
                  Esporta in Figma
                </button>
                <button 
                  onClick={handleSendToAntiGravity}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-md transition-colors border border-blue-500/30"
                >
                  <Code className="w-4 h-4" />
                  Invia ad AntiGravity
                </button>
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative bg-zinc-950">
            {isGenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-10">
                <div className="w-16 h-16 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
                <h3 className="text-xl font-medium text-zinc-100 mb-2">Stitch sta progettando...</h3>
                <p className="text-zinc-400 text-sm max-w-md text-center">
                  Stiamo esplorando lo spazio delle soluzioni, generando layout, applicando stili e assemblando i componenti.
                </p>
              </div>
            ) : null}

            {currentDesign && activeTab === 'preview' && (
              <div className="w-full h-full p-4 overflow-auto flex items-center justify-center bg-[#09090b]">
                {/* Iframe for the generated design to isolate CSS */}
                <iframe 
                  className="w-full h-full border border-zinc-800 rounded-xl overflow-auto shadow-2xl bg-white dark:bg-zinc-950"
                  srcDoc={`
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <style>${currentDesign.css}</style>
                      </head>
                      <body>
                        ${currentDesign.html}
                      </body>
                    </html>
                  `}
                  title="Stitch Design Preview"
                  sandbox="allow-scripts"
                />
              </div>
            )}

            {currentDesign && activeTab === 'code' && (
              <div className="w-full h-full flex flex-col md:flex-row gap-4 p-4 overflow-hidden">
                <div className="flex-1 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                  <div className="bg-zinc-950 px-4 py-2 text-xs font-mono text-zinc-500 border-b border-zinc-800">index.html</div>
                  <pre className="flex-1 p-4 overflow-auto text-sm font-mono text-zinc-300">
                    <code>{currentDesign.html}</code>
                  </pre>
                </div>
                <div className="flex-1 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                  <div className="bg-zinc-950 px-4 py-2 text-xs font-mono text-zinc-500 border-b border-zinc-800">styles.css</div>
                  <pre className="flex-1 p-4 overflow-auto text-sm font-mono text-zinc-300">
                    <code>{currentDesign.css}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
