import { useState, useCallback, useRef } from 'react';
import { SmarterRouter } from '../core/routing/SmarterRouter';
import { AgentOrchestrator } from '../core/orchestrator/AgentOrchestrator';
import { ObsidianMCP } from '../core/mcp/ObsidianMCP';
import { SystemMCPRegistry } from '../core/mcp/SystemMCPRegistry';
import { CompositeMCPRegistry } from '../core/mcp/CompositeMCPRegistry';
import { ExecutionStateFlag, TransactionMetadata } from '../core/abc/protocols';
import { PrivacyLevel } from '../core/routing/types';
import { BackendRegistry } from '../core/hal/BackendRegistry';
import { CloudAdapter } from '../core/hal/adapters/CloudAdapter';
import { WebGPUAdapter } from '../core/hal/adapters/WebGPUAdapter';
import { OllamaAdapter } from '../core/hal/adapters/OllamaAdapter';
import { WASMAdapter } from '../core/hal/adapters/WASMAdapter';
import { useSettingsStore } from '../store/settingsStore';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: TransactionMetadata;
  toolCalls?: Array<{ name: string; args: unknown; result?: unknown }>;
}

export function useAgentSession(vaultPath: string = '/vault') {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [currentState, setCurrentState] = useState<ExecutionStateFlag>(ExecutionStateFlag.IDLE);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const settings = useSettingsStore(state => state.settings);

  // Inizializzazione Lazy del Core Engine
  const engineRef = useRef<{ router: SmarterRouter; mcp: CompositeMCPRegistry; orchestrator: AgentOrchestrator } | null>(null);

  const initEngine = useCallback(() => {
    // Register backends with latest settings
    const registry = BackendRegistry.getInstance();
    registry.register(new CloudAdapter(settings.masterModel));
    
    // Determine if edge model is for WebLLM or Transformers.js
    if (settings.edgeModel.includes('onnx-community') || settings.edgeModel.includes('Xenova')) {
      registry.register(new WASMAdapter(settings.edgeModel));
    } else {
      registry.register(new WebGPUAdapter(settings.edgeModel));
    }
    
    registry.register(new OllamaAdapter(settings.ollamaUrl, settings.fallbackModel));

    if (!engineRef.current) {
      const router = new SmarterRouter();
      const obsidianMcp = new ObsidianMCP(vaultPath);
      const systemMcp = new SystemMCPRegistry();
      const mcp = new CompositeMCPRegistry([obsidianMcp, systemMcp]);
      const orchestrator = new AgentOrchestrator(router, mcp);
      
      // Override del metodo executeTask per intercettare gli eventi (Monkey Patching per la UI)
      // In un'architettura ad eventi pura, l'Orchestrator emetterebbe eventi (es. EventEmitter)
      const originalExecute = orchestrator.executeTask.bind(orchestrator);
      orchestrator.executeTask = async (prompt, options) => {
        setCurrentState(ExecutionStateFlag.ROUTING);
        try {
          const result = await originalExecute(prompt, options);
          setCurrentState(ExecutionStateFlag.COMPLETED);
          return result;
        } catch (e) {
          setCurrentState(ExecutionStateFlag.FAILED);
          throw e;
        }
      };

      engineRef.current = { router, mcp, orchestrator };
    }
    return engineRef.current;
  }, [vaultPath, settings.masterModel, settings.edgeModel, settings.ollamaUrl, settings.fallbackModel]);

  const sendMessage = useCallback(async (content: string, privacy: PrivacyLevel = PrivacyLevel.MINIMUM) => {
    const { orchestrator } = initEngine();
    setError(null);

    const userMsg: AgentMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setCurrentState(ExecutionStateFlag.ROUTING);

    try {
      // TODO: In un'implementazione reale con streaming, aggiorneremmo il messaggio progressivamente.
      // Qui attendiamo l'esecuzione completa del task (che può includere chiamate a tool).
      const startTime = Date.now();
      
      const responseText = await orchestrator.executeTask(content, {
        privacyLevel: privacy,
        maxToolIterations: 5
      });

      const assistantMsg: AgentMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        metadata: {
          startTime,
          endTime: Date.now(),
          securityFlags: []
        }
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: unknown) {
      console.error("Agent Error:", err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto durante l\'esecuzione del task.');
      setCurrentState(ExecutionStateFlag.FAILED);
    } finally {
      if (currentState !== ExecutionStateFlag.FAILED) {
        setCurrentState(ExecutionStateFlag.IDLE);
      }
      setCurrentTool(null);
    }
  }, [initEngine, currentState]);

  const clearSession = useCallback(() => {
    setMessages([]);
    setError(null);
    setCurrentState(ExecutionStateFlag.IDLE);
  }, []);

  return {
    messages,
    currentState,
    currentTool,
    error,
    sendMessage,
    clearSession
  };
}
