import { useState, useEffect } from 'react';
import { Menu, X, LogIn, LogOut } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Models } from './pages/Models';
import { Inference } from './pages/Inference';
import { Workflows } from './pages/Workflows';
import { Projects } from './pages/Projects';
import { Monitoring } from './pages/Monitoring';
import { Settings } from './pages/Settings';
import { Help } from './pages/Help';
import { SettingsProvider } from './context/SettingsContext';
import { PermissionsModal } from './components/PermissionsModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';

/**
 * Main content component that manages the layout, routing (via state),
 * and mobile responsiveness of the application.
 */
function AppContent() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, login, logout } = useAuth();

  useEffect(() => {
    const checkInitialState = async () => {
      try {
        if (!('caches' in window)) return;
        const cacheKeys = await caches.keys();
        const transformersCaches = cacheKeys.filter(key => key.includes('transformers'));
        
        let hasModels = false;
        for (const cacheName of transformersCaches) {
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          if (requests.length > 0) {
            hasModels = true;
            break;
          }
        }
        
        if (!hasModels) {
          setCurrentView('models');
        }
      } catch (err) {
        console.error("Error checking initial cache:", err);
      }
    };
    
    checkInitialState();
  }, []);

  const handleViewChange = (view: string) => {
    setCurrentView(view);
    setIsSidebarOpen(false); // Chiudi la sidebar su mobile dopo la selezione
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50 font-sans overflow-hidden relative">
      {/* Mobile Header */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 z-40">
        <div className="font-bold text-zinc-100">LLM Platform</div>
        <div className="flex items-center gap-4">
          {user ? (
            <button onClick={logout} className="text-zinc-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={login} className="text-zinc-400 hover:text-white">
              <LogIn className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 bg-zinc-800 rounded-md text-zinc-300 hover:text-white"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Overlay per mobile */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar currentView={currentView} setCurrentView={handleViewChange} />
        
        {/* Auth Button in Sidebar */}
        <div className="absolute bottom-6 left-6 right-6">
          {user ? (
            <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-3 overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                    {user.displayName?.charAt(0) || user.email?.charAt(0)}
                  </div>
                )}
                <div className="truncate">
                  <div className="text-sm font-medium text-zinc-200 truncate">{user.displayName}</div>
                  <div className="text-xs text-zinc-500 truncate">{user.email}</div>
                </div>
              </div>
              <button onClick={logout} className="text-zinc-400 hover:text-white p-2">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={login}
              className="w-full flex items-center justify-center gap-2 bg-indigo-500 text-white py-3 rounded-xl font-medium hover:bg-indigo-600 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Accedi con Google
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0 w-full">
        {currentView === 'dashboard' && <Dashboard onNavigate={handleViewChange} />}
        {currentView === 'models' && <Models />}
        {currentView === 'inference' && <Inference />}
        {currentView === 'workflows' && <Workflows />}
        {currentView === 'projects' && <Projects />}
        {currentView === 'monitoring' && <Monitoring />}
        {currentView === 'settings' && <Settings />}
        {currentView === 'help' && <Help />}
      </main>
    </div>
  );
}

/**
 * Root application component.
 * Wraps the application with necessary providers for Authentication,
 * Settings, and Chat state management.
 */
export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ChatProvider>
          <PermissionsModal />
          <AppContent />
        </ChatProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
