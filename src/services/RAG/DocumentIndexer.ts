import fs from 'fs';
import path from 'path';
import { pipeline, FeatureExtractionPipeline } from '@huggingface/transformers';
import { VectorStore, DocumentChunk } from './VectorStore';

export class DocumentIndexer {
  public vaultPath: string;
  private vectorStore: VectorStore;
  private extractor: FeatureExtractionPipeline | null = null;
  public isIndexing: boolean = false;

  constructor(vaultPath: string, vectorStorePath: string) {
    this.vaultPath = vaultPath;
    this.vectorStore = new VectorStore(vectorStorePath);
  }

  private async initExtractor() {
    if (!this.extractor) {
      // Using a fast model for embeddings
      this.extractor = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')) as any;
    }
  }

  private getMarkdownFiles(dir: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        // Skip hidden directories like .obsidian or .git
        if (!file.startsWith('.')) {
          this.getMarkdownFiles(filePath, fileList);
        }
      } else if (filePath.endsWith('.md')) {
        fileList.push(filePath);
      }
    }
    return fileList;
  }

  private chunkText(text: string, maxTokens: number = 300): string[] {
    // Simple chunking by paragraphs for now
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const p of paragraphs) {
      if (currentChunk.length + p.length > maxTokens * 4) { // rough char to token approx
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = p;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + p;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }

  public async indexVault() {
    if (this.isIndexing) throw new Error("Indexing already in progress");
    this.isIndexing = true;

    try {
      await this.initExtractor();
      this.vectorStore.clear();

      const files = this.getMarkdownFiles(this.vaultPath);
      console.log(`[DocumentIndexer] Found ${files.length} markdown files to index.`);

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const chunks = this.chunkText(content);

        const documentChunks: DocumentChunk[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunkContent = chunks[i];
          if (!chunkContent) continue;

          // Generate embedding
          const output = await this.extractor!(chunkContent, { pooling: 'mean', normalize: true });
          const embedding = Array.from(output.data as Float32Array);

          documentChunks.push({
            id: `${file}_${i}`,
            filePath: file,
            content: chunkContent,
            embedding
          });
        }
        
        if (documentChunks.length > 0) {
          this.vectorStore.addChunks(documentChunks);
        }
      }
      console.log(`[DocumentIndexer] Indexing complete. Total chunks: ${this.vectorStore.getStats().totalChunks}`);
    } finally {
      this.isIndexing = false;
    }
  }

  public async query(text: string, topK: number = 3): Promise<DocumentChunk[]> {
    await this.initExtractor();
    const output = await this.extractor!(text, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(output.data as Float32Array);
    return this.vectorStore.search(queryEmbedding, topK);
  }
  
  public getStats() {
    return {
      isIndexing: this.isIndexing,
      ...this.vectorStore.getStats()
    };
  }
}
