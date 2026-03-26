import fs from 'fs';
import path from 'path';

export interface DocumentChunk {
  id: string;
  filePath: string;
  content: string;
  embedding?: number[];
}

export class VectorStore {
  private chunks: DocumentChunk[] = [];
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
    this.load();
  }

  // Calculate cosine similarity between two vectors
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

  public addChunks(newChunks: DocumentChunk[]) {
    this.chunks.push(...newChunks);
    this.save();
  }

  public clear() {
    this.chunks = [];
    this.save();
  }

  public search(queryEmbedding: number[], topK: number = 5): DocumentChunk[] {
    const scoredChunks = this.chunks
      .filter(c => c.embedding)
      .map(chunk => ({
        chunk,
        score: this.cosineSimilarity(queryEmbedding, chunk.embedding!)
      }));

    // Sort descending by score
    scoredChunks.sort((a, b) => b.score - a.score);
    
    // Return top K chunks
    return scoredChunks.slice(0, topK).map(sc => sc.chunk);
  }

  private save() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Omit embeddings from disk to save space, or keep them if we want to avoid re-embedding.
      // For a local RAG, keeping them is better so we don't recompute on restart.
      fs.writeFileSync(this.storagePath, JSON.stringify(this.chunks), 'utf-8');
    } catch (e) {
      console.error("[VectorStore] Failed to save", e);
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        this.chunks = JSON.parse(data);
        console.log(`[VectorStore] Loaded ${this.chunks.length} chunks from ${this.storagePath}`);
      }
    } catch (e) {
      console.error("[VectorStore] Failed to load", e);
    }
  }
  
  public getStats() {
    return { totalChunks: this.chunks.length };
  }
}
