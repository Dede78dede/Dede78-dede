import React from 'react';
import { BookOpen, Terminal, Cpu, Network, Database, Shield, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const helpContent = `
# Guida Interattiva SmarterRouter

Benvenuto nella piattaforma SmarterRouter. Questa guida ti aiuterà a comprendere e utilizzare al meglio le funzionalità del sistema Multi-Agente e dell'Orchestratore Ibrido.

## 1. Il MasterOrchestrator (MaAS)
Il cuore del sistema è il **MasterOrchestrator**, un controller adattivo basato su Gemini 3.1 Pro.
Quando invii un prompt nella pagina **Inferenza Rapida** selezionando il modello "SmarterRouter (Auto)", il Master analizza la tua richiesta e decide:
- **Direct Answer**: Risponde direttamente se la domanda è complessa o richiede ragionamento avanzato.
- **Local Delegation**: Delega la risposta al modello locale (es. Qwen) se la domanda è semplice (es. "Ciao"), risparmiando risorse cloud.
- **Agent Job**: Se chiedi di addestrare o unire modelli, estrae i parametri e crea un Job asincrono per gli agenti Python.

## 2. Agenti Specializzati e Job Queue
Nella **Dashboard** puoi monitorare gli agenti Python connessi al sistema e la coda dei Job.
- **Trainer**: Esegue il fine-tuning (LoRA) sui tuoi dati.
- **Merger**: Unisce più modelli usando tecniche come TIES o DARE.
- **Evaluator**: Testa i modelli su benchmark standard.
- **Research**: Cerca informazioni sul web per arricchire i dataset.

*Prova a scrivere "Addestra un modello sui miei dati" nella chat per vedere il Master creare un Job!*

## 3. Integrazione Obsidian (MCP)
Nella pagina **Progetti (Obsidian)**, il sistema si connette direttamente al tuo vault Obsidian locale tramite il Model Context Protocol (MCP).
Puoi leggere i tuoi appunti, analizzarli con l'LLM e generare nuovi contenuti direttamente nei tuoi file Markdown.

## 4. Memoria a 4 Livelli
Il sistema utilizza una memoria gerarchica:
1. **L1 (Working Memory)**: Cache in memoria per risposte istantanee a domande identiche.
2. **L2 (Episodic Memory)**: Cache semantica. Se fai una domanda simile a una già fatta, il sistema recupera la risposta precedente.
3. **L3 (Semantic Memory)**: I tuoi file Obsidian.
4. **L4 (Compute)**: L'esecuzione reale del modello (Locale o Cloud).

## 5. Impostazioni
Nella pagina **Impostazioni** puoi:
- Configurare le chiavi API per i vari provider (OpenAI, Anthropic, Groq, DeepSeek).
- Modificare il percorso del tuo Vault Obsidian.
- Regolare la "Quality Preference" del router (più verso il locale o più verso il cloud).
- Abilitare/Disabilitare il protocollo LLM-CL e la Cache Semantica.
`;

/**
 * Help page component.
 * Displays interactive documentation and a guide on how to use the
 * SmarterRouter platform, its features, and architecture.
 */
export function Help() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-emerald-400" />
          Help & Documentazione
        </h2>
        <p className="text-zinc-400 mt-1">Scopri come utilizzare al meglio la piattaforma SmarterRouter.</p>
      </header>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 md:p-8 prose prose-invert prose-emerald max-w-none">
        <ReactMarkdown>{helpContent}</ReactMarkdown>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <Terminal className="w-6 h-6 text-blue-400 mb-3" />
          <h3 className="font-medium text-zinc-100 mb-1">Comandi Chat</h3>
          <p className="text-sm text-zinc-400">Prova a chiedere al router: "Fai il merge del modello A e B" per testare la creazione dei Job.</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <Network className="w-6 h-6 text-purple-400 mb-3" />
          <h3 className="font-medium text-zinc-100 mb-1">LLM-CL</h3>
          <p className="text-sm text-zinc-400">Il protocollo compresso riduce l'uso dei token del 75% durante la comunicazione tra agenti.</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <Database className="w-6 h-6 text-emerald-400 mb-3" />
          <h3 className="font-medium text-zinc-100 mb-1">Cache Semantica</h3>
          <p className="text-sm text-zinc-400">Le risposte simili vengono recuperate dalla cache istantaneamente, risparmiando tempo e costi API.</p>
        </div>
      </div>
    </div>
  );
}
