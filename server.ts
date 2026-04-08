import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { WebSocketServer } from "ws";
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

import { JobStatus, WorkflowStatus, WorkflowStepStatus, ModelProvider } from './src/core/enums';
import { firestoreDb } from './src/db/firestore';
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
    console.log(`[Auth] Request to ${req.url}`);
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      try {
        const { getAuth } = await import('firebase-admin/auth');
        const decodedToken = await getAuth().verifyIdToken(idToken);
        (req as any).user = decodedToken;
        next();
      } catch (error: any) {
        console.error('[Auth] Error verifying token:', error);
        res.status(401).json({ error: 'Unauthorized: Invalid token', details: error.message });
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
          [ModelProvider.OPENAI]: 'OPENAI_API_KEY',
          [ModelProvider.ANTHROPIC]: 'ANTHROPIC_API_KEY',
          [ModelProvider.GROQ]: 'GROQ_API_KEY',
          [ModelProvider.DEEPSEEK]: 'DEEPSEEK_API_KEY'
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
  app.post("/api/workflows/create", async (req, res) => {
    const { name, global_context, steps } = req.body;
    if (!name || !steps || !Array.isArray(steps)) {
      return res.status(400).json({ error: "Missing name or steps array" });
    }

    try {
      const userId = (req as any).user?.uid || 'anonymous';
      const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const batch = firestoreDb.batch();
      
      const workflowRef = firestoreDb.collection('workflows').doc(workflowId);
      batch.set(workflowRef, {
        id: workflowId,
        userId,
        name,
        status: WorkflowStatus.PENDING,
        globalContext: JSON.stringify(global_context || {}),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      steps.forEach((step: any, index: number) => {
        const stepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const stepRef = workflowRef.collection('steps').doc(stepId);
        batch.set(stepRef, {
          id: stepId,
          workflowId,
          stepOrder: index + 1,
          name: step.name,
          modelConfig: JSON.stringify(step.model_config),
          inputPromptTemplate: step.input_prompt_template,
          status: WorkflowStepStatus.PENDING,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const jobRef = firestoreDb.collection('jobs').doc(jobId);
      batch.set(jobRef, {
        id: jobId,
        userId,
        taskType: 'WORKFLOW',
        status: JobStatus.PENDING,
        progress: 0,
        logs: 'Workflow queued',
        payload: JSON.stringify({ workflow_id: workflowId }),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      res.json({ success: true, workflowId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/workflows", async (req, res) => {
    try {
      const userId = (req as any).user?.uid;
      let query: admin.firestore.Query = firestoreDb.collection('workflows');
      if (userId) {
        query = query.where('userId', '==', userId);
      }
      const snapshot = await query.orderBy('createdAt', 'desc').limit(50).get();
      
      const workflows = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        const stepsSnapshot = await doc.ref.collection('steps').get();
        const total_steps = stepsSnapshot.size;
        const completed_steps = stepsSnapshot.docs.filter(s => s.data().status === WorkflowStepStatus.COMPLETED).length;
        return {
          ...data,
          created_at: data.createdAt?.toDate()?.toISOString(),
          updated_at: data.updatedAt?.toDate()?.toISOString(),
          global_context: data.globalContext,
          total_steps,
          completed_steps
        };
      }));
      
      res.json({ workflows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/workflows/:id/steps", async (req, res) => {
    try {
      const snapshot = await firestoreDb.collection('workflows').doc(req.params.id).collection('steps').orderBy('stepOrder', 'asc').get();
      const steps = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          created_at: data.createdAt?.toDate()?.toISOString(),
          updated_at: data.updatedAt?.toDate()?.toISOString(),
          workflow_id: data.workflowId,
          step_order: data.stepOrder,
          model_config: data.modelConfig,
          input_prompt_template: data.inputPromptTemplate,
          output_result: data.outputResult,
          retry_count: data.retryCount
        };
      });
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
        const userId = (req as any).user?.uid || 'anonymous';
        
        await firestoreDb.collection('jobs').doc(jobId).set({
          id: jobId,
          userId,
          taskType: 'CODE_FIX',
          status: JobStatus.PENDING,
          progress: 0,
          logs: 'Ticket creato automaticamente da A2A',
          payload: JSON.stringify({ issue: response.result }),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        (response as any).ticketCreated = jobId;
      }

      res.json({ a2aResponse: response });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- AGENT MANAGER & JOB QUEUE (L3) ---
  // --- FRONTEND WORKER API ---
  app.get("/api/worker/jobs", async (req, res) => {
    try {
      const snapshot = await firestoreDb.collection('jobs')
        .where('status', '==', JobStatus.PENDING_FRONTEND)
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        res.json({ job: { id: doc.id, ...doc.data() } });
      } else {
        res.json({ job: null });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/worker/jobs/:id/complete", async (req, res) => {
    const { id } = req.params;
    const { status, result, logs } = req.body;
    try {
      const docRef = firestoreDb.collection('jobs').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Job not found" });
      
      const currentLogs = doc.data()?.logs || '';
      await docRef.update({
        status,
        progress: status === JobStatus.COMPLETED ? 100 : 0,
        logs: currentLogs + `\n[Frontend Worker] ${logs}\nResult: ${result}`,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/worker/workflow-steps", async (req, res) => {
    try {
      const snapshot = await firestoreDb.collectionGroup('steps')
        .where('status', '==', WorkflowStepStatus.PENDING_FRONTEND)
        .orderBy('stepOrder', 'asc')
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const stepDoc = snapshot.docs[0];
        const stepData = stepDoc.data();
        const workflowDoc = await firestoreDb.collection('workflows').doc(stepData.workflowId).get();
        res.json({ 
          step: { id: stepDoc.id, ...stepData }, 
          context: workflowDoc.exists ? workflowDoc.data()?.globalContext : '{}' 
        });
      } else {
        res.json({ step: null });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/worker/workflow-steps/:id/complete", async (req, res) => {
    const { id } = req.params;
    const { status, result, context } = req.body;
    try {
      const stepSnapshot = await firestoreDb.collectionGroup('steps').where('id', '==', id).limit(1).get();
      if (stepSnapshot.empty) return res.status(404).json({ error: "Step not found" });
      
      const stepDoc = stepSnapshot.docs[0];
      const stepData = stepDoc.data();
      const workflowId = stepData.workflowId;

      await stepDoc.ref.update({
        status,
        outputResult: result,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      if (status === WorkflowStepStatus.COMPLETED && context) {
        await firestoreDb.collection('workflows').doc(workflowId).update({
          globalContext: context,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Resume the workflow job
        const jobsSnapshot = await firestoreDb.collection('jobs')
          .where('taskType', '==', 'WORKFLOW')
          .get();
        
        for (const jobDoc of jobsSnapshot.docs) {
          const payload = jobDoc.data().payload;
          if (payload && payload.includes(workflowId)) {
            await jobDoc.ref.update({
              status: JobStatus.PENDING,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      } else if (status === WorkflowStepStatus.FAILED) {
        await firestoreDb.collection('workflows').doc(workflowId).update({
          status: WorkflowStatus.FAILED,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Fail the workflow job
        const jobsSnapshot = await firestoreDb.collection('jobs')
          .where('taskType', '==', 'WORKFLOW')
          .get();
          
        for (const jobDoc of jobsSnapshot.docs) {
          const payload = jobDoc.data().payload;
          if (payload && payload.includes(workflowId)) {
            await jobDoc.ref.update({
              status: JobStatus.FAILED,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/jobs/create", async (req, res) => {
    const { task_type, payload } = req.body;
    if (!task_type) return res.status(400).json({ error: "Missing task_type" });

    try {
      const userId = (req as any).user?.uid || 'anonymous';
      const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await firestoreDb.collection('jobs').doc(id).set({
        id,
        userId,
        taskType: task_type,
        status: JobStatus.PENDING,
        progress: 0,
        logs: 'Job queued',
        payload: JSON.stringify(payload || {}),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      res.json({ success: true, jobId: id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const doc = await firestoreDb.collection('jobs').doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: "Job not found" });
      
      const data = doc.data() as any;
      const job = {
        ...data,
        task_type: data.taskType,
        created_at: data.createdAt?.toDate()?.toISOString(),
        updated_at: data.updatedAt?.toDate()?.toISOString()
      };
      res.json({ job });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/jobs", async (req, res) => {
    try {
      const userId = (req as any).user?.uid;
      let query: admin.firestore.Query = firestoreDb.collection('jobs');
      if (userId) {
        query = query.where('userId', '==', userId);
      }
      const snapshot = await query.orderBy('createdAt', 'desc').limit(50).get();
      
      const jobs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          task_type: data.taskType,
          created_at: data.createdAt?.toDate()?.toISOString(),
          updated_at: data.updatedAt?.toDate()?.toISOString()
        };
      });
      res.json({ jobs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agents", async (req, res) => {
    try {
      const userId = (req as any).user?.uid;
      let query: admin.firestore.Query = firestoreDb.collection('agents');
      if (userId) {
        query = query.where('userId', '==', userId);
      }
      const snapshot = await query.get();
      
      const agents = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          created_at: data.createdAt?.toDate()?.toISOString()
        };
      });
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
        if (provider === ModelProvider.ANTHROPIC) {
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
            if (provider === ModelProvider.OPENAI || provider === ModelProvider.ANTHROPIC) {
              content = [{ type: "text", text: msg.content }];
              for (const att of msg.attachments) {
                if (att.data && att.mimeType.startsWith('image/')) {
                  if (provider === ModelProvider.OPENAI) {
                    content.push({
                      type: "image_url",
                      image_url: { url: `data:${att.mimeType};base64,${att.data}` }
                    });
                  } else if (provider === ModelProvider.ANTHROPIC) {
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

      if (provider === ModelProvider.OPENAI) {
        url = "https://api.openai.com/v1/chat/completions";
        headers["Authorization"] = `Bearer ${apiKey}`;
        body.model = "gpt-4o";
      } else if (provider === ModelProvider.ANTHROPIC) {
        url = "https://api.anthropic.com/v1/messages";
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
        body.model = "claude-3-5-sonnet-20240620";
        body.max_tokens = 1024;
      } else if (provider === ModelProvider.GROQ) {
        url = "https://api.groq.com/openai/v1/chat/completions";
        headers["Authorization"] = `Bearer ${apiKey}`;
        body.model = "llama3-70b-8192";
      } else if (provider === ModelProvider.DEEPSEEK) {
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
