import { lazy, Suspense } from 'react';
import { Menu, X, LogIn, LogOut } from 'lucide-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { SettingsProvider } from './context/SettingsContext';
import { BackupProvider } from './context/BackupContext';
import { PermissionsModal } from './components/PermissionsModal';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { AgentWorker } from './components/AgentWorker';
import { useAppLogic } from './features/app/hooks/useAppLogic';

const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Models = lazy(() => import('./pages/Models').then(m => ({ default: m.Models })));
const Inference = lazy(() => import('./pages/Inference').then(m => ({ default: m.Inference })));
const Workflows = lazy(() => import('./pages/Workflows').then(m => ({ default: m.Workflows })));
const Projects = lazy(() => import('./pages/Projects').then(m => ({ default: m.Projects })));
const Monitoring = lazy(() => import('./pages/Monitoring').then(m => ({ default: m.Monitoring })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Help = lazy(() => import('./pages/Help').then(m => ({ default: m.Help })));
const Agents = lazy(() => import('./pages/Agents').then(m => ({ default: m.Agents })));
const StitchDesign = lazy(() => import('./pages/StitchDesign').then(m => ({ default: m.StitchDesign })));

/**
 * Main content component that manages the layout, routing (via state),
 * and mobile responsiveness of the application.
 */
function AppContent() {
  const {
    currentView,
    isSidebarOpen,
    setIsSidebarOpen,
    user,
    login,
    logout,
    handleViewChange
  } = useAppLogic();

  return (
    <div className="flex h-viewport bg-zinc-950 text-zinc-50 font-sans overflow-hidden relative">
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
        <Suspense fallback={<div className="p-8 text-zinc-400">Caricamento...</div>}>
          <Routes>
            <Route path="/" element={<Dashboard onNavigate={handleViewChange} />} />
            <Route path="/dashboard" element={<Dashboard onNavigate={handleViewChange} />} />
            <Route path="/models" element={<Models />} />
            <Route path="/inference" element={<Inference />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/stitch" element={<StitchDesign />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
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
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <BackupProvider>
            <ChatProvider>
              <PermissionsModal />
              <AppContent />
              <AgentWorker />
            </ChatProvider>
          </BackupProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
