import React, { useState, useEffect } from 'react';
import { Folder, FileText, Plus, Database, GitMerge, ActivitySquare, X, LucideIcon, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '../utils/cn';
import { ObsidianService } from '../services/ObsidianService';
import { ObsidianMCPService } from '../services/ObsidianMCPService';
import { useSettings } from '../context/SettingsContext';

/**
 * Projects page component.
 * Manages projects and their integration with the local Obsidian Vault.
 * Allows users to create training, merge, and evaluation requests directly
 * as markdown files in their vault.
 */
export function Projects() {
  const { settings } = useSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasVaultAccess, setHasVaultAccess] = useState(ObsidianService.hasAccess());
  const [vaultName, setVaultName] = useState(ObsidianService.getVaultName());
  const [vaultFiles, setVaultFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [projects, setProjects] = useState([
    { name: 'CustomerBot', path: 'Projects/CustomerBot', updated: '2 ore fa', status: 'training' },
    { name: 'CodeAssistant', path: 'Projects/CodeAssistant', updated: '1 giorno fa', status: 'evaluating' },
    { name: 'MedicalQA', path: 'Projects/MedicalQA', updated: '3 giorni fa', status: 'idle' },
  ]);

  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  /**
   * Displays a temporary notification message.
   * @param message The text to display.
   * @param type The type of notification ('success' or 'error').
   */
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  /**
   * Fetches the list of files from the configured Obsidian Vault path using the MCP service.
   */
  const fetchVaultFiles = async () => {
    if (!settings.obsidianVaultPath) return;
    setIsLoadingFiles(true);
    try {
      const mcp = new ObsidianMCPService(settings.obsidianVaultPath, settings.allowedWritePath);
      const files = await mcp.listNotes();
      setVaultFiles(files);
    } catch (error) {
      console.error("Errore recupero file dal vault:", error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchVaultFiles();
  }, [settings.obsidianVaultPath]);

  /**
   * Requests access to the local file system (Obsidian Vault) using the File System Access API.
   */
  const handleRequestVaultAccess = async () => {
    const success = await ObsidianService.requestVaultAccess();
    if (success) {
      setHasVaultAccess(true);
      setVaultName(ObsidianService.getVaultName());
      showNotification("Vault connesso con successo!");
    } else {
      showNotification("Accesso al Vault negato o annullato.", "error");
    }
  };

  /**
   * Handles the creation of a new project from the modal form.
   * Creates a corresponding markdown file in the Obsidian Vault if access is granted.
   */
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const baseModel = formData.get('baseModel') as string;
    
    if (name) {
      setProjects([{
        name,
        path: `Projects/${name}`,
        updated: 'Adesso',
        status: 'idle'
      }, ...projects]);
      setIsModalOpen(false);

      if (hasVaultAccess) {
        const content = ObsidianService.generateTrainingRequest(name, baseModel);
        await ObsidianService.createMarkdownFile(`training_request_${name}.md`, content);
        showNotification(`Progetto ${name} creato e file salvato nel Vault!`);
      } else {
        showNotification(`Progetto ${name} creato (senza salvataggio nel Vault).`);
      }
    }
  };

  /**
   * Handles quick actions (training, merge, eval) by generating and saving
   * the appropriate markdown request file in the connected Obsidian Vault.
   * 
   * @param type The type of action to perform.
   */
  const handleActionClick = async (type: 'training' | 'merge' | 'eval') => {
    if (!hasVaultAccess) {
      showNotification("Devi prima connettere il tuo Vault Obsidian!", "error");
      return;
    }

    const projectName = "NuovoProgetto"; // Default per l'azione rapida
    let content = "";
    let filename = "";

    switch (type) {
      case 'training':
        content = ObsidianService.generateTrainingRequest(projectName, "llama-3.2-3b");
        filename = `training_request_${Date.now()}.md`;
        break;
      case 'merge':
        content = ObsidianService.generateMergeRequest(projectName);
        filename = `merge_request_${Date.now()}.md`;
        break;
      case 'eval':
        content = ObsidianService.generateEvalRequest(projectName);
        filename = `eval_request_${Date.now()}.md`;
        break;
    }

    const success = await ObsidianService.createMarkdownFile(filename, content);
    if (success) {
      showNotification(`File ${filename} creato con successo nel Vault!`);
    } else {
      showNotification(`Errore durante la creazione del file ${filename}.`, "error");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 relative">
      {notification && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium flex items-center gap-2",
          notification.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
        )}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {notification.message}
        </div>
      )}
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Progetti (Obsidian Vault)</h2>
          <p className="text-zinc-400 mt-1">Gestisci i progetti e crea nuove richieste per gli agenti.</p>
        </div>
        <div className="flex gap-3">
          {!hasVaultAccess ? (
            <button 
              onClick={handleRequestVaultAccess}
              className="flex items-center gap-2 bg-zinc-800 text-zinc-200 px-4 py-2 rounded-lg font-medium hover:bg-zinc-700 transition-colors border border-zinc-700"
            >
              <Folder className="w-4 h-4" />
              Connetti Vault
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-lg font-medium border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              Vault Connesso: {vaultName}
            </div>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-500 text-zinc-950 px-4 py-2 rounded-lg font-medium hover:bg-emerald-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuovo Progetto
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-medium text-zinc-200 mb-4">Vault Attivo</h3>
          {projects.map((proj) => (
            <div key={proj.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors cursor-pointer group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                    <Folder className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-zinc-100 text-lg">{proj.name}</h4>
                    <p className="text-sm text-zinc-500 flex items-center gap-1 mt-0.5">
                      <FileText className="w-3 h-3" /> {proj.path}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded-full",
                    proj.status === 'training' ? 'bg-blue-500/10 text-blue-400' :
                    proj.status === 'evaluating' ? 'bg-purple-500/10 text-purple-400' :
                    'bg-zinc-800 text-zinc-400'
                  )}>
                    {proj.status.toUpperCase()}
                  </span>
                  <p className="text-xs text-zinc-500 mt-2">Aggiornato {proj.updated}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-lg font-medium text-zinc-200 mb-4">Azioni Rapide (MCP)</h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 space-y-1 mb-6">
            <ActionBtn icon={Database} label="Nuova Richiesta Training" desc="Genera training_request.md" onClick={() => handleActionClick('training')} />
            <ActionBtn icon={GitMerge} label="Nuova Richiesta Merge" desc="Genera merge_request.md" onClick={() => handleActionClick('merge')} />
            <ActionBtn icon={ActivitySquare} label="Nuova Richiesta Valutazione" desc="Genera eval_request.md" onClick={() => handleActionClick('eval')} />
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-zinc-200">Esplora Vault (Backend MCP)</h3>
            <button 
              onClick={fetchVaultFiles}
              disabled={isLoadingFiles || !settings.obsidianVaultPath}
              className="text-xs flex items-center gap-1 text-emerald-500 hover:text-emerald-400 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={cn("w-3 h-3", isLoadingFiles && "animate-spin")} />
              Aggiorna
            </button>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 max-h-[300px] overflow-y-auto">
            {!settings.obsidianVaultPath ? (
              <p className="text-sm text-zinc-500 text-center py-4">Configura il percorso del Vault nelle Impostazioni.</p>
            ) : vaultFiles.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">Nessun file trovato o errore di lettura.</p>
            ) : (
              <ul className="space-y-2">
                {vaultFiles.map((file, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-zinc-300 p-2 hover:bg-zinc-800 rounded-lg transition-colors cursor-default">
                    <FileText className="w-4 h-4 text-zinc-500" />
                    <span className="truncate">{file}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nuovo Progetto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-100">Crea Nuovo Progetto</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Nome Progetto</label>
                <input 
                  type="text" 
                  name="name"
                  required
                  placeholder="es. FinanceBot"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Modello Base</label>
                <select name="baseModel" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500">
                  <option value="llama-3.2-3b">llama-3.2-3b</option>
                  <option value="phi-3-mini">phi-3-mini</option>
                  <option value="qwen2:7b">qwen2:7b</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 text-zinc-950 rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors"
                >
                  Crea e Inizializza Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface ActionBtnProps {
  icon: LucideIcon;
  label: string;
  desc: string;
  onClick: () => void;
}

function ActionBtn({ icon: Icon, label, desc, onClick }: ActionBtnProps) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-zinc-800 transition-colors text-left group">
      <div className="w-8 h-8 bg-zinc-800 rounded-md flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-colors">
        <Icon className="w-4 h-4 text-zinc-300 group-hover:text-emerald-400 transition-colors" />
      </div>
      <div>
        <div className="text-sm font-medium text-zinc-200">{label}</div>
        <div className="text-xs text-zinc-500">{desc}</div>
      </div>
    </button>
  );
}
