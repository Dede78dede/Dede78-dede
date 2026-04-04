import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { WebSocketServer } from "ws";
import db from "./src/db/database"; // Initialize SQLite DB
import { jobScheduler } from "./src/services/JobScheduler";
import { workflowEngine } from "./src/services/WorkflowEngine";
import { GoogleGenAI, Type } from "@google/genai";
import admin from 'firebase-admin';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

// getSafeVaultPath moved to src/server/utils/pathUtils.ts

import { JobStatus, WorkflowStatus, WorkflowStepStatus } from './src/types/enums';
import { ragRouter } from './src/server/routes/rag';
import { obsidianRouter } from './src/server/routes/obsidian';
import { cacheRouter } from './src/server/routes/cache';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Start the background job scheduler
  jobScheduler.start(5000); // Poll every 5 seconds

  // Middleware to parse JSON bodies
  app.use(express.json());

  // Global Error Handler Middleware
  const errorHandler = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Global Error]', err.stack);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  };

  app.post("/api/log", (req, res) => {
    fs.writeFileSync('browser_log.txt', JSON.stringify(req.body, null, 2));
    res.json({ status: "ok" });
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    // Health Check Professionale
    const healthStatus = {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        geminiApi: !!process.env.GEMINI_API_KEY,
        firebaseAdmin: admin.apps.length > 0
      }
    };

    const isHealthy = healthStatus.checks.geminiApi; // Se manca la chiave Gemini, l'app è "degraded"
    
    res.status(isHealthy ? 200 : 503).json(healthStatus);
  });

  // JWT Authentication Middleware
  const authenticateJWT = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      try {
        const { getAuth } = await import('firebase-admin/auth');
        const decodedToken = await getAuth().verifyIdToken(idToken);
        (req as any).user = decodedToken;
        next();
      } catch (error) {
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }
    } else {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
  };

  // Apply authentication to protected routes
  app.use('/v1', authenticateJWT);
  app.use('/api/rag', authenticateJWT);
  app.use('/api/obsidian', authenticateJWT);
  app.use('/api/cache', authenticateJWT);
  app.use('/api/workflows', authenticateJWT);
  app.use('/api/agents', authenticateJWT);
  app.use('/api/a2a', authenticateJWT);
  app.use('/api/llm', authenticateJWT);
  app.use('/api/jobs', authenticateJWT);
  app.use('/api/worker', authenticateJWT);

  // --- MASTER ORCHESTRATOR (MaAS) ---
  // The orchestrator logic has been moved to the frontend (SmarterRouter.ts)
  // to comply with the requirement of calling Gemini API only from the frontend.

  // --- OPENAI COMPATIBLE API (L1) ---
  app.post("/v1/chat/completions", async (req, res) => {
    try {
      const { messages, model, temperature, max_tokens } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: { message: "messages is required and must be an array" } });
      }

      // Extract the last user message
      const lastMessage = messages[messages.length - 1];
      const prompt = lastMessage.content;

      // Import PolicyEngine dynamically to avoid circular dependencies if any
      const { PolicyEngine } = await import("./src/services/PolicyEngine");
      
      // Determine policy based on headers or default
      const policy = {
        requireLocalPrivacy: req.headers['x-require-local'] === 'true',
        maxCostPer1kTokens: req.headers['x-max-cost'] ? parseFloat(req.headers['x-max-cost'] as string) : undefined
      };

      const selectedModel = PolicyEngine.evaluate(prompt, policy);
      
      // Execute the model
      let responseText = "";
      
      if (selectedModel.isLocal) {
        // Call Ollama locally
        const ollamaRes = await fetch("http://localhost:11434/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel.model,
            messages: messages,
            stream: false
          })
        });
        if (!ollamaRes.ok) throw new Error("Ollama failed");
        const data = await ollamaRes.json();
        responseText = data.message?.content || "";
      } else {
        // Call Cloud Provider
        const { StrategyFactory } = await import("./src/services/ModelStrategies");
        const strategy = StrategyFactory.getStrategy(selectedModel.provider);
        
        // Map provider to API Key env var
        const envKeyMap: Record<string, string> = {
          'openai': 'OPENAI_API_KEY',
          'anthropic': 'ANTHROPIC_API_KEY',
          'groq': 'GROQ_API_KEY',
          'deepseek': 'DEEPSEEK_API_KEY'
        };
        
        const apiKey = process.env[envKeyMap[selectedModel.provider]];
        if (!apiKey) throw new Error(`API Key missing for provider ${selectedModel.provider}`);

        responseText = await strategy.execute(prompt, {
          provider: selectedModel.provider as any,
          model: selectedModel.model,
          temperature: temperature,
          apiKey: apiKey
        }, {});
      }

      // Format response as OpenAI completion
      res.json({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: selectedModel.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: responseText
            },
            finish_reason: "stop"
          }
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      });
    } catch (error: any) {
      console.error("[OpenAI API Error]", error);
      res.status(500).json({ error: { message: error.message } });
    }
  });

  // --- LOCAL RAG SYSTEM (L2) ---
  app.use("/api/rag", ragRouter);

  // --- OBSIDIAN MCP SERVER (L3) ---
  app.use("/api/obsidian", obsidianRouter);

  // --- SEMANTIC CACHE (L2) ---
  app.use("/api/cache", cacheRouter);

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
          .run(workflowId, name, WorkflowStatus.PENDING, JSON.stringify(global_context || {}));

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
            WorkflowStepStatus.PENDING
          );
        });

        // Create a job to start the workflow
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        db.prepare('INSERT INTO jobs (id, task_type, status, progress, logs, payload) VALUES (?, ?, ?, ?, ?, ?)')
          .run(jobId, 'WORKFLOW', JobStatus.PENDING, 0, 'Workflow queued', JSON.stringify({ workflow_id: workflowId }));
      })();

      res.json({ success: true, workflowId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/workflows", (req, res) => {
    try {
      const workflows = db.prepare(`
        SELECT w.*, 
               (SELECT COUNT(*) FROM workflow_steps WHERE workflow_id = w.id) as total_steps,
               (SELECT COUNT(*) FROM workflow_steps WHERE workflow_id = w.id AND status = '${WorkflowStepStatus.COMPLETED}') as completed_steps
        FROM workflows w 
        ORDER BY w.created_at DESC 
        LIMIT 50
      `).all();
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

  // --- JULES & ANTIGRAVITY (INTELLIGENT AGENTS) ---
  app.post("/api/agents/jules/analyze", async (req, res) => {
    const { filePath, newContent, projectContext } = req.body;
    if (!filePath || !newContent) return res.status(400).json({ error: "Missing filePath or newContent" });

    try {
      const { JulesAgent } = await import('./src/services/JulesAgent');
      const jules = new JulesAgent();
      const impactReport = await jules.analyzeImpact(filePath, newContent, projectContext || "Contesto generico del progetto");
      res.json({ impactReport });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agents/antigravity/scan", async (req, res) => {
    const { payloadType, payloadContent } = req.body;
    if (!payloadType || !payloadContent) return res.status(400).json({ error: "Missing payloadType or payloadContent" });

    try {
      const { AntigravityAgent } = await import('./src/services/AntigravityAgent');
      const antigravity = new AntigravityAgent();
      const securityReport = await antigravity.scanPayload(payloadType, payloadContent);
      
      // Se il rischio è CRITICAL, potremmo bloccare la richiesta o generare un alert
      if (securityReport.riskLevel === "CRITICAL") {
        console.warn("[Antigravity] Rilevata minaccia CRITICA:", securityReport.findings);
        // In un sistema reale, qui scatterebbe un webhook verso PagerDuty o un blocco della PR
      }

      res.json({ securityReport });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- GOOGLE A2A PROTOCOL (FASE 4) ---
  app.post("/api/a2a/simulate", async (req, res) => {
    const { sourceAgent, targetAgent, taskType, payload, context } = req.body;
    if (!sourceAgent || !targetAgent || !taskType || !payload) {
      return res.status(400).json({ error: "Missing required A2A parameters" });
    }

    try {
      const { A2ABroker } = await import('./src/services/A2ABroker');
      
      const message = {
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sourceAgent,
        targetAgent,
        taskType,
        payload,
        context: context || "Nessun contesto aggiuntivo"
      };

      const response = await A2ABroker.delegateTask(message);
      
      // Se l'agente diagnostico suggerisce di aprire un ticket, lo creiamo automaticamente
      if (response.status === "SUCCESS" && response.suggestedActions?.includes("CREATE_TICKET")) {
        // Creazione di un Job per Jules/Antigravity
        const jobId = `job_ticket_${Date.now()}`;
        db.prepare('INSERT INTO jobs (id, task_type, status, progress, logs, payload) VALUES (?, ?, ?, ?, ?, ?)')
          .run(jobId, 'CODE_FIX', JobStatus.PENDING, 0, 'Ticket creato automaticamente da A2A', JSON.stringify({ issue: response.result }));
        
        (response as any).ticketCreated = jobId;
      }

      res.json({ a2aResponse: response });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- AGENT MANAGER & JOB QUEUE (L3) ---
  // --- FRONTEND WORKER API ---
  app.get("/api/worker/jobs", (req, res) => {
    try {
      const stmt = db.prepare(`SELECT * FROM jobs WHERE status = '${JobStatus.PENDING_FRONTEND}' ORDER BY created_at ASC LIMIT 1`);
      const job = stmt.get();
      res.json({ job: job || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/worker/jobs/:id/complete", (req, res) => {
    const { id } = req.params;
    const { status, result, logs } = req.body;
    try {
      const stmt = db.prepare("UPDATE jobs SET status = ?, progress = ?, logs = logs || ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
      stmt.run(status, status === JobStatus.COMPLETED ? 100 : 0, `\n[Frontend Worker] ${logs}\nResult: ${result}`, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/worker/workflow-steps", (req, res) => {
    try {
      const stmt = db.prepare(`SELECT * FROM workflow_steps WHERE status = '${WorkflowStepStatus.PENDING_FRONTEND}' ORDER BY step_order ASC LIMIT 1`);
      const step = stmt.get();
      if (step) {
        const workflow = db.prepare("SELECT global_context FROM workflows WHERE id = ?").get((step as any).workflow_id);
        res.json({ step, context: workflow ? (workflow as any).global_context : '{}' });
      } else {
        res.json({ step: null });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/worker/workflow-steps/:id/complete", (req, res) => {
    const { id } = req.params;
    const { status, result, context } = req.body;
    try {
      const step = db.prepare("SELECT workflow_id FROM workflow_steps WHERE id = ?").get(id) as any;
      if (!step) return res.status(404).json({ error: "Step not found" });

      db.prepare("UPDATE workflow_steps SET status = ?, output_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, result, id);
      
      if (status === WorkflowStepStatus.COMPLETED && context) {
        db.prepare("UPDATE workflows SET global_context = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(context, step.workflow_id);
        // Resume the workflow job
        db.prepare(`UPDATE jobs SET status = '${JobStatus.PENDING}', updated_at = CURRENT_TIMESTAMP WHERE task_type = 'WORKFLOW' AND payload LIKE ?`).run(`%${step.workflow_id}%`);
      } else if (status === WorkflowStepStatus.FAILED) {
        db.prepare(`UPDATE workflows SET status = '${WorkflowStatus.FAILED}', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(step.workflow_id);
        // Fail the workflow job
        db.prepare(`UPDATE jobs SET status = '${JobStatus.FAILED}', updated_at = CURRENT_TIMESTAMP WHERE task_type = 'WORKFLOW' AND payload LIKE ?`).run(`%${step.workflow_id}%`);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/jobs/create", (req, res) => {
    const { task_type, payload } = req.body;
    if (!task_type) return res.status(400).json({ error: "Missing task_type" });

    try {
      const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const stmt = db.prepare('INSERT INTO jobs (id, task_type, status, progress, logs, payload) VALUES (?, ?, ?, ?, ?, ?)');
      
      stmt.run(id, task_type, JobStatus.PENDING, 0, 'Job queued', JSON.stringify(payload || {}));
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

      if (Array.isArray(prompt)) {
        // Context Circulation: Handle Message[]
        for (const msg of prompt) {
          if (msg.role === 'system') continue; // Handled above
          
          let content: any = msg.content;
          
          // Handle attachments if present
          if (msg.attachments && msg.attachments.length > 0) {
            if (provider === "openai" || provider === "anthropic") {
              content = [{ type: "text", text: msg.content }];
              for (const att of msg.attachments) {
                if (att.data && att.mimeType.startsWith('image/')) {
                  if (provider === "openai") {
                    content.push({
                      type: "image_url",
                      image_url: { url: `data:${att.mimeType};base64,${att.data}` }
                    });
                  } else if (provider === "anthropic") {
                    content.push({
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: att.mimeType,
                        data: att.data
                      }
                    });
                  }
                }
              }
            } else {
              // Groq/DeepSeek might not support images, fallback to text
              content = msg.content + "\n[Allegato ignorato: modello non supporta immagini]";
            }
          }
          
          body.messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content });
        }
      } else {
        body.messages.push({ role: "user", content: prompt });
      }

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

  // Global Error Handler
  app.use(errorHandler);

  // Vite middleware for development
  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : {
          port: 24678
        }
      },
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

  const server = app.listen(PORT, "0.0.0.0", () => {
    // console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Exiting...`);
      process.exit(1);
    } else {
      console.error('Server error:', e);
    }
  });

  const wss = new WebSocketServer({ server, path: '/api/ws' });
  
  wss.on('error', (e: any) => {
    console.error('WebSocketServer error:', e);
  });

  // Attach wss to app so routes can broadcast
  app.set('wss', wss);

  const broadcastPending = () => {
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify({ type: 'PENDING_FRONTEND_TASK' }));
      }
    });
  };

  jobScheduler.on('pending_frontend', broadcastPending);
  workflowEngine.on('pending_frontend', broadcastPending);

  wss.on('connection', (ws) => {
    // console.log('Client connected to WebSocket');
    ws.on('error', console.error);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down gracefully...');
    jobScheduler.stop();
    try {
      wss.close();
      server.close();
    } catch (e) {}
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
