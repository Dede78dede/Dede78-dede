import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { getSafeVaultPath } from '../utils/pathUtils';

export const obsidianRouter = Router();

obsidianRouter.post("/read", (req, res) => {
  const { vaultPath, filePath } = req.body;
  if (!vaultPath || !filePath) return res.status(400).json({ error: "Missing vaultPath or filePath" });
  
  try {
    const safeVaultPath = getSafeVaultPath(vaultPath);
    const fullPath = path.resolve(safeVaultPath, filePath);
    if (!fullPath.startsWith(safeVaultPath)) {
      return res.status(403).json({ error: "Access denied: Path traversal detected" });
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found" });
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

obsidianRouter.post("/write", (req, res) => {
  const { vaultPath, filePath, content } = req.body;
  if (!vaultPath || !filePath || content === undefined) return res.status(400).json({ error: "Missing parameters" });

  try {
    const safeVaultPath = getSafeVaultPath(vaultPath);
    const fullPath = path.resolve(safeVaultPath, filePath);
    if (!fullPath.startsWith(safeVaultPath)) {
      return res.status(403).json({ error: "Access denied: Path traversal detected" });
    }
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
    res.json({ success: true, message: "File written successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

obsidianRouter.post("/list", (req, res) => {
  const { vaultPath, directory = "" } = req.body;
  if (!vaultPath) return res.status(400).json({ error: "Missing vaultPath" });

  try {
    const safeVaultPath = getSafeVaultPath(vaultPath);
    const targetDir = path.resolve(safeVaultPath, directory);
    if (!targetDir.startsWith(safeVaultPath)) {
      return res.status(403).json({ error: "Access denied: Path traversal detected" });
    }
    if (!fs.existsSync(targetDir)) {
      return res.json({ files: [] });
    }
    const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.md'));
    res.json({ files });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
