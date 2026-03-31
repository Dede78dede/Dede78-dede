import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChat, Message, MessageAttachment } from '../../../context/ChatContext';
import { useSettings } from '../../../context/SettingsContext';
import { useLocalModel } from '../../../hooks/useLocalModel';
import { useWebLLM } from '../../../hooks/useWebLLM';
import { LLMCL } from '../../../utils/llm-cl';
import { metricsService, AuditTrailStep } from '../../../services/MetricsService';
import { memorySystem } from '../../../services/MemorySystem';
import { generateWithGemini } from '../../../services/geminiService';
import { generateWithOpenAI, generateWithAnthropic, generateWithGroq, generateWithDeepSeek } from '../../../services/cloudLlmService';
import { SmarterRouter } from '../../../services/SmarterRouter';
import { microRouter } from '../../../services/MicroRouter';
import { preflightResults } from '../../../preflight';
import { authenticatedFetch } from '../../../utils/api';

export function useInferenceLogic() {
  const { settings, updateSettings } = useSettings();
  const { chats, currentChatId, setCurrentChatId, createNewChat, updateChat, deleteChat, loading: chatsLoading } = useChat();
  const location = useLocation();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'SmarterRouter v1.0 pronto. Inserisci un prompt per testare i modelli locali o il Master Cloud.', model: 'system' }
  ]);
  const [input, setInput] = useState(location.state?.initialPrompt || '');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ollamaReachable, setOllamaReachable] = useState(preflightResults.isOllamaReachable);
  const [showMacros, setShowMacros] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (location.state?.initialPrompt) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
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

  useEffect(() => {
    if (isProcessing) return;
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const localModelId = selectedModel === 'auto' || selectedModel.startsWith('transformers:') 
    ? (selectedModel.startsWith('transformers:') ? selectedModel.replace('transformers:', '') : 'Xenova/Qwen1.5-0.5B-Chat')
    : null;

  const { generate: generateLocal, backend, isReady, isLoading: isModelLoading } = useLocalModel(localModelId);

  const webLlmModelId = selectedModel.startsWith('webllm:') ? selectedModel.replace('webllm:', '') : null;
  const { generate: generateWebLlm, isReady: isWebLlmReady, isLoading: isWebLlmLoading, progress: webLlmProgress, loadModel: loadWebLlmModel, error: webLlmError } = useWebLLM(webLlmModelId);

  useEffect(() => {
    if (webLlmModelId && !isWebLlmReady && !isWebLlmLoading) {
      loadWebLlmModel();
    }
  }, [webLlmModelId, isWebLlmReady, isWebLlmLoading, loadWebLlmModel]);

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
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleVerify = async (messageIndex: number) => {
    if (isProcessing) return;
    
    const messageToVerify = messages[messageIndex];
    if (!messageToVerify || messageToVerify.role !== 'assistant') return;

    setIsProcessing(true);
    const auditSteps: AuditTrailStep[] = [];
    const startTime = Date.now();
    const requestId = `req_${Date.now()}`;

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
    
    updateChat(activeChatId, newMessages).catch(console.error);
    
    let targetModel = selectedModel;
    if (targetModel === 'auto') {
      targetModel = 'orchestrator';
    }

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
      if (settings.useAntigravityShield) {
        try {
          const shieldStart = Date.now();
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

      const memoryResult = await memorySystem.query(
        newMessages,
        async (msgs, onChunkCb) => {
          const prompt = msgs[msgs.length - 1].content;
          
          if (targetModel === 'orchestrator') {
            const microRouteStart = Date.now();
            const microRoute = await microRouter.route(prompt);
            
            auditSteps.push({
              component: 'MicroRouter (BitNet Tier)',
              action: 'Classificazione Intento',
              durationMs: Date.now() - microRouteStart,
              details: `Intento: ${microRoute.intent || 'Sconosciuto'} (Confidenza: ${(microRoute.confidence * 100).toFixed(1)}%)`,
              status: microRoute.shouldRouteLocal ? 'success' : 'info'
            });
            
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
              }
            }

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
            } else if (result.action === 'STITCH_DESIGN') {
              if (onChunkCb) onChunkCb(`🎨 *Master: ${result.message}*\n\n`);
              const stitchStart = Date.now();
              
              auditSteps.push({
                component: 'MasterOrchestrator (Stitch)',
                action: 'Generazione UI',
                durationMs: Date.now() - stitchStart,
                status: 'success'
              });
              
              return `🎨 *Master: ${result.message}*\n\nHo identificato una richiesta di design UI. Per utilizzare Google Stitch, vai alla sezione "Stitch Design" nel menu laterale e inserisci il tuo prompt lì.`;
            } else if (result.action === 'AGENT_JOB') {
              if (onChunkCb) onChunkCb(`🤖 *Master: Avvio job asincrono per task complesso...*\n\n`);
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
                    } catch (e) {}
                  }
                }
              }
              return fullText || "Risposta vuota da Ollama";
            } else {
              const data = await res.json();
              return data.response || "Risposta vuota da Ollama";
            }
          } else {
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

      let llmClInfo = "";
      if (memoryResult.source === 'L4 (Compute)') {
        const encodedRequest = LLMCL.encodeRequest("arbitrate", {
          task: "reasoning",
          context: "full",
          query: input
        });
        llmClInfo = `\n\n---\n**LLM-CL Encoded Request:**\n\`\`\`llmcl\n${encodedRequest}\n\`\`\``;
      }

      const { cleanText, actions } = LLMCL.parseActions(memoryResult.response);
      let actionLog = "";
      let julesAnalysisLog = "";
      
      if (actions.length > 0) {
        actionLog = "\n\n---\n**Azioni Eseguite (LLM-CL):**\n";
        for (const action of actions) {
          if (action.type === 'create_file' || action.type === 'update_file') {
            const params = action.params as any;
            const filename = params.filename || 'untitled.md';
            const content = params.content || '';
            actionLog += `- 📄 ${action.type === 'create_file' ? 'Creazione' : 'Aggiornamento'} file: \`${filename}\`\n`;
            
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
            const params = action.params as any;
            actionLog += `- 📊 Aggiornamento grafico: \`${params.chart_id}\`\n`;
          } else {
            actionLog += `- ⚡ Azione sconosciuta: \`${action.type}\`\n`;
          }
        }
      }

      const finalAssistantMessage: Message = {
        role: 'assistant',
        content: cleanText + actionLog + julesAnalysisLog + llmClInfo,
        model: `${targetModel} via ${memoryResult.source}`
      };

      setMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        updated[lastIndex] = finalAssistantMessage;
        updateChat(activeChatId as string, updated).catch(console.error);
        return updated;
      });

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
        updateChat(activeChatId as string, updated).catch(console.error);
        return updated;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    settings,
    updateSettings,
    chats,
    currentChatId,
    setCurrentChatId,
    createNewChat,
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
  };
}
