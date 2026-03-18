import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Zap, Settings2, Loader2, Database, Cloud, MessageSquare, Plus, Trash2, AlertTriangle, Command } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLocalModel } from '../hooks/useLocalModel';
import { LLMCL } from '../utils/llm-cl';
import { metricsService, AuditTrailStep } from '../services/MetricsService';
import { memorySystem } from '../services/MemorySystem';
import { generateWithGemini } from '../services/geminiService';
import { generateWithOpenAI, generateWithAnthropic, generateWithGroq, generateWithDeepSeek } from '../services/cloudLlmService';
import { useSettings } from '../context/SettingsContext';
import { useChat, Message } from '../context/ChatContext';
import { SmarterRouter } from '../services/SmarterRouter';
import { microRouter } from '../services/MicroRouter';
import { preflightResults } from '../preflight';

/**
 * Inference page component.
 * Provides the main chat interface for interacting with various LLMs (Local, Cloud, Ollama).
 * Integrates with SmarterRouter for intelligent routing and MemorySystem for caching.
 */
export function Inference() {
  const { settings } = useSettings();
  const { chats, currentChatId, setCurrentChatId, createNewChat, updateChat, deleteChat, loading: chatsLoading } = useChat();
  
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'SmarterRouter v1.0 pronto. Inserisci un prompt per testare i modelli locali o il Master Cloud.', model: 'system' }
  ]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ollamaReachable, setOllamaReachable] = useState(preflightResults.isOllamaReachable);
  const [showMacros, setShowMacros] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { updateSettings } = useSettings();

  // Listen for Ollama connection breakout success
  useEffect(() => {
    // Initialize MicroRouter in the background
    microRouter.initialize().catch(console.error);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OLLAMA_CONNECTED') {
        setOllamaReachable(true);
        preflightResults.isOllamaReachable = true;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Sync messages with current chat
  useEffect(() => {
    if (isProcessing) return; // Prevent overwriting local messages while streaming

    if (currentChatId) {
      const chat = chats.find(c => c.id === currentChatId);
      if (chat) {
        setMessages(chat.messages);
      }
    } else {
      setMessages([
        { role: 'assistant', content: 'SmarterRouter v1.0 pronto. Inserisci un prompt per testare i modelli locali o il Master Cloud.', model: 'system' }
      ]);
    }
  }, [currentChatId, chats, isProcessing]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Hook for local WebGPU/WASM inference
  const localModelId = selectedModel === 'auto' || selectedModel.startsWith('transformers:') 
    ? (selectedModel.startsWith('transformers:') ? selectedModel.replace('transformers:', '') : 'Xenova/Qwen1.5-0.5B-Chat')
    : null;

  const { generate: generateLocal, backend, isReady, isLoading: isModelLoading } = useLocalModel(localModelId);

  // Filter macros based on input
  const filteredMacros = settings.macros.filter(m => 
    input.startsWith('/') && m.trigger.toLowerCase().startsWith(input.toLowerCase())
  );

  useEffect(() => {
    setShowMacros(input.startsWith('/') && filteredMacros.length > 0);
  }, [input, filteredMacros.length]);

  const handleMacroSelect = (macroPrompt: string) => {
    setInput(macroPrompt);
    setShowMacros(false);
  };

  /**
   * Handles sending a new message from the user.
   * Manages chat creation, message appending, streaming responses,
   * and updating the ChatContext.
   */
  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    
    let activeChatId = currentChatId;
    if (!activeChatId) {
      try {
        activeChatId = await createNewChat();
      } catch (e) {
        console.error("Failed to create chat", e);
        return;
      }
    }

    const newMessages: Message[] = [...messages, { role: 'user', content: input, model: 'user' }];
    setMessages(newMessages);
    setInput('');
    setIsProcessing(true);
    
    // Save user message immediately
    updateChat(activeChatId, newMessages).catch(console.error);
    
    let targetModel = selectedModel;
    if (targetModel === 'auto') {
      targetModel = 'orchestrator';
    }

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '', model: targetModel }]);

    const onChunk = (chunk: string) => {
      setMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        updated[lastIndex] = {
          ...updated[lastIndex],
          content: updated[lastIndex].content + chunk
        };
        return updated;
      });
    };

    const startTime = Date.now();
    const requestId = `req_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
    const auditSteps: AuditTrailStep[] = [];

    const activeProfile = settings.profiles.find(p => p.id === settings.activeProfileId) || settings.profiles[0];
    const systemPrompt = activeProfile?.systemPrompt;

    try {
      // 4-Level Memory System Integration
      const memoryResult = await memorySystem.query(
        input,
        async (prompt, onChunkCb) => {
          // L4 Compute Execution
          if (targetModel === 'orchestrator') {
            // 1. Try MicroRouter (Local Embedding / BitNet b1 tier)
            const microRouteStart = Date.now();
            const microRoute = await microRouter.route(prompt);
            
            auditSteps.push({
              component: 'MicroRouter (BitNet Tier)',
              action: 'Classificazione Intento',
              durationMs: Date.now() - microRouteStart,
              details: `Intento: ${microRoute.intent || 'Sconosciuto'} (Confidenza: ${(microRoute.confidence * 100).toFixed(1)}%)`,
              status: microRoute.shouldRouteLocal ? 'success' : 'info'
            });
            
            // Check if it's a deep reasoning task (Tier 2)
            const isDeepReasoning = prompt.toLowerCase().includes('pensa') || 
                                    prompt.toLowerCase().includes('ragiona') || 
                                    prompt.toLowerCase().includes('analizza') ||
                                    prompt.toLowerCase().includes('codice');
            
            const localModelToUse = isDeepReasoning ? 'qwen3-4b-thinking-2507-gguf' : settings.fallbackModel;

            if ((microRoute.shouldRouteLocal || isDeepReasoning) && ollamaReachable) {
              const routeReason = isDeepReasoning ? "Deep Reasoning richiesto" : `Intento "${microRoute.intent}" rilevato`;
              if (onChunkCb) onChunkCb(`⚡ *Tier 2 (Local Thinker): ${routeReason}. Delegato al modello locale (${localModelToUse})...*\n\n`);
              
              const ollamaStart = Date.now();
              try {
                const res = await fetch(`${settings.ollamaUrl}/api/generate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ model: localModelToUse, prompt: prompt, system: systemPrompt, stream: !!onChunkCb })
                });
                
                if (!res.ok) throw new Error(`Errore API Ollama: ${res.status}`);
                
                let fullText = "";
                if (onChunkCb) {
                  const reader = res.body?.getReader();
                  const decoder = new TextDecoder("utf-8");
                  if (reader) {
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      const chunk = decoder.decode(value, { stream: true });
                      const lines = chunk.split("\n").filter(line => line.trim() !== "");
                      for (const line of lines) {
                        try {
                          const parsed = JSON.parse(line);
                          if (parsed.response) {
                            fullText += parsed.response;
                            onChunkCb(parsed.response);
                          }
                        } catch (e) {}
                      }
                    }
                  }
                } else {
                  const data = await res.json();
                  fullText = data.response;
                }
                
                auditSteps.push({
                  component: 'Ollama (Local Thinker)',
                  action: 'Generazione Locale',
                  durationMs: Date.now() - ollamaStart,
                  details: `Modello: ${localModelToUse}`,
                  status: 'success'
                });
                
                return `⚡ *Tier 2 (Local Thinker): ${isDeepReasoning ? "Deep Reasoning richiesto" : `Intento "${microRoute.intent}" rilevato`}. Delegato al modello locale (${localModelToUse})...*\n\n` + fullText;
              } catch (e: any) {
                console.warn("[MicroRouter] Local fallback failed, escalating to Master:", e);
                if (onChunkCb) onChunkCb(`\n\n⚠️ *Errore locale, escalation al Master (Tier 3)...*\n\n`);
                
                auditSteps.push({
                  component: 'Ollama (Local Thinker)',
                  action: 'Generazione Locale (Fallita)',
                  durationMs: Date.now() - ollamaStart,
                  details: e.message,
                  status: 'error'
                });
                // Fallthrough to Master Orchestrator
              }
            }

            // 3. Master Orchestrator (Cloud - Tier 3)
            const masterStart = Date.now();
            const result = await SmarterRouter.orchestrate(prompt, systemPrompt);
            
            auditSteps.push({
              component: 'MasterOrchestrator (Tier 3)',
              action: 'Routing Decisionale',
              durationMs: Date.now() - masterStart,
              details: `Azione scelta: ${result.action}`,
              status: 'success'
            });

            if (result.action === 'LOCAL_DELEGATION') {
              if (onChunkCb) onChunkCb("⚡ *Master: Delegato al modello locale...*\n\n");
              
              const localStart = Date.now();
              const localResponse = await generateLocal(prompt);
              
              auditSteps.push({
                component: 'WebGPU/WASM',
                action: 'Generazione Locale',
                durationMs: Date.now() - localStart,
                status: localResponse ? 'success' : 'error'
              });

              if (onChunkCb && localResponse) onChunkCb(localResponse);
              return "⚡ *Master: Delegato al modello locale...*\n\n" + (localResponse || "Errore durante l'inferenza locale.");
            } else {
              if (onChunkCb) onChunkCb(result.message);
              return result.message;
            }
          } else if (targetModel.startsWith('transformers:')) {
            const response = await generateLocal(prompt);
            if (onChunkCb && response) onChunkCb(response);
            return response || "Errore durante l'inferenza locale.";
          } else if (targetModel.startsWith('master/')) {
            const masterType = targetModel.split('/')[1];
            switch (masterType) {
              case 'gemini-2.5-flash':
                return await generateWithGemini(prompt, onChunkCb, "gemini-2.5-flash", systemPrompt);
              case 'gemini':
                return await generateWithGemini(prompt, onChunkCb, "gemini-3.1-pro-preview", systemPrompt);
              case 'openai':
                return await generateWithOpenAI(prompt, settings.openAiApiKey, onChunkCb, systemPrompt);
              case 'anthropic':
                return await generateWithAnthropic(prompt, settings.anthropicApiKey, onChunkCb, systemPrompt);
              case 'groq':
                return await generateWithGroq(prompt, settings.groqApiKey, onChunkCb, systemPrompt);
              case 'deepseek':
                return await generateWithDeepSeek(prompt, settings.deepseekApiKey, onChunkCb, systemPrompt);
              default:
                return await generateWithGemini(prompt, onChunkCb, "gemini-3-flash-preview", systemPrompt);
            }
          } else if (targetModel === 'colab') {
            // Call Colab Endpoint
            const res = await fetch(settings.colabEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt })
            });
            if (!res.ok) throw new Error("Errore API Colab");
            const data = await res.json();
            const responseText = data.response || data.generated_text || "Risposta vuota da Colab";
            if (onChunkCb) onChunkCb(responseText);
            return responseText;
          } else if (targetModel.startsWith('ollama/')) {
            // Call Ollama Endpoint
            const ollamaModel = targetModel.split('/')[1];
            let res;
            try {
              res = await fetch(`${settings.ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  model: ollamaModel, 
                  prompt: prompt, 
                  system: systemPrompt,
                  stream: !!onChunkCb 
                })
              });
            } catch (e: any) {
              console.warn("Avviso: Ollama fetch error:", e.message || e);
              throw new Error("Impossibile connettersi a Ollama. Verifica che sia in esecuzione, che CORS sia abilitato (OLLAMA_ORIGINS=\"*\") e che non ci siano blocchi Mixed Content (HTTPS -> HTTP).");
            }
            
            if (!res.ok) throw new Error(`Errore API Ollama: ${res.status} ${res.statusText}`);
            
            if (onChunkCb) {
              const reader = res.body?.getReader();
              const decoder = new TextDecoder("utf-8");
              let fullText = "";
              if (reader) {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value, { stream: true });
                  const lines = chunk.split("\n").filter(line => line.trim() !== "");
                  for (const line of lines) {
                    try {
                      const parsed = JSON.parse(line);
                      if (parsed.response) {
                        fullText += parsed.response;
                        onChunkCb(parsed.response);
                      }
                    } catch (e) {
                      // ignore parse errors
                    }
                  }
                }
              }
              return fullText || "Risposta vuota da Ollama";
            } else {
              const data = await res.json();
              return data.response || "Risposta vuota da Ollama";
            }
          } else {
            // Simulate other local models
            await new Promise(resolve => setTimeout(resolve, 1000));
            const responseText = `[Simulazione ${targetModel}]: Risposta generata per "${prompt}"`;
            if (onChunkCb) onChunkCb(responseText);
            return responseText;
          }
        },
        settings.semanticCacheEnabled,
        settings.cacheSimilarityThreshold,
        onChunk
      );

      // Encode request using LLM-CL for demonstration if not from cache
      let llmClInfo = "";
      if (memoryResult.source === 'L4 (Compute)') {
        const encodedRequest = LLMCL.encodeRequest("arbitrate", {
          task: "reasoning",
          context: "full",
          query: input
        });
        llmClInfo = `\n\n---\n**LLM-CL Encoded Request:**\n\`\`\`llmcl\n${encodedRequest}\n\`\`\``;
      }

      // Parse and execute LLM-CL actions from response
      const { cleanText, actions } = LLMCL.parseActions(memoryResult.response);
      let actionLog = "";
      
      if (actions.length > 0) {
        actionLog = "\n\n---\n**Azioni Eseguite (LLM-CL):**\n";
        for (const action of actions) {
          if (action.type === 'create_file') {
            const filename = action.params.filename || 'untitled.md';
            const content = action.params.content || '';
            actionLog += `- 📄 Creazione file: \`${filename}\`\n`;
            // Qui potremmo chiamare ObsidianService.createFile(...)
          } else if (action.type === 'update_chart') {
            actionLog += `- 📊 Aggiornamento grafico: \`${action.params.chart_id}\`\n`;
          } else {
            actionLog += `- ⚡ Azione sconosciuta: \`${action.type}\`\n`;
          }
        }
      }

      // Update the last message with the final model name and LLM-CL info
      const finalAssistantMessage: Message = {
        role: 'assistant',
        content: cleanText + actionLog + llmClInfo,
        model: `${targetModel} via ${memoryResult.source}`
      };

      setMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        updated[lastIndex] = finalAssistantMessage;
        
        // Save to Firebase
        updateChat(activeChatId, updated).catch(console.error);
        
        return updated;
      });

      // Record metrics
      const latency = Date.now() - startTime;
      const isCacheHit = memoryResult.source !== 'L4 (Compute)';
      
      if (isCacheHit) {
        auditSteps.push({
          component: 'MemorySystem',
          action: 'Cache Hit',
          durationMs: latency,
          details: `Livello: ${memoryResult.source}`,
          status: 'success'
        });
      }

      metricsService.recordAuditTrail(requestId, auditSteps);
      metricsService.recordCache(isCacheHit);
      
      if (isCacheHit) {
        // Estimate token savings (rough estimate: 1 token per 4 chars of input + response)
        const savedTokens = Math.round((input.length + memoryResult.response.length) / 4);
        metricsService.recordTokens(savedTokens);
      } else {
        if (targetModel.startsWith('master/')) {
          metricsService.recordLatency(null, latency);
        } else {
          metricsService.recordLatency(latency, null);
        }
      }

    } catch (error: any) {
      auditSteps.push({
        component: 'InferenceEngine',
        action: 'Errore Generico',
        durationMs: Date.now() - startTime,
        details: error.message,
        status: 'error'
      });
      metricsService.recordAuditTrail(requestId, auditSteps);

      setMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        const errorMsg: Message = {
          role: 'assistant',
          content: `Errore di sistema: ${error instanceof Error ? error.message : String(error)}`,
          model: 'error'
        };
        updated[lastIndex] = errorMsg;
        
        // Save error to Firebase
        updateChat(activeChatId, updated).catch(console.error);
        
        return updated;
      });
    } finally {
      setIsProcessing(false);
    }
  };

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
                <option value="transformers:Xenova/Qwen1.5-0.5B-Chat">Qwen 0.5B</option>
                <option value="transformers:Xenova/TinyLlama-1.1B-Chat-v1.0">TinyLlama 1.1B</option>
              </optgroup>
              <optgroup label="Remote/Local APIs">
                <option value="colab">Colab Endpoint (ngrok)</option>
                <option value={`ollama/${settings.fallbackModel}`}>{settings.fallbackModel} (Ollama Locale)</option>
              </optgroup>
            </select>
          </div>
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
              <div className={`p-3 md:p-4 rounded-2xl text-sm md:text-base ${
                msg.role === 'user' 
                  ? 'bg-zinc-800 text-zinc-100 rounded-tr-sm whitespace-pre-wrap' 
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-sm markdown-body'
              }`}>
                {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
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
              disabled={!input.trim() || isProcessing}
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
