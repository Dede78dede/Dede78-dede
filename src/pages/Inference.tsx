import { Bot, User, Zap, Settings2, Loader2, Database, Cloud, MessageSquare, Plus, Trash2, AlertTriangle, Command, ShieldCheck, AlertCircle, Paperclip, X, Globe, Code2, Send } from 'lucide-react';
import { ChatMessageContent } from '../features/chat/components/ChatMessageContent';
import { useInferenceLogic } from '../features/chat/hooks/useInferenceLogic';

/**
 * Inference page component.
 * Provides the main chat interface for interacting with various LLMs (Local, Cloud, Ollama).
 * Integrates with SmarterRouter for intelligent routing and MemorySystem for caching.
 */
export function Inference() {
  const {
    settings,
    updateSettings,
    chats,
    currentChatId,
    setCurrentChatId,
    deleteChat,
    chatsLoading,
    messages,
    input,
    setInput,
    attachments,
    setAttachments,
    useWebSearch,
    setUseWebSearch,
    selectedModel,
    setSelectedModel,
    isProcessing,
    ollamaReachable,
    showMacros,
    setShowMacros,
    messagesEndRef,
    fileInputRef,
    filteredMacros,
    handleMacroSelect,
    handleFileChange,
    removeAttachment,
    handleVerify,
    handleSend,
    isModelLoading,
    isReady,
    backend,
    webLlmError,
    isWebLlmLoading,
    webLlmProgress,
    isWebLlmReady
  } = useInferenceLogic();

  return (
    <div className="flex h-full w-full">
      {/* Chat Sidebar */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-950/50 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-zinc-800">
          <button 
            onClick={() => {
              setCurrentChatId(null);
            }}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuova Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chatsLoading ? (
            <div className="text-zinc-500 text-sm p-4 text-center">Caricamento...</div>
          ) : chats.length === 0 ? (
            <div className="text-zinc-500 text-sm p-4 text-center">Nessuna chat</div>
          ) : (
            chats.map(chat => (
              <div 
                key={chat.id}
                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  currentChatId === chat.id ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
                onClick={() => setCurrentChatId(chat.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm truncate">{chat.title || 'Nuova Chat'}</span>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full max-w-5xl mx-auto relative">
        <header className="p-4 md:p-6 border-b border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Inferenza Rapida</h2>
          <p className="text-sm text-zinc-400">Testa i modelli tramite SmarterRouter e 4L-Cache</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 w-full md:w-auto">
            <User className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <select 
              value={settings.activeProfileId}
              onChange={(e) => updateSettings({ activeProfileId: e.target.value })}
              className="bg-transparent text-sm text-zinc-200 focus:outline-none w-full"
            >
              {settings.profiles.map(profile => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 w-full md:w-auto">
            <Settings2 className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-sm text-zinc-200 focus:outline-none w-full"
            >
              <optgroup label="Routing Automatico">
                <option value="auto">Auto-Routing (SmarterRouter)</option>
              </optgroup>
              <optgroup label="Cloud Models (Master)">
                <option value={`master/${settings.masterModel}`}>Master Predefinito ({settings.masterModel})</option>
                <option value="master/gemini">Gemini 3.1 Pro</option>
                <option value="master/openai">GPT-4o (OpenAI)</option>
                <option value="master/anthropic">Claude 3.5 Sonnet</option>
                <option value="master/groq">Llama 3 (Groq)</option>
                <option value="master/deepseek">DeepSeek Chat</option>
              </optgroup>
              <optgroup label="Local Models (Browser/WebGPU)">
                <option value="transformers:Xenova/Qwen1.5-0.5B-Chat">Qwen 0.5B (Transformers.js)</option>
                <option value="transformers:Xenova/TinyLlama-1.1B-Chat-v1.0">TinyLlama 1.1B (Transformers.js)</option>
              </optgroup>
              <optgroup label="Native GGUF (WebLLM)">
                <option value="webllm:Llama-3.2-1B-Instruct-q4f16_1-MLC">Llama 3.2 1B (q4)</option>
                <option value="webllm:Llama-3.2-3B-Instruct-q4f16_1-MLC">Llama 3.2 3B (q4)</option>
                <option value="webllm:Phi-3.5-mini-instruct-q4f16_1-MLC">Phi 3.5 Mini (q4)</option>
              </optgroup>
              <optgroup label="Remote/Local APIs">
                <option value="colab">Colab Endpoint (ngrok)</option>
                <option value={`ollama/${settings.fallbackModel}`}>{settings.fallbackModel} (Ollama Locale)</option>
              </optgroup>
            </select>
          </div>
          <button
            onClick={() => updateSettings({ useAntigravityShield: !settings.useAntigravityShield })}
            className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 w-full md:w-auto text-sm transition-colors ${
              settings.useAntigravityShield 
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title={settings.useAntigravityShield ? "Antigravity Shield Attivo" : "Antigravity Shield Disattivato"}
          >
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline">Shield</span>
          </button>
          <button
            onClick={() => updateSettings({ useJulesImpactAnalysis: !settings.useJulesImpactAnalysis })}
            className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 w-full md:w-auto text-sm transition-colors ${
              settings.useJulesImpactAnalysis 
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title={settings.useJulesImpactAnalysis ? "Jules Impact Analysis Attivo" : "Jules Impact Analysis Disattivato"}
          >
            <Code2 className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline">Jules</span>
          </button>
          <button
            onClick={() => updateSettings({ useLocalRag: !settings.useLocalRag })}
            className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 w-full md:w-auto text-sm transition-colors ${
              settings.useLocalRag 
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title={settings.useLocalRag ? "RAG Locale Attivo" : "RAG Locale Disattivato"}
          >
            <Database className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline">RAG</span>
          </button>
          <button
            onClick={() => setUseWebSearch(!useWebSearch)}
            className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 w-full md:w-auto text-sm transition-colors ${
              useWebSearch 
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title={useWebSearch ? "Ricerca Web Attiva" : "Ricerca Web Disattivata"}
          >
            <Globe className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline">Web</span>
          </button>
          {selectedModel.startsWith('transformers:') && (
            <div className="text-xs flex items-center gap-1">
              {isModelLoading ? (
                <span className="text-yellow-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Caricamento...</span>
              ) : isReady ? (
                <span className="text-emerald-500 flex items-center gap-1"><Zap className="w-3 h-3" /> Pronto ({backend})</span>
              ) : (
                <span className="text-zinc-500">In attesa</span>
              )}
            </div>
          )}
          {selectedModel.startsWith('webllm:') && (
            <div className="text-xs flex items-center gap-1">
              {webLlmError ? (
                <span className="text-red-500 flex items-center gap-1" title={webLlmError}>
                  <AlertCircle className="w-3 h-3" /> Errore WebLLM
                </span>
              ) : isWebLlmLoading ? (
                <span className="text-yellow-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {webLlmProgress ? `${Math.round(webLlmProgress.progress * 100)}%` : 'Caricamento...'}
                </span>
              ) : isWebLlmReady ? (
                <span className="text-emerald-500 flex items-center gap-1"><Zap className="w-3 h-3" /> Pronto (WebGPU)</span>
              ) : (
                <span className="text-zinc-500">In attesa</span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Ollama Breakout Warning Banner */}
      {selectedModel.startsWith('ollama/') && !ollamaReachable && (
        <div className="mx-4 md:mx-6 mt-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>Ollama locale non raggiungibile. Potrebbe essere bloccato dal browser (Mixed Content).</span>
          </div>
          <button
            onClick={() => window.open(window.location.href + '?ollama_auth=1', 'ollama_auth', 'width=600,height=600')}
            className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 rounded-md transition-colors whitespace-nowrap font-medium w-full md:w-auto"
          >
            Autorizza Connessione
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 md:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user' ? 'bg-indigo-500' : 'bg-emerald-500/20 text-emerald-500'
            }`}>
              {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[85%] md:max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              {msg.role === 'assistant' && msg.model !== 'system' && (
                <span className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                  {msg.model.includes('L1') || msg.model.includes('L2') || msg.model.includes('L3') ? (
                    <Database className="w-3 h-3 text-blue-400" />
                  ) : msg.model.includes('master') ? (
                    <Cloud className="w-3 h-3 text-indigo-400" />
                  ) : (
                    <Zap className="w-3 h-3 text-emerald-400" />
                  )}
                  {msg.model}
                </span>
              )}
              <div className={`p-3 md:p-4 rounded-2xl text-sm md:text-base w-full ${
                msg.role === 'user' 
                  ? 'bg-zinc-800 text-zinc-100 rounded-tr-sm whitespace-pre-wrap' 
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-sm'
              }`}>
                <ChatMessageContent role={msg.role} content={msg.content} attachments={msg.attachments} />
                {msg.role === 'assistant' && msg.model !== 'system' && !msg.model.includes('verifier') && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => handleVerify(i)}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 text-xs font-medium text-emerald-500/70 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Applica Chain of Verification (CoVe)"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verifica Risposta
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex gap-3 md:gap-4">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 md:p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <span className="text-sm">Elaborazione in corso...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 md:p-6 bg-zinc-950 border-t border-zinc-800 relative">
        {showMacros && (
          <div className="absolute bottom-full left-4 md:left-6 mb-2 w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-20">
            <div className="p-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              Macro Disponibili
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredMacros.map((macro) => (
                <button
                  key={macro.id}
                  onClick={() => handleMacroSelect(macro.template)}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-800 flex flex-col gap-1 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Command className="w-3 h-3 text-emerald-500" />
                    <span className="text-sm font-medium text-zinc-200">{macro.trigger}</span>
                  </div>
                  <span className="text-xs text-zinc-500 truncate">{macro.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm">
                <Paperclip className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-200 truncate max-w-[150px]">{att.name || 'Allegato'}</span>
                <button 
                  onClick={() => removeAttachment(i)}
                  className="text-zinc-500 hover:text-red-400 ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative flex items-center gap-2">
          <button
            onClick={() => setShowMacros(!showMacros)}
            className={`p-3 md:p-4 rounded-xl border transition-colors flex-shrink-0 ${
              showMacros 
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title="Mostra Macro"
          >
            <Command className="w-5 h-5" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            multiple 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 md:p-4 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors flex-shrink-0"
            title="Allega File"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              const url = prompt("Inserisci l'URL del file (es. gs://... o https://...):");
              if (url) {
                setAttachments(prev => [...prev, {
                  mimeType: 'application/octet-stream', // Default, might need to infer from URL
                  url: url,
                  name: url.split('/').pop() || 'URL Allegato'
                }]);
              }
            }}
            className="p-3 md:p-4 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors flex-shrink-0"
            title="Allega URL"
          >
            <Cloud className="w-5 h-5" />
          </button>
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !showMacros) handleSend();
                if (e.key === 'Tab' && showMacros && filteredMacros.length > 0) {
                  e.preventDefault();
                  handleMacroSelect(filteredMacros[0].template);
                }
              }}
              placeholder="Scrivi un prompt o usa '/' per le macro..."
              disabled={isProcessing}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 md:py-4 pl-4 pr-12 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 text-sm md:text-base"
            />
            <button 
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || isProcessing}
              className="absolute right-2 p-2 bg-emerald-500 text-zinc-950 rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-zinc-600 mt-3">
          Le richieste vengono instradate automaticamente in base alla complessità e alla cache semantica.
        </p>
      </div>
      </div>
    </div>
  );
}
