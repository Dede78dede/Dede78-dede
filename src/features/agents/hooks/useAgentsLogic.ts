import { useState } from 'react';
import { authenticatedFetch } from '../../../utils/api';

export function useAgentsLogic() {
  const [activeTab, setActiveTab] = useState<'antigravity' | 'a2a' | 'jules' | 'adk'>('antigravity');

  // Antigravity State
  const [payloadType, setPayloadType] = useState('AUTO');
  const [payloadContent, setPayloadContent] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  // A2A State
  const [targetAgent, setTargetAgent] = useState('FULL_CYCLE_ORCHESTRATOR');
  const [a2aContext, setA2aContext] = useState('Il cliente lamenta un crash dell app durante il login.');
  const [a2aPayload, setA2aPayload] = useState('{\n  "errorLog": "NullPointerException in auth.ts line 42",\n  "sourceCode": "function login(user) { return user.profile.name; }"\n}');
  const [a2aResult, setA2aResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Jules State
  const [julesCode, setJulesCode] = useState('function calculateTotal(items) {\n  let total = 0;\n  for(let i=0; i<items.length; i++) {\n    total += items[i].price;\n  }\n  return total;\n}');
  const [julesContext, setJulesContext] = useState('Questo codice è usato nel carrello e-commerce. items può essere null.');
  const [julesResult, setJulesResult] = useState<any>(null);
  const [isJulesAnalyzing, setIsJulesAnalyzing] = useState(false);

  // ADK & RAG State
  const [adkVaultPath, setAdkVaultPath] = useState('');
  const [adkQuery, setAdkQuery] = useState('Come risolvo l\'errore NullPointerException in auth.ts?');
  const [adkResult, setAdkResult] = useState<any>(null);
  const [isAdkDiagnosing, setIsAdkDiagnosing] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexStatus, setIndexStatus] = useState('');

  const handleScan = async () => {
    if (!payloadContent) return;
    setIsScanning(true);
    setScanResult(null);
    try {
      let currentPayloadType = payloadType;
      if (payloadType === 'AUTO') {
        if (payloadContent.includes('Exception') || payloadContent.includes('Error:') || payloadContent.includes('Traceback') || payloadContent.includes('at ')) {
          currentPayloadType = 'SRE_LOGS';
        } else if (payloadContent.includes('function') || payloadContent.includes('const ') || payloadContent.includes('class ') || payloadContent.includes('import ')) {
          currentPayloadType = 'CODE_PR';
        } else if (payloadContent.includes('resource "') || payloadContent.includes('apiVersion:')) {
          currentPayloadType = 'IAC_AUDIT';
        } else {
          currentPayloadType = 'API_REQUEST';
        }
      }

      const res = await authenticatedFetch('/api/agents/antigravity/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payloadType: currentPayloadType, payloadContent })
      });
      const data = await res.json();
      setScanResult(data.securityReport);
    } catch (e) {
      console.error(e);
      setScanResult({ error: 'Errore durante la scansione' });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSimulate = async () => {
    if (!a2aPayload) return;
    setIsSimulating(true);
    setA2aResult(null);
    try {
      let parsedPayload = a2aPayload;
      try {
        parsedPayload = JSON.parse(a2aPayload);
      } catch (e) {
        // If not JSON, send as string
      }

      const res = await authenticatedFetch('/api/a2a/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceAgent: 'Vertex_Main_Agent',
          targetAgent,
          taskType: targetAgent === 'FULL_CYCLE_ORCHESTRATOR' ? 'FULL_CYCLE_RESOLUTION' : 'DIAGNOSIS',
          context: a2aContext,
          payload: parsedPayload
        })
      });
      const data = await res.json();
      setA2aResult(data.a2aResponse);
    } catch (e) {
      console.error(e);
      setA2aResult({ error: 'Errore durante la simulazione' });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleJulesAnalyze = async () => {
    if (!julesCode) return;
    setIsJulesAnalyzing(true);
    setJulesResult(null);
    try {
      const res = await authenticatedFetch('/api/agents/jules/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: 'src/components/Cart.tsx', // Mock file path
          newContent: julesCode,
          projectContext: julesContext
        })
      });
      const data = await res.json();
      setJulesResult(data.impactReport);
    } catch (e) {
      console.error(e);
      setJulesResult({ error: 'Errore durante l\'analisi di Jules' });
    } finally {
      setIsJulesAnalyzing(false);
    }
  };

  const handleAdkIndex = async () => {
    if (!adkVaultPath) return;
    setIsIndexing(true);
    setIndexStatus('Avvio indicizzazione...');
    try {
      const res = await authenticatedFetch('/api/rag/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultPath: adkVaultPath })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setIndexStatus('Indicizzazione in corso... Controlla lo stato.');
      
      // Poll status
      const poll = setInterval(async () => {
        const statusRes = await authenticatedFetch('/api/rag/status');
        const statusData = await statusRes.json();
        if (!statusData.isIndexing) {
          clearInterval(poll);
          setIndexStatus(`Indicizzazione completata. ${statusData.totalChunks} chunk elaborati.`);
          setIsIndexing(false);
        } else {
          setIndexStatus(`Indicizzazione in corso... ${statusData.totalChunks} chunk elaborati finora.`);
        }
      }, 2000);
      
    } catch (e: any) {
      console.error(e);
      setIndexStatus(`Errore: ${e.message}`);
      setIsIndexing(false);
    }
  };

  const handleAdkDiagnose = async () => {
    if (!adkQuery) return;
    setIsAdkDiagnosing(true);
    setAdkResult(null);
    try {
      let context = '';
      if (adkVaultPath) {
        const ragRes = await authenticatedFetch('/api/rag/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vaultPath: adkVaultPath, query: adkQuery, topK: 3 })
        });
        const ragData = await ragRes.json();
        if (ragData.results && ragData.results.length > 0) {
          context = ragData.results.map((r: any) => `[File: ${r.filePath}]\n${r.content}`).join('\n\n');
        }
      }

      const prompt = `
Sei l'Agente Diagnostico (ADK). Devi analizzare il seguente problema tecnico.
Problema: ${adkQuery}

${context ? `Contesto aziendale recuperato (RAG):\n${context}` : 'Nessun contesto aziendale fornito.'}

Usa le tue conoscenze e il contesto fornito per diagnosticare il problema e fornire una soluzione chiara, passo-passo.
`;

      const { GoogleGenAI } = await import('@google/genai');
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key Gemini non configurata");
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: "Sei un agente tecnico di backend specializzato in diagnostica di sistema.",
          temperature: 0.2
        }
      });

      setAdkResult({
        diagnosis: response.text,
        ragContextUsed: !!context,
        ragChunks: context ? context.split('\n\n').length : 0
      });
    } catch (e: any) {
      console.error(e);
      setAdkResult({ error: `Errore durante la diagnosi: ${e.message}` });
    } finally {
      setIsAdkDiagnosing(false);
    }
  };

  return {
    activeTab,
    setActiveTab,
    
    // Antigravity
    payloadType,
    setPayloadType,
    payloadContent,
    setPayloadContent,
    scanResult,
    isScanning,
    handleScan,

    // A2A
    targetAgent,
    setTargetAgent,
    a2aContext,
    setA2aContext,
    a2aPayload,
    setA2aPayload,
    a2aResult,
    isSimulating,
    handleSimulate,

    // Jules
    julesCode,
    setJulesCode,
    julesContext,
    setJulesContext,
    julesResult,
    isJulesAnalyzing,
    handleJulesAnalyze,

    // ADK
    adkVaultPath,
    setAdkVaultPath,
    adkQuery,
    setAdkQuery,
    adkResult,
    isAdkDiagnosing,
    isIndexing,
    indexStatus,
    handleAdkIndex,
    handleAdkDiagnose
  };
}
