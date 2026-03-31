import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';

export function useAppLogic() {
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

  return {
    currentView,
    isSidebarOpen,
    setIsSidebarOpen,
    user,
    login,
    logout,
    handleViewChange
  };
}
