import { useState, useEffect } from 'react';
import { ObsidianService } from '../../../services/ObsidianService';
import { ObsidianMCPService } from '../../../services/ObsidianMCPService';
import { useSettings } from '../../../context/SettingsContext';

export function useProjectsLogic() {
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

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

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

  return {
    isModalOpen,
    setIsModalOpen,
    hasVaultAccess,
    vaultName,
    vaultFiles,
    isLoadingFiles,
    projects,
    notification,
    settings,
    fetchVaultFiles,
    handleRequestVaultAccess,
    handleCreateProject,
    handleActionClick
  };
}
