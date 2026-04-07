import React from 'react';
import { Bot, Shield, GitMerge, AlertTriangle, CheckCircle, Loader2, Code2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { useAgentsLogic } from '../features/agents/hooks/useAgentsLogic';

export const Agents = React.memo(function Agents() {
  const {
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
  } = useAgentsLogic();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
          <Bot className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Agenti AI & Orchestrazione</h1>
          <p className="text-zinc-400">Interagisci con Antigravity e il protocollo A2A (Agent-to-Agent)</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-zinc-800 pb-px">
        <button
          onClick={() => setActiveTab('antigravity')}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeTab === 'antigravity' ? "border-indigo-500 text-indigo-400" : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Shield className="w-4 h-4" />
          Antigravity (Security)
        </button>
        <button
          onClick={() => setActiveTab('a2a')}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeTab === 'a2a' ? "border-indigo-500 text-indigo-400" : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <GitMerge className="w-4 h-4" />
          A2A Orchestrator
        </button>
        <button
          onClick={() => setActiveTab('jules')}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeTab === 'jules' ? "border-indigo-500 text-indigo-400" : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Code2 className="w-4 h-4" />
          Jules (Code Agent)
        </button>
        <button
          onClick={() => setActiveTab('adk')}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeTab === 'adk' ? "border-indigo-500 text-indigo-400" : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Bot className="w-4 h-4" />
          ADK & RAG (Fase 3)
        </button>
      </div>

      {activeTab === 'adk' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-medium text-zinc-100 flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-400" />
                FileSearch API (RAG)
              </h3>
              <p className="text-sm text-zinc-400">
                Configura la "Memoria Aziendale" indicizzando un vault Obsidian. L'Agente Diagnostico userà questi dati per risolvere i problemi.
              </p>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Percorso Vault (es. /docs)</label>
                <input
                  type="text"
                  value={adkVaultPath}
                  onChange={(e) => setAdkVaultPath(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
                  placeholder="/percorso/al/vault"
                />
              </div>
              <button
                onClick={handleAdkIndex}
                disabled={isIndexing || !adkVaultPath}
                className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {isIndexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {isIndexing ? 'Indicizzazione in corso...' : 'Indicizza Vault'}
              </button>
              {indexStatus && <p className="text-xs text-indigo-400 mt-2">{indexStatus}</p>}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-medium text-zinc-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                Agente Diagnostico (ADK)
              </h3>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Problema da diagnosticare</label>
                <textarea
                  value={adkQuery}
                  onChange={(e) => setAdkQuery(e.target.value)}
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Descrivi l'errore o il problema..."
                />
              </div>
              <button
                onClick={handleAdkDiagnose}
                disabled={isAdkDiagnosing || !adkQuery}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {isAdkDiagnosing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
                {isAdkDiagnosing ? 'Diagnosi in corso...' : 'Avvia Diagnosi ADK'}
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col h-full">
            <h3 className="text-lg font-medium text-zinc-100 mb-4">Risultato Diagnosi</h3>
            {adkResult ? (
              <div className="flex-1 overflow-y-auto space-y-6">
                {adkResult.error ? (
                  <div className="text-red-400">{adkResult.error}</div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-400">RAG Context:</span>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1",
                        adkResult.ragContextUsed ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30"
                      )}>
                        {adkResult.ragContextUsed ? `Attivo (${adkResult.ragChunks} chunks)` : 'Non utilizzato'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-zinc-300 mb-2">Analisi e Soluzione:</h4>
                      <pre className="bg-zinc-950 p-4 rounded-lg text-sm text-zinc-300 overflow-x-auto border border-zinc-800 whitespace-pre-wrap font-sans">
                        {adkResult.diagnosis}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 space-y-4">
                <Bot className="w-12 h-12 opacity-20" />
                <p className="text-sm text-center max-w-xs">
                  Inserisci un problema e avvia la diagnosi. L'agente utilizzerà i documenti indicizzati per fornire una soluzione precisa.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'antigravity' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Tipo di Payload</label>
              <select
                value={payloadType}
                onChange={(e) => setPayloadType(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="AUTO">AUTO (Rilevamento Automatico)</option>
                <option value="CODE_PR">CODE_PR (Analisi Codice/OWASP)</option>
                <option value="API_REQUEST">API_REQUEST (WAF/Zero-day)</option>
                <option value="FINANCIAL_TX">FINANCIAL_TX (Anti-Frode/AML)</option>
                <option value="DLP_SCAN">DLP_SCAN (Data Loss Prevention)</option>
                <option value="IAC_AUDIT">IAC_AUDIT (Audit Terraform/K8s)</option>
                <option value="SRE_LOGS">SRE_LOGS (Analisi Log/Crash)</option>
                <option value="SOCIAL_ENGINEERING">SOCIAL_ENGINEERING (Anti-Phishing)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Contenuto da analizzare</label>
              <textarea
                value={payloadContent}
                onChange={(e) => setPayloadContent(e.target.value)}
                rows={10}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 font-mono text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Incolla qui il codice, il log o il payload..."
              />
            </div>
            <button
              onClick={handleScan}
              disabled={isScanning || !payloadContent}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
              {isScanning ? 'Scansione in corso...' : 'Avvia Scansione Antigravity'}
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col h-full">
            <h3 className="text-lg font-medium text-zinc-100 mb-4">Risultato Scansione</h3>
            {scanResult ? (
              <div className="flex-1 overflow-y-auto space-y-4">
                {scanResult.error ? (
                  <div className="text-red-400">{scanResult.error}</div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-400">Livello di Rischio:</span>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold",
                        scanResult.riskLevel === 'CRITICAL' ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        scanResult.riskLevel === 'HIGH' ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                        scanResult.riskLevel === 'MEDIUM' ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                        "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      )}>
                        {scanResult.riskLevel}
                      </span>
                    </div>
                    
                    {scanResult.findings && scanResult.findings.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-zinc-300 mb-2">Rilevamenti:</h4>
                        <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                          {scanResult.findings.map((f: string, i: number) => <li key={i}>{f}</li>)}
                        </ul>
                      </div>
                    )}

                    {scanResult.mitigation && (
                      <div>
                        <h4 className="text-sm font-medium text-zinc-300 mb-2">Mitigazione:</h4>
                        <p className="text-sm text-zinc-400">{scanResult.mitigation}</p>
                      </div>
                    )}

                    {scanResult.redactedPayload && (
                      <div>
                        <h4 className="text-sm font-medium text-zinc-300 mb-2">Payload Oscurato (DLP):</h4>
                        <pre className="bg-zinc-950 p-3 rounded-lg text-xs text-zinc-300 overflow-x-auto border border-zinc-800">
                          {scanResult.redactedPayload}
                        </pre>
                      </div>
                    )}

                    {scanResult.remediationScript && (
                      <div>
                        <h4 className="text-sm font-medium text-zinc-300 mb-2">Script di Remediation:</h4>
                        <pre className="bg-zinc-950 p-3 rounded-lg text-xs text-emerald-400 overflow-x-auto border border-zinc-800">
                          {scanResult.remediationScript}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                Nessuna scansione effettuata. Inserisci un payload e avvia l'analisi.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'a2a' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Agente Target</label>
              <select
                value={targetAgent}
                onChange={(e) => setTargetAgent(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="FULL_CYCLE_ORCHESTRATOR">FULL_CYCLE_ORCHESTRATOR (Risoluzione Autonoma Completa)</option>
                <option value="ADK_Diagnostic_Agent">ADK_Diagnostic_Agent (Solo Diagnosi)</option>
                <option value="Jules_Code_Agent">Jules_Code_Agent (Solo Analisi Impatto)</option>
                <option value="Antigravity_Security_Agent">Antigravity_Security_Agent (Solo Sicurezza)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Contesto Utente</label>
              <textarea
                value={a2aContext}
                onChange={(e) => setA2aContext(e.target.value)}
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Descrivi il problema dal punto di vista dell'utente..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Payload (JSON o Testo)</label>
              <textarea
                value={a2aPayload}
                onChange={(e) => setA2aPayload(e.target.value)}
                rows={8}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 font-mono text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Dati tecnici, log di errore, codice sorgente..."
              />
            </div>
            <button
              onClick={handleSimulate}
              disabled={isSimulating || !a2aPayload}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {isSimulating ? <Loader2 className="w-5 h-5 animate-spin" /> : <GitMerge className="w-5 h-5" />}
              {isSimulating ? 'Simulazione in corso...' : 'Simula Flusso A2A'}
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col h-full">
            <h3 className="text-lg font-medium text-zinc-100 mb-4">Risultato Orchestrazione</h3>
            {a2aResult ? (
              <div className="flex-1 overflow-y-auto space-y-6">
                {a2aResult.error ? (
                  <div className="text-red-400">{a2aResult.error}</div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-400">Status:</span>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1",
                        a2aResult.status === 'SUCCESS' || a2aResult.status === 'RESOLVED_AUTONOMOUSLY' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                        a2aResult.status === 'REQUIRES_HUMAN' ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                        "bg-red-500/20 text-red-400 border border-red-500/30"
                      )}>
                        {a2aResult.status === 'SUCCESS' || a2aResult.status === 'RESOLVED_AUTONOMOUSLY' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {a2aResult.status}
                      </span>
                    </div>

                    {a2aResult.workflowTrace && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-zinc-300">Traccia Workflow:</h4>
                        <div className="space-y-2">
                          {a2aResult.workflowTrace.map((step: any, idx: number) => (
                            <div key={idx} className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-indigo-400">{step.step}</span>
                                <span className="text-xs text-zinc-500">{step.status}</span>
                              </div>
                              {step.output && (
                                <pre className="text-[10px] text-zinc-400 overflow-x-auto max-h-32">
                                  {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-medium text-zinc-300 mb-2">Risultato Finale:</h4>
                      <pre className="bg-zinc-950 p-4 rounded-lg text-xs text-zinc-300 overflow-x-auto border border-zinc-800 whitespace-pre-wrap">
                        {typeof a2aResult.result === 'string' ? a2aResult.result : JSON.stringify(a2aResult.result, null, 2)}
                      </pre>
                    </div>

                    {a2aResult.ticketCreated && (
                      <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-lg flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-indigo-400" />
                        <div>
                          <p className="text-sm text-indigo-300 font-medium">Ticket Creato Automaticamente</p>
                          <p className="text-xs text-indigo-400/70">ID: {a2aResult.ticketCreated}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                Nessuna simulazione effettuata. Inserisci i dati e avvia il flusso.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'jules' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Contesto / Problema</label>
              <textarea
                value={julesContext}
                onChange={(e) => setJulesContext(e.target.value)}
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Descrivi il contesto o il problema..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Codice Sorgente</label>
              <textarea
                value={julesCode}
                onChange={(e) => setJulesCode(e.target.value)}
                rows={12}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 font-mono text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Incolla qui il codice da analizzare..."
              />
            </div>
            <button
              onClick={handleJulesAnalyze}
              disabled={isJulesAnalyzing || !julesCode}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {isJulesAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Code2 className="w-5 h-5" />}
              {isJulesAnalyzing ? 'Analisi in corso...' : 'Analizza con Jules'}
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col h-full">
            <h3 className="text-lg font-medium text-zinc-100 mb-4">Risultato Analisi Jules</h3>
            {julesResult ? (
              <div className="flex-1 overflow-y-auto space-y-6">
                {julesResult.error ? (
                  <div className="text-red-400">{julesResult.error}</div>
                ) : (
                  <>
                    <div>
                      <h4 className="text-sm font-medium text-zinc-300 mb-2">Report di Impatto:</h4>
                      <pre className="bg-zinc-950 p-4 rounded-lg text-xs text-zinc-300 overflow-x-auto border border-zinc-800 whitespace-pre-wrap">
                        {typeof julesResult === 'string' ? julesResult : JSON.stringify(julesResult, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 space-y-4">
                <Code2 className="w-12 h-12 opacity-20" />
                <p className="text-sm text-center max-w-xs">
                  Incolla il codice e avvia l'analisi per vedere i suggerimenti di refactoring e le patch di Jules.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
