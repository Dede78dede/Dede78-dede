import { useState, useEffect } from 'react';

export function usePermissionsModalLogic() {
  const [isOpen, setIsOpen] = useState(false);
  const [storageGranted, setStorageGranted] = useState(false);
  const [fsGranted, setFsGranted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let asked = false;
    try {
      asked = !!localStorage.getItem('permissions_asked');
    } catch (e) {
      console.warn("localStorage access denied");
    }

    if (!asked) {
      setIsOpen(true);
    } else {
      try {
        if (navigator.storage && navigator.storage.persisted) {
          navigator.storage.persisted().then(setStorageGranted).catch(() => {});
        }
      } catch (e) {
        console.warn("navigator.storage access denied");
      }
    }
  }, []);

  const requestStorage = async () => {
    try {
      if (navigator.storage && navigator.storage.persist) {
        const granted = await navigator.storage.persist();
        setStorageGranted(granted);
      } else {
        setStorageGranted(true);
      }
    } catch (e) {
      console.warn("Storage persist request failed", e);
      setStorageGranted(true);
    }
  };

  const requestFS = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker();
        if (handle) {
          setFsGranted(true);
          // In una vera app, salveremmo l'handle in IndexedDB
        }
      } else {
        setErrorMsg("File System Access API non supportata in questo browser. Usa Chrome/Edge per abilitare questa funzione.");
        setFsGranted(true);
      }
    } catch (e: any) {
      console.error("Accesso al file system rifiutato", e);
      if (e.message && e.message.includes('Cross origin sub frames')) {
        setErrorMsg("File System Access API bloccata in questo ambiente (iframe). Usa la modalità fallback.");
      } else {
        setErrorMsg("Accesso al file system rifiutato.");
      }
    }
  };

  const handleClose = () => {
    try {
      localStorage.setItem('permissions_asked', 'true');
    } catch (e) {
      console.warn("localStorage.setItem denied");
    }
    setIsOpen(false);
  };

  return {
    isOpen,
    storageGranted,
    fsGranted,
    errorMsg,
    requestStorage,
    requestFS,
    handleClose
  };
}
