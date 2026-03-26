import { pipeline, env } from '@huggingface/transformers';

// Disable local models to force downloading from Hugging Face Hub
env.allowLocalModels = false;
// Use WASM backend for browser execution
env.backends.onnx.wasm.numThreads = 1;

/**
 * MicroRouter
 * 
 * A lightweight, local semantic router that intercepts user prompts.
 * It uses a small embedding model running entirely in the browser (via WebAssembly)
 * to classify the intent of the prompt.
 * 
 * If the prompt matches a known "simple" task (e.g., translation, summarization, greetings),
 * it routes the request directly to a local Small Language Model (SLM) via Ollama,
 * bypassing the expensive cloud Master Model (Gemini).
 */
export class MicroRouter {
  private static instance: MicroRouter;
  private extractor: any = null;
  private isInitializing: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  // Define the "simple" intents that should be routed locally
  private localIntents = [
    { label: 'greeting', examples: ['ciao', 'buongiorno', 'come stai', 'hello', 'hi there'] },
    { label: 'translation', examples: ['traduci questo testo in inglese', 'come si dice in francese', 'translate to spanish'] },
    { label: 'summarization', examples: ['riassumi questo articolo', 'fammi un sunto', 'summarize the following text', 'tldr'] },
    { label: 'simple_qa', examples: ['qual è la capitale della francia?', 'chi ha scritto i promessi sposi?', 'what is the speed of light?'] },
    { label: 'formatting', examples: ['formatta questo testo come una lista', 'correggi gli errori grammaticali', 'fix typos'] },
    { label: 'reasoning', examples: ['pensa passo dopo passo', 'ragiona', 'spiega il processo logico', 'analizza il problema', 'risolvi passo passo', 'think step by step', 'let\'s think step by step', 'scrivi codice complesso', 'dimostra matematicamente'] }
  ];

  // Pre-computed embeddings for the local intents
  private intentEmbeddings: { label: string; embedding: number[] }[] = [];

  private constructor() {}

  public static getInstance(): MicroRouter {
    if (!MicroRouter.instance) {
      MicroRouter.instance = new MicroRouter();
    }
    return MicroRouter.instance;
  }

  /**
   * Initializes the embedding model and pre-computes the intent vectors.
   * This is done asynchronously to avoid blocking the main thread.
   */
  public async initialize(): Promise<void> {
    if (this.extractor) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.isInitializing = true;
    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // console.log('[MicroRouter] Initializing local embedding model...');
        // Use a very small, fast embedding model suitable for browser execution
        this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          dtype: 'q8'
        });
        
        // console.log('[MicroRouter] Computing intent embeddings...');
        for (const intent of this.localIntents) {
          // Average the embeddings of all examples for a given intent to create a centroid
          const embeddings = await Promise.all(
            intent.examples.map(ex => this.getEmbedding(ex))
          );
          
          const centroid = this.averageEmbeddings(embeddings);
          this.intentEmbeddings.push({ label: intent.label, embedding: centroid });
        }
        
        // console.log('[MicroRouter] Initialization complete.');
        resolve();
      } catch (error) {
        console.error('[MicroRouter] Initialization failed:', error);
        reject(error);
      } finally {
        this.isInitializing = false;
      }
    });

    return this.initializationPromise;
  }

  /**
   * Generates an embedding vector for a given text.
   */
  private async getEmbedding(text: string): Promise<number[]> {
    if (!this.extractor) throw new Error('MicroRouter not initialized');
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  /**
   * Calculates the cosine similarity between two vectors.
   * Returns a value between -1 and 1 (1 being identical).
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Averages an array of embedding vectors to find their centroid.
   */
  private averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    const length = embeddings[0].length;
    const result = new Array(length).fill(0);
    
    for (const emb of embeddings) {
      for (let i = 0; i < length; i++) {
        result[i] += emb[i];
      }
    }
    
    for (let i = 0; i < length; i++) {
      result[i] /= embeddings.length;
    }
    
    // Normalize the centroid
    let norm = 0;
    for (let i = 0; i < length; i++) {
      norm += result[i] * result[i];
    }
    norm = Math.sqrt(norm);
    for (let i = 0; i < length; i++) {
      result[i] /= norm;
    }
    
    return result;
  }

  /**
   * Analyzes a prompt and decides whether it should be routed locally.
   * 
   * @param prompt The user's input text.
   * @param threshold The similarity threshold (0.0 to 1.0) to trigger local routing.
   * @returns An object containing the routing decision and confidence score.
   */
  public async route(prompt: string, threshold: number = 0.65): Promise<{ shouldRouteLocal: boolean; confidence: number; intent?: string; reasoningType: 'DIRECT' | 'COT' }> {
    if (!this.extractor) {
      console.warn('[MicroRouter] Not initialized, defaulting to cloud routing.');
      return { shouldRouteLocal: false, confidence: 0, reasoningType: 'DIRECT' };
    }

    try {
      const promptEmbedding = await this.getEmbedding(prompt);
      
      let bestMatch = { label: '', score: -1 };
      
      for (const intent of this.intentEmbeddings) {
        const score = this.cosineSimilarity(promptEmbedding, intent.embedding);
        if (score > bestMatch.score) {
          bestMatch = { label: intent.label, score };
        }
      }

      // console.log(`[MicroRouter] Best match: ${bestMatch.label} (Score: ${bestMatch.score.toFixed(3)})`);

      const isReasoning = bestMatch.label === 'reasoning' && bestMatch.score >= threshold;
      const reasoningType = isReasoning ? 'COT' : 'DIRECT';

      if (bestMatch.score >= threshold) {
        return { 
          shouldRouteLocal: bestMatch.label !== 'reasoning', // Route reasoning to specialized models (often not the smallest local ones)
          confidence: bestMatch.score, 
          intent: bestMatch.label,
          reasoningType
        };
      }

      return { shouldRouteLocal: false, confidence: bestMatch.score, reasoningType: 'DIRECT' };
    } catch (error) {
      console.error('[MicroRouter] Routing error:', error);
      return { shouldRouteLocal: false, confidence: 0, reasoningType: 'DIRECT' };
    }
  }
}

export const microRouter = MicroRouter.getInstance();
