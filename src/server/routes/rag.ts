import { Router } from 'express';
import path from 'path';
import { getSafeVaultPath } from '../utils/pathUtils';

export const ragRouter = Router();
let documentIndexer: any = null;

ragRouter.post("/index", async (req, res) => {
  const { vaultPath } = req.body;
  if (!vaultPath) return res.status(400).json({ error: "Missing vaultPath" });

  try {
    const safeVaultPath = getSafeVaultPath(vaultPath);
    if (!documentIndexer || documentIndexer.vaultPath !== safeVaultPath) {
      const { DocumentIndexer } = await import('../../services/RAG/DocumentIndexer');
      const vectorStorePath = path.join(process.cwd(), '.rag_cache', 'vectors.json');
      documentIndexer = new DocumentIndexer(safeVaultPath, vectorStorePath);
    }

    if (documentIndexer.isIndexing) {
      return res.status(409).json({ error: "Indexing already in progress" });
    }

    // Start indexing asynchronously
    documentIndexer.indexVault().catch(console.error);
    res.json({ message: "Indexing started" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

ragRouter.post("/query", async (req, res) => {
  const { vaultPath, query, topK } = req.body;
  if (!vaultPath || !query) return res.status(400).json({ error: "Missing vaultPath or query" });

  try {
    const safeVaultPath = getSafeVaultPath(vaultPath);
    if (!documentIndexer || documentIndexer.vaultPath !== safeVaultPath) {
      const { DocumentIndexer } = await import('../../services/RAG/DocumentIndexer');
      const vectorStorePath = path.join(process.cwd(), '.rag_cache', 'vectors.json');
      documentIndexer = new DocumentIndexer(safeVaultPath, vectorStorePath);
    }

    const results = await documentIndexer.query(query, topK || 3);
    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

ragRouter.get("/status", async (req, res) => {
  if (!documentIndexer) {
    return res.json({ isIndexing: false, totalChunks: 0 });
  }
  res.json(documentIndexer.getStats());
});
