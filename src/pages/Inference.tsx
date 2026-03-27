import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Zap, Settings2, Loader2, Database, Cloud, MessageSquare, Plus, Trash2, AlertTriangle, Command, ShieldCheck, AlertCircle, Paperclip, X, Globe, Code2 } from 'lucide-react';
import { ChatMessageContent } from '../components/ChatMessageContent';
import ReactMarkdown from 'react-markdown';
import { useLocalModel } from '../hooks/useLocalModel';
import { useWebLLM } from '../hooks/useWebLLM';
import { LLMCL } from '../utils/llm-cl';
import { metricsService, AuditTrailStep } from '../services/MetricsService';
import { memorySystem } from '../services/MemorySystem';
import { generateWithGemini } from '../services/geminiService';
import { generateWithOpenAI, generateWithAnthropic, generateWithGroq, generateWithDeepSeek } from '../services/cloudLlmService';
import { useSettings } from '../context/SettingsContext';
import { useChat, Message, MessageAttachment } from '../context/ChatContext';
import { SmarterRouter } from '../services/SmarterRouter';
import { microRouter } from '../services/MicroRouter';
import { preflightResults } from '../preflight';
import { authenticatedFetch } from '../utils/api';

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
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ollamaReachable, setOllamaReachable] = useState(preflightResults.isOllamaReachable);
  const [showMacros, setShowMacros] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Hook for WebLLM (Native GGUF)
  const webLlmModelId = selectedModel.startsWith('webllm:') ? selectedModel.replace('webllm:', '') : null;
  const { generate: generateWebLlm, isReady: isWebLlmReady, isLoading: isWebLlmLoading, progress: webLlmProgress, loadModel: loadWebLlmModel, error: webLlmError } = useWebLLM(webLlmModelId);

  // Auto-load WebLLM model when selected
  useEffect(() => {
    if (webLlmModelId && !isWebLlmReady && !isWebLlmLoading) {
      loadWebLlmModel();
    }
  }, [webLlmModelId, isWebLlmReady, isWebLlmLoading, loadWebLlmModel]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      // Check size (e.g., limit to 100MB as per Gemini update)
      if (file.size > 100 * 1024 * 1024) {
        alert(`Il file ${file.name} supera il limite di 100MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = (event.target?.result as string).split(',')[1];
        setAttachments(prev => [...prev, {
          mimeType: file.type || 'application/octet-stream',
          data: base64String,
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Handles sending a new message from the user.
   * Manages chat creation, message appending, streaming responses,
   * and updating the ChatContext.
   */
  const handleVerify = async (messageIndex: number) => {
    if (isProcessing) return;
    
    const messageToVerify = messages[messageIndex];
    if (!messageToVerify || messageToVerify.role !== 'assistant') return;

    setIsProcessing(true);
    const auditSteps: AuditTrailStep[] = [];
    const startTime = Date.now();
    const requestId = `req_${Date.now()}`;

    // Extract content without routing badges and <think> tags
    let contentToVerify = messageToVerify.content.replace(/(?:^|\n\n)(⚡|🧠|⚠️)\s*\*([^*]+)\*(?:\n\n|$)/g, '').trim();
    contentToVerify = contentToVerify.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();

    const verificationPrompt = `Sei un Verifier Agent esperto. Il tuo compito è applicare la Chain of Verification (CoVe) per verificare la seguente risposta e mitigare eventuali allucinazioni.

Risposta da verificare:
"""
${contentToVerify}
"""

Esegui i seguenti passaggi:
1. Identifica le affermazioni chiave nella risposta.
2. Formula domande di verifica per ciascuna affermazione.
3. Rispondi alle domande di verifica in modo indipendente.
4. Genera una valutazione finale: la risposta originale è corretta, parzialmente corretta o errata? Fornisci le correzioni necessarie.

Mostra il tuo ragionamento tra i tag <think> e </think>.`;

    try {
      setMessages(prev => {
        const updated: Message[] = [...prev, { role: 'user', content: "Verifica questa risposta applicando la Chain of Verification (CoVe).", model: 'user' }];
        if (currentChatId) updateChat(currentChatId, updated).catch(console.error);
        return updated;
      });
      
      const response = await generateWithGemini(verificationPrompt, undefined, "gemini-3.1-pro-preview");
      
      auditSteps.push({
        component: 'VerifierAgent (CoVe)',
        action: 'Verifica Risposta',
        durationMs: Date.now() - startTime,
        status: 'success'
      });
      metricsService.recordAuditTrail(requestId, auditSteps);

      setMessages(prev => {
        const updated: Message[] = [...prev, { role: 'assistant', content: `🛡️ *Verifier Agent: Analisi completata*\n\n${response}`, model: 'master/gemini-verifier' }];
        if (currentChatId) updateChat(currentChatId, updated).catch(console.error);
        return updated;
      });
    } catch (error: any) {
      console.error("Verification error:", error);
      setMessages(prev => {
        const updated: Message[] = [...prev, { role: 'assistant', content: `Errore durante la verifica: ${error.message}`, model: 'error' }];
        if (currentChatId) updateChat(currentChatId, updated).catch(console.error);
        return updated;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isProcessing) return;
    
    let activeChatId = currentChatId;
    if (!activeChatId) {
      try {
        activeChatId = await createNewChat();
      } catch (e) {
        console.error("Failed to create chat", e);
        return;
      }
    }

    const newMessages: Message[] = [...messages, { role: 'user', content: input, model: 'user', attachments: attachments.length > 0 ? [...attachments] : undefined }];
    setMessages(newMessages);
    setInput('');
    setAttachments([]);
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
    let systemPrompt = activeProfile?.systemPrompt || '';

    try {
      // Antigravity Shield Check
      if (settings.useAntigravityShield) {
        try {
          const shieldStart = Date.now();
          
          // Determine payload type dynamically
          let payloadType = 'API_REQUEST';
          if (input.includes('Exception') || input.includes('Error:') || input.includes('Traceback') || input.includes('at ')) {
            payloadType = 'SRE_LOGS';
          } else if (input.includes('function') || input.includes('const ') || input.includes('class ') || input.includes('import ')) {
            payloadType = 'CODE_PR';
          } else if (input.includes('resource "') || input.includes('apiVersion:')) {
            payloadType = 'IAC_AUDIT';
          }

          const res = await authenticatedFetch('/api/agents/antigravity/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payloadType, content: input })
          });
          if (res.ok) {
            const data = await res.json();
            auditSteps.push({
              component: 'Antigravity Shield',
              action: 'Scansione Sicurezza',
              durationMs: Date.now() - shieldStart,
              details: `Rischio: ${data.riskLevel}`,
              status: data.riskLevel === 'CRITICAL' || data.riskLevel === 'HIGH' ? 'error' : 'success'
            });
            if (data.riskLevel === 'CRITICAL' || data.riskLevel === 'HIGH') {
              const blockMessage = `🛡️ **Antigravity Shield: Richiesta Bloccata**\n\nLivello di rischio: **${data.riskLevel}**\n\n${data.findings.map((f: any) => `- ${f}`).join('\n')}\n\n*Disattiva lo scudo nelle impostazioni per procedere a tuo rischio.*`;
              setMessages(prev => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;
                updated[lastIndex] = {
                  ...updated[lastIndex],
                  content: blockMessage,
                  model: 'antigravity-shield'
                };
                updateChat(activeChatId as string, updated).catch(console.error);
                return updated;
              });
              metricsService.recordAuditTrail(requestId, auditSteps);
              setIsProcessing(false);
              return;
            }
          }
        } catch (e) {
          console.error("Antigravity Shield failed", e);
        }
      }

      // RAG Context Injection
      if (settings.useLocalRag && settings.obsidianVaultPath) {
        try {
          const ragStart = Date.now();
          const res = await authenticatedFetch('/api/rag/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vaultPath: settings.obsidianVaultPath, query: input, topK: 3 })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
              const contextText = data.results.map((r: any) => `[File: ${r.filePath}]\n${r.content}`).join('\n\n');
              systemPrompt += `\n\nContesto aggiuntivo dai documenti locali dell'utente:\n${contextText}\n\nUsa questo contesto per rispondere alla domanda se pertinente.`;
              
              auditSteps.push({
                component: 'Local RAG',
                action: 'Recupero Contesto',
                durationMs: Date.now() - ragStart,
                details: `Trovati ${data.results.length} frammenti rilevanti`,
                status: 'success'
              });
            }
          }
        } catch (e) {
          console.error("RAG Query failed", e);
        }
      }

      // 4-Level Memory System Integration
      const memoryResult = await memorySystem.query(
        newMessages,
        async (msgs, onChunkCb) => {
          const prompt = msgs[msgs.length - 1].content;
          
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
            const isDeepReasoning = microRoute.reasoningType === 'COT' || 
                                    prompt.toLowerCase().includes('pensa') || 
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
            const policy = {
              requireLocalPrivacy: settings.requireLocalPrivacy,
              maxCostPer1kTokens: settings.maxCostPer1kTokens
            };
            const result = await SmarterRouter.orchestrate(prompt, systemPrompt, policy);
            
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
            } else if (result.action === 'REASONING_TASK') {
              if (onChunkCb) onChunkCb(`🧠 *Master: ${result.message}*\n\n`);
              const masterStartReasoning = Date.now();
              
              let domainPrompt = "";
              switch (result.reasoningDomain) {
                case "MATH":
                  domainPrompt = "Sei un esperto matematico. Usa un ragionamento rigoroso, formale e passo-passo per risolvere il problema.";
                  break;
                case "LOGIC":
                  domainPrompt = "Sei un esperto di logica. Analizza le premesse, identifica eventuali fallacie e deduci la conclusione in modo strutturato.";
                  break;
                case "CODE":
                  domainPrompt = "Sei un ingegnere del software senior. Analizza il problema, progetta l'architettura, scrivi codice pulito e ottimizzato, e spiega le tue scelte.";
                  break;
                default:
                  domainPrompt = "Sei un assistente analitico. Ragiona in modo approfondito e strutturato.";
                  break;
              }
              
              const cotSystemPrompt = (systemPrompt ? systemPrompt + "\n\n" : "") + domainPrompt + "\nDevi mostrare il tuo processo di ragionamento racchiuso tra i tag <think> e </think> prima di fornire la risposta finale.";
              const response = await generateWithGemini(newMessages, onChunkCb, "gemini-3.1-pro-preview", cotSystemPrompt, useWebSearch);
              auditSteps.push({
                component: `MasterOrchestrator (CoT - ${result.reasoningDomain || 'GENERAL'})`,
                action: 'Generazione CoT',
                durationMs: Date.now() - masterStartReasoning,
                status: 'success'
              });
              return `🧠 *Master: ${result.message}*\n\n` + response;
            } else if (result.action === 'WEB_SEARCH') {
              if (onChunkCb) onChunkCb(`🌍 *Master: ${result.message}*\n\n`);
              const masterStartSearch = Date.now();
              const response = await generateWithGemini(newMessages, onChunkCb, "gemini-3.1-pro-preview", systemPrompt, true);
              auditSteps.push({
                component: `MasterOrchestrator (Web Search)`,
                action: 'Generazione con Grounding',
                durationMs: Date.now() - masterStartSearch,
                status: 'success'
              });
              return `🌍 *Master: ${result.message}*\n\n` + response;
            } else if (result.action === 'FULL_CYCLE_RESOLUTION') {
              if (onChunkCb) onChunkCb(`🤖 *Master: ${result.message}*\n\n`);
              const a2aStart = Date.now();
              
              try {
                const res = await authenticatedFetch('/api/a2a/simulate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    sourceAgent: 'Vertex_Main_Agent',
                    targetAgent: 'FULL_CYCLE_ORCHESTRATOR',
                    taskType: 'FULL_CYCLE_RESOLUTION',
                    context: result.jobDetails?.context || systemPrompt,
                    payload: result.jobDetails?.payload || { prompt }
                  })
                });
                
                if (!res.ok) throw new Error("Errore durante l'orchestrazione A2A");
                
                const data = await res.json();
                const a2aResult = data.a2aResponse;
                
                let responseText = `**Stato Risoluzione:** ${a2aResult.status}\n\n`;
                
                if (a2aResult.workflowTrace) {
                  responseText += `**Traccia Workflow:**\n`;
                  a2aResult.workflowTrace.forEach((step: any) => {
                    responseText += `- ${step.step}: ${step.status}\n`;
                  });
                  responseText += `\n`;
                }
                
                if (a2aResult.result && a2aResult.result.finalMessage) {
                   responseText += `**Risultato:**\n${a2aResult.result.finalMessage}\n\n`;
                   if (a2aResult.result.diagnosis) {
                     responseText += `**Diagnosi ADK:**\n${a2aResult.result.diagnosis}\n\n`;
                   }
                   if (a2aResult.result.appliedPatch) {
                     responseText += `**Patch Jules:**\n\`\`\`javascript\n${a2aResult.result.appliedPatch}\n\`\`\`\n\n`;
                   }
                } else {
                   responseText += `**Risultato:**\n${typeof a2aResult.result === 'string' ? a2aResult.result : JSON.stringify(a2aResult.result, null, 2)}\n\n`;
                }

                auditSteps.push({
                  component: 'A2A Orchestrator',
                  action: 'Full Cycle Resolution',
                  durationMs: Date.now() - a2aStart,
                  status: a2aResult.status === 'SUCCESS' || a2aResult.status === 'RESOLVED_AUTONOMOUSLY' ? 'success' : 'warning'
                });
                
                return `🤖 *Master: Orchestrazione A2A completata.*\n\n` + responseText;

              } catch (e: any) {
                 auditSteps.push({
                  component: 'A2A Orchestrator',
                  action: 'Full Cycle Resolution',
                  durationMs: Date.now() - a2aStart,
                  details: e.message,
                  status: 'error'
                });
                return `🤖 *Master: Errore durante l'orchestrazione A2A.*\n\n` + e.message;
              }
            } else if (result.action === 'AGENT_JOB') {
              if (onChunkCb) onChunkCb(`🤖 *Master: Avvio job asincrono per task complesso...*\n\n`);
              // Create a job via API
              const res = await authenticatedFetch('/api/jobs/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  task_type: result.jobDetails?.task_type || 'complex_research',
                  payload: result.jobDetails?.payload || { prompt, context: systemPrompt }
                })
              });
              const data = await res.json();
              let response = `Job creato con ID: ${data.jobId}. Puoi monitorarlo nella sezione Agent Jobs.\n\n`;
              // Fallback response while job runs
              response += await generateWithGemini(newMessages, onChunkCb, "gemini-3.1-flash-preview", systemPrompt, useWebSearch);
              return `🤖 *Master: ${result.message}*\n\n` + response;
            } else {
              if (onChunkCb) onChunkCb(result.message);
              return result.message;
            }
          } else if (targetModel.startsWith('transformers:')) {
            const response = await generateLocal(prompt);
            if (onChunkCb && response) onChunkCb(response);
            return response || "Errore durante l'inferenza locale.";
          } else if (targetModel.startsWith('webllm:')) {
            const webLlmStart = Date.now();
            if (!isWebLlmReady) {
              if (onChunkCb) onChunkCb("⏳ *Caricamento modello WebLLM in corso...*\n\n");
              await loadWebLlmModel();
            }
            const response = await generateWebLlm(prompt, onChunkCb, systemPrompt);
            auditSteps.push({
              component: 'WebLLM (Native GGUF)',
              action: 'Generazione Edge',
              durationMs: Date.now() - webLlmStart,
              status: 'success'
            });
            return response || "Errore durante l'inferenza WebLLM.";
          } else if (targetModel.startsWith('master/')) {
            const masterType = targetModel.split('/')[1];
            switch (masterType) {
              case 'gemini-2.5-flash':
                return await generateWithGemini(newMessages, onChunkCb, "gemini-2.5-flash", systemPrompt, useWebSearch);
              case 'gemini':
                return await generateWithGemini(newMessages, onChunkCb, "gemini-3.1-pro-preview", systemPrompt, useWebSearch);
              case 'openai':
                return await generateWithOpenAI(newMessages, settings.openAiApiKey, onChunkCb, systemPrompt);
              case 'anthropic':
                return await generateWithAnthropic(newMessages, settings.anthropicApiKey, onChunkCb, systemPrompt);
              case 'groq':
                return await generateWithGroq(newMessages, settings.groqApiKey, onChunkCb, systemPrompt);
              case 'deepseek':
                return await generateWithDeepSeek(newMessages, settings.deepseekApiKey, onChunkCb, systemPrompt);
              default:
                return await generateWithGemini(newMessages, onChunkCb, "gemini-3.1-flash-preview", systemPrompt, useWebSearch);
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
      let julesAnalysisLog = "";
      
      if (actions.length > 0) {
        actionLog = "\n\n---\n**Azioni Eseguite (LLM-CL):**\n";
        for (const action of actions) {
          if (action.type === 'create_file' || action.type === 'update_file') {
            const filename = action.params.filename || 'untitled.md';
            const content = action.params.content || '';
            actionLog += `- 📄 ${action.type === 'create_file' ? 'Creazione' : 'Aggiornamento'} file: \`${filename}\`\n`;
            
            // Jules Impact Analysis
            if (settings.useJulesImpactAnalysis) {
              try {
                const julesStart = Date.now();
                const res = await authenticatedFetch('/api/agents/jules/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    filePath: filename,
                    newContent: content,
                    projectContext: 'Analisi automatica da Inference UI'
                  })
                });
                
                if (res.ok) {
                  const data = await res.json();
                  const impact = data.impactReport;
                  if (impact) {
                    julesAnalysisLog += `\n\n---\n**🔍 Jules Impact Analysis (${filename}):**\n`;
                    julesAnalysisLog += `- **Livello di Impatto:** ${impact.impactLevel || 'Sconosciuto'}\n`;
                    if (impact.analysis) julesAnalysisLog += `- **Analisi:** ${impact.analysis}\n`;
                    
                    auditSteps.push({
                      component: 'Jules (Code Agent)',
                      action: 'Analisi Impatto Automatica',
                      durationMs: Date.now() - julesStart,
                      details: `File: ${filename}, Impatto: ${impact.impactLevel}`,
                      status: 'success'
                    });
                  }
                }
              } catch (e) {
                console.error("Jules Analysis failed", e);
              }
            }
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
        content: cleanText + actionLog + julesAnalysisLog + llmClInfo,
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
