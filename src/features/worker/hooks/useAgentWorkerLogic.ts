import { useEffect, useState, useRef, useCallback } from 'react';
import { generateWithGemini } from '../../../services/geminiService';
import { authenticatedFetch } from '../../../utils/api';

export function useAgentWorkerLogic() {
  const [isWorking, setIsWorking] = useState(false);
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const isWorkingRef = useRef(false);

  const processJob = async (job: any) => {
    setCurrentTask(`Job: ${job.task_type}`);
    try {
      const payload = JSON.parse(job.payload || '{}');
      const prompt = payload.prompt || JSON.stringify(payload);
      const context = payload.context || '';
      
      const response = await generateWithGemini(
        `Esegui una ricerca approfondita e un'analisi dettagliata su questo argomento:\n\n${prompt}`,
        undefined, // onChunk
        'gemini-3.1-pro-preview', // modelName
        context + "\nSei un agente di ricerca autonomo. Il tuo compito è analizzare a fondo la richiesta, cercare informazioni rilevanti e produrre un report completo e strutturato.", // systemPrompt
        true // enableWebSearch
      );

      await authenticatedFetch(`/api/worker/jobs/${job.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          result: response,
          logs: 'Task completed successfully by frontend worker.'
        })
      });
    } catch (error: any) {
      console.error('[AgentWorker] Job failed:', error);
      await authenticatedFetch(`/api/worker/jobs/${job.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'FAILED',
          result: '',
          logs: `Error: ${error.message}`
        })
      });
    } finally {
      setCurrentTask(null);
    }
  };

  const processWorkflowStep = async (step: any, contextStr: string) => {
    setCurrentTask(`Workflow Step: ${step.name}`);
    try {
      const config = JSON.parse(step.model_config || '{}');
      const context = JSON.parse(contextStr || '{}');
      
      // Interpolate prompt
      const prompt = step.input_prompt_template.replace(/\{\{([^}]+)\}\}/g, (match: string, key: string) => {
        const trimmedKey = key.trim();
        return context[trimmedKey] !== undefined ? String(context[trimmedKey]) : match;
      });

      const response = await generateWithGemini(
        prompt,
        undefined, // onChunk
        config.model || 'gemini-3.1-flash-preview', // modelName
        config.systemPrompt // systemPrompt
      );

      // Update context
      context[step.name] = response;

      await authenticatedFetch(`/api/worker/workflow-steps/${step.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          result: response,
          context: JSON.stringify(context)
        })
      });
    } catch (error: any) {
      console.error('[AgentWorker] Workflow step failed:', error);
      await authenticatedFetch(`/api/worker/workflow-steps/${step.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'FAILED',
          result: '',
          context: ''
        })
      });
    } finally {
      setCurrentTask(null);
    }
  };

  const checkPendingTasks = useCallback(async () => {
    if (isWorkingRef.current) return;

    try {
      isWorkingRef.current = true;
      setIsWorking(true);
      
      // 1. Check for pending jobs
      const jobRes = await authenticatedFetch('/api/worker/jobs');
      const jobData = await jobRes.json();
      
      if (jobData.job) {
        await processJob(jobData.job);
        isWorkingRef.current = false;
        setIsWorking(false);
        // Check again immediately in case there are more tasks
        checkPendingTasks();
        return; 
      }

      // 2. Check for pending workflow steps
      const stepRes = await authenticatedFetch('/api/worker/workflow-steps');
      const stepData = await stepRes.json();
      
      if (stepData.step) {
        await processWorkflowStep(stepData.step, stepData.context);
        isWorkingRef.current = false;
        setIsWorking(false);
        // Check again immediately
        checkPendingTasks();
        return;
      }

    } catch (error) {
      console.error('[AgentWorker] Task check error:', error);
    } finally {
      isWorkingRef.current = false;
      setIsWorking(false);
    }
  }, []);

  useEffect(() => {
    // Initial check on mount
    checkPendingTasks();

    // Setup WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // console.log('[AgentWorker] WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PENDING_FRONTEND_TASK') {
            checkPendingTasks();
          }
        } catch (e) {
          console.error('[AgentWorker] WebSocket message error:', e);
        }
      };

      ws.onclose = () => {
        // console.log('[AgentWorker] WebSocket disconnected, reconnecting...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('[AgentWorker] WebSocket error:', error);
        ws?.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null; // Prevent reconnect loop on unmount
        ws.close();
      }
    };
  }, [checkPendingTasks]);

  return {
    isWorking,
    currentTask
  };
}
