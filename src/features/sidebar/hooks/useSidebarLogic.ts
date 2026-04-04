import { LayoutDashboard, Cpu, FolderKanban, Activity, Settings, HelpCircle, GitMerge, DownloadCloud, Bot, Paintbrush, Network } from 'lucide-react';

export function useSidebarLogic(currentView: string, setCurrentView: (view: string) => void) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'models', label: 'Modelli Locali', icon: DownloadCloud },
    { id: 'inference', label: 'Inferenza Rapida', icon: Cpu },
    { id: 'smarter-router', label: 'SmarterRouter', icon: Network },
    { id: 'workflows', label: 'Workflows', icon: GitMerge },
    { id: 'agents', label: 'Agenti & A2A', icon: Bot },
    { id: 'stitch', label: 'Stitch Design', icon: Paintbrush },
    { id: 'projects', label: 'Progetti (Obsidian)', icon: FolderKanban },
    { id: 'monitoring', label: 'Monitoraggio', icon: Activity },
    { id: 'help', label: 'Guida & Help', icon: HelpCircle },
  ];

  const handleNavClick = (id: string) => {
    setCurrentView(id);
  };

  return {
    navItems,
    handleNavClick,
    SettingsIcon: Settings,
  };
}
