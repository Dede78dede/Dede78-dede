import { useState, useEffect, useRef, useCallback } from 'react';
import { pipeline, env, TextGenerationPipeline } from '@huggingface/transformers';

// Skip local model check for browser environment
env.allowLocalModels = false;

/**
 * Custom hook to manage local Hugging Face Transformers.js models.
 * Handles loading, generation, and cleanup (VRAM management) of WebGPU/WASM models.
 * 
 * @param modelId The Hugging Face model ID to load (e.g., 'Xenova/Qwen1.5-0.5B-Chat').
 */
export function useLocalModel(modelId: string | null) {
  const [backend, setBackend] = useState<'webgpu' | 'wasm'>('wasm');
  const [generator, setGenerator] = useState<TextGenerationPipeline | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentModelId = useRef(modelId);

  useEffect(() => {
    const hasWebGPU = !!(navigator as unknown as { gpu: unknown }).gpu;
    setBackend(hasWebGPU ? 'webgpu' : 'wasm');
  }, []);

  /**
   * Disposes the current model to free up VRAM/RAM.
   */
  const disposeModel = useCallback(async () => {
    if (generator) {
      try {
        if (typeof generator.dispose === 'function') {
          await generator.dispose();
          // console.log(`[VRAM] Disposed model ${currentModelId.current}`);
        }
      } catch (e) {
        console.error("Error disposing model:", e);
      }
      setGenerator(null);
    }
  }, [generator]);

  useEffect(() => {
    if (currentModelId.current !== modelId) {
      disposeModel();
      currentModelId.current = modelId;
    }
  }, [modelId, disposeModel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (generator) {
        try {
          if (typeof generator.dispose === 'function') {
            generator.dispose().catch(console.error);
          }
        } catch (e) {
          console.error("Error disposing model on unmount:", e);
        }
      }
    };
  }, [generator]);

  /**
   * Loads the specified model into memory using the best available backend (WebGPU or WASM).
   */
  const loadModel = useCallback(async () => {
    if (generator || !modelId) return;
    setIsLoading(true);
    setError(null);
    try {
      const gen = await pipeline('text-generation', modelId, {
        device: backend as 'webgpu' | 'wasm',
      });
      setGenerator(() => gen as unknown as TextGenerationPipeline);
    } catch (err: unknown) {
      console.warn(`Failed to load model with ${backend}:`, err);
      
      // Fallback to wasm if webgpu fails
      if (backend === 'webgpu') {
        // console.log("Falling back to wasm backend...");
        setBackend('wasm');
        try {
          const genFallback = await pipeline('text-generation', modelId, {
            device: 'wasm',
          });
          setGenerator(() => genFallback as unknown as TextGenerationPipeline);
          setIsLoading(false);
          return;
        } catch (fallbackErr) {
          console.error("Failed to load model with wasm fallback:", fallbackErr);
          setError(fallbackErr instanceof Error ? fallbackErr.message : "Failed to load WebGPU/WASM model");
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to load WebGPU/WASM model");
      }
    } finally {
      setIsLoading(false);
    }
  }, [generator, modelId, backend]);

  /**
   * Generates text using the loaded local model.
   * If the model is not loaded, it attempts to load it first.
   * 
   * @param prompt The input prompt for the model.
   * @returns The generated text string, or null if generation fails.
   */
  const generate = useCallback(async (prompt: string) => {
    if (!modelId) return null;
    
    let currentGen = generator;
    if (!currentGen) {
      setIsLoading(true);
      setError(null);
      try {
        const gen = await pipeline('text-generation', modelId, {
          device: backend as 'webgpu' | 'wasm',
        });
        currentGen = gen as unknown as TextGenerationPipeline;
        setGenerator(() => currentGen);
      } catch (err) {
        console.error("Failed to load model during generate:", err);
        setIsLoading(false);
        return null;
      }
      setIsLoading(false);
    }
    
    if (!currentGen) return null;
    
    try {
      const result = await currentGen(prompt, { max_new_tokens: 100 }) as unknown as Array<{ generated_text: string }> | { generated_text: string };
      return Array.isArray(result) ? result[0].generated_text : result.generated_text;
    } catch (err) {
      console.error("Generation error:", err);
      return null;
    }
  }, [generator, modelId, backend]);

  return { generate, loadModel, disposeModel, backend, isReady: !!generator, isLoading, error };
}
