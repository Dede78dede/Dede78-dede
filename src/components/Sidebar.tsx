import { LayoutDashboard, Cpu, FolderKanban, Activity, Settings, HelpCircle, GitMerge, DownloadCloud } from 'lucide-react';
import { cn } from '../utils/cn';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

/**
 * Sidebar navigation component.
 * Renders the main navigation menu and handles view switching.
 */
export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'models', label: 'Modelli Locali', icon: DownloadCloud },
    { id: 'inference', label: 'Inferenza Rapida', icon: Cpu },
    { id: 'workflows', label: 'Workflows', icon: GitMerge },
    { id: 'projects', label: 'Progetti (Obsidian)', icon: FolderKanban },
    { id: 'monitoring', label: 'Monitoraggio', icon: Activity },
    { id: 'help', label: 'Guida & Help', icon: HelpCircle },
  ];

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-500 rounded-md flex items-center justify-center">
            <Cpu className="w-4 h-4 text-zinc-950" />
          </div>
          LLM Platform
        </h1>
        <p className="text-xs text-zinc-500 mt-1">SmarterRouter v1.0</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-zinc-800 text-emerald-400" 
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <button 
          onClick={() => setCurrentView('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            currentView === 'settings' 
              ? "bg-zinc-800 text-emerald-400" 
              : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
          )}
        >
          <Settings className="w-4 h-4" />
          Impostazioni
        </button>
      </div>
    </aside>
  );
}
