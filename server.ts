import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import db from "./src/db/database"; // Initialize SQLite DB
import { jobScheduler } from "./src/services/JobScheduler";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Start the background job scheduler
  jobScheduler.start(5000); // Poll every 5 seconds

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "SmarterRouter API Gateway is running" });
  });

  // --- MASTER ORCHESTRATOR (MaAS) ---
  // The orchestrator logic has been moved to the frontend (SmarterRouter.ts)
  // to comply with the requirement of calling Gemini API only from the frontend.

  // --- OBSIDIAN MCP SERVER (L3) ---
  app.post("/api/obsidian/read", (req, res) => {
    const { vaultPath, filePath } = req.body;
    if (!vaultPath || !filePath) return res.status(400).json({ error: "Missing vaultPath or filePath" });
    
    try {
      const fullPath = path.resolve(vaultPath, filePath);
      if (!fullPath.startsWith(path.resolve(vaultPath))) {
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

  app.post("/api/obsidian/write", (req, res) => {
    const { vaultPath, filePath, content } = req.body;
    if (!vaultPath || !filePath || content === undefined) return res.status(400).json({ error: "Missing parameters" });

    try {
      const fullPath = path.resolve(vaultPath, filePath);
      if (!fullPath.startsWith(path.resolve(vaultPath))) {
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

  app.post("/api/obsidian/list", (req, res) => {
    const { vaultPath, directory = "" } = req.body;
    if (!vaultPath) return res.status(400).json({ error: "Missing vaultPath" });

    try {
      const targetDir = path.resolve(vaultPath, directory);
      if (!targetDir.startsWith(path.resolve(vaultPath))) {
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

  // --- SEMANTIC CACHE (L2) ---
  app.post("/api/cache/set", (req, res) => {
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

  app.get("/api/cache/all", (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM semantic_cache');
      const rows = stmt.all();
      res.json({ cache: rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- WORKFLOW API ---
  app.post("/api/workflows/create", (req, res) => {
    const { name, global_context, steps } = req.body;
    if (!name || !steps || !Array.isArray(steps)) {
      return res.status(400).json({ error: "Missing name or steps array" });
    }

    try {
      const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      db.transaction(() => {
        // Create workflow
        db.prepare('INSERT INTO workflows (id, name, status, global_context) VALUES (?, ?, ?, ?)')
          .run(workflowId, name, 'PENDING', JSON.stringify(global_context || {}));

        // Create steps
        const insertStep = db.prepare('INSERT INTO workflow_steps (id, workflow_id, step_order, name, model_config, input_prompt_template, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        
        steps.forEach((step: any, index: number) => {
          const stepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          insertStep.run(
            stepId,
            workflowId,
            index + 1,
            step.name,
            JSON.stringify(step.model_config),
            step.input_prompt_template,
            'PENDING'
          );
        });

        // Create a job to start the workflow
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        db.prepare('INSERT INTO jobs (id, task_type, status, progress, logs, payload) VALUES (?, ?, ?, ?, ?, ?)')
          .run(jobId, 'WORKFLOW', 'PENDING', 0, 'Workflow queued', JSON.stringify({ workflow_id: workflowId }));
      })();

      res.json({ success: true, workflowId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/workflows", (req, res) => {
    try {
      const workflows = db.prepare('SELECT * FROM workflows ORDER BY created_at DESC LIMIT 50').all();
      res.json({ workflows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/workflows/:id/steps", (req, res) => {
    try {
      const steps = db.prepare('SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order ASC').all(req.params.id);
      res.json({ steps });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- AGENT MANAGER & JOB QUEUE (L3) ---
  app.post("/api/jobs/create", (req, res) => {
    const { task_type, payload } = req.body;
    if (!task_type) return res.status(400).json({ error: "Missing task_type" });

    try {
      const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const stmt = db.prepare('INSERT INTO jobs (id, task_type, status, progress, logs, payload) VALUES (?, ?, ?, ?, ?, ?)');
      stmt.run(id, task_type, 'PENDING', 0, 'Job queued', JSON.stringify(payload || {}));
      res.json({ success: true, jobId: id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:id", (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
      const job = stmt.get(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      res.json({ job });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs", (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50');
      const jobs = stmt.all();
      res.json({ jobs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agents", (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM agents');
      const agents = stmt.all();
      res.json({ agents });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // MasterOrchestrator API Gateway (Step 1.2)
  app.post("/api/llm/generate", async (req, res) => {
    const { provider, prompt, apiKey, stream, systemPrompt } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: `${provider} API Key missing.` });
    }

    try {
      let url = "";
      let headers: any = {
        "Content-Type": "application/json",
      };
      let body: any = {
        messages: [],
        stream: !!stream
      };

      if (systemPrompt) {
        if (provider === "anthropic") {
          body.system = systemPrompt;
        } else {
          body.messages.push({ role: "system", content: systemPrompt });
        }
      }
      body.messages.push({ role: "user", content: prompt });

      if (provider === "openai") {
        url = "https://api.openai.com/v1/chat/completions";
        headers["Authorization"] = `Bearer ${apiKey}`;
        body.model = "gpt-4o";
      } else if (provider === "anthropic") {
        url = "https://api.anthropic.com/v1/messages";
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
        body.model = "claude-3-5-sonnet-20240620";
        body.max_tokens = 1024;
      } else if (provider === "groq") {
        url = "https://api.groq.com/openai/v1/chat/completions";
        headers["Authorization"] = `Bearer ${apiKey}`;
        body.model = "llama3-70b-8192";
      } else if (provider === "deepseek") {
        url = "https://api.deepseek.com/chat/completions";
        headers["Authorization"] = `Bearer ${apiKey}`;
        body.model = "deepseek-chat";
      } else {
        return res.status(400).json({ error: "Unknown provider" });
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.text();
        return res.status(response.status).json({ error: errorData });
      }

      // Proxy headers
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (response.body) {
        const reader = response.body.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              break;
            }
            res.write(value);
          }
        };
        pump().catch(err => {
          console.error("Stream error:", err);
          res.end();
        });
      } else {
        res.end();
      }

    } catch (error: any) {
      console.error("LLM Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    // console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
