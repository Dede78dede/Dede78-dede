import { useState, useEffect, useRef, useCallback } from 'react';
import { CreateMLCEngine, MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';

export function useWebLLM(modelId: string | null) {
  const [engine, setEngine] = useState<MLCEngine | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<InitProgressReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentModelId = useRef<string | null>(null);

  const disposeModel = useCallback(async () => {
    if (engine) {
      try {
        await engine.unload();
      } catch (e) {
        console.error("Error unloading WebLLM model:", e);
      }
      setEngine(null);
    }
  }, [engine]);

  useEffect(() => {
    if (currentModelId.current !== modelId) {
      disposeModel();
      currentModelId.current = modelId;
    }
  }, [modelId, disposeModel]);

  useEffect(() => {
    return () => {
      if (engine) {
        engine.unload().catch(console.error);
      }
    };
  }, [engine]);

  const loadModel = useCallback(async () => {
    if (engine || !modelId) return;
    
    if (!(navigator as any).gpu) {
      setError("WebGPU non è supportato in questo browser. Impossibile caricare il modello WebLLM.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress(null);
    
    try {
      const initProgressCallback = (report: InitProgressReport) => {
        setProgress(report);
      };

      const newEngine = await CreateMLCEngine(modelId, {
        initProgressCallback,
      });
      
      setEngine(newEngine);
    } catch (err: unknown) {
      console.error(`Failed to load WebLLM model:`, err);
      setError(err instanceof Error ? err.message : "Failed to load WebLLM model");
    } finally {
      setIsLoading(false);
    }
  }, [engine, modelId]);

  const generate = useCallback(async (
    prompt: string, 
    onChunk?: (chunk: string) => void,
    systemPrompt?: string
  ) => {
    if (!engine) {
      throw new Error("WebLLM Engine is not loaded");
    }

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system' as const, content: systemPrompt });
    }
    messages.push({ role: 'user' as const, content: prompt });

    try {
      if (onChunk) {
        const chunks = await engine.chat.completions.create({
          messages,
          stream: true,
        });
        
        let fullText = "";
        for await (const chunk of chunks) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullText += content;
            onChunk(content);
          }
        }
        return fullText;
      } else {
        const response = await engine.chat.completions.create({
          messages,
        });
        return response.choices[0]?.message?.content || "";
      }
    } catch (err: unknown) {
      console.error("WebLLM generation error:", err);
      throw err;
    }
  }, [engine]);

  return {
    engine,
    isLoading,
    progress,
    error,
    loadModel,
    disposeModel,
    generate,
    isReady: !!engine
  };
}
