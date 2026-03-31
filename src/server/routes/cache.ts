import { Router } from 'express';
import db from '../../db/database';

export const cacheRouter = Router();

cacheRouter.post("/set", (req, res) => {
  const { id, prompt, embedding, response } = req.body;
  if (!id || !prompt || !embedding || !response) return res.status(400).json({ error: "Missing parameters" });

  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO semantic_cache (id, prompt, embedding, response) VALUES (?, ?, ?, ?)');
    stmt.run(id, prompt, JSON.stringify(embedding), response);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

cacheRouter.get("/all", (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM semantic_cache');
    const rows = stmt.all();
    res.json({ cache: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
