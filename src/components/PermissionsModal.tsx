import { Shield, HardDrive, Folder, Check } from 'lucide-react';
import { usePermissionsModalLogic } from '../features/permissions/hooks/usePermissionsModalLogic';

/**
 * Modal component to request necessary browser permissions (Storage, File System)
 * on first load.
 */
export function PermissionsModal() {
  const {
    isOpen,
    storageGranted,
    fsGranted,
    errorMsg,
    requestStorage,
    requestFS,
    handleClose
  } = usePermissionsModalLogic();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl overflow-y-auto max-h-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Shield className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-zinc-100">Permessi di Sistema</h2>
        </div>
        
        <p className="text-zinc-400 text-sm mb-6">
          Per funzionare correttamente come piattaforma locale e accedere ai tuoi progetti, SmarterRouter richiede alcuni permessi dal tuo browser.
        </p>

        <div className="space-y-4 mb-8">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {errorMsg}
            </div>
          )}
          <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-zinc-400" />
              <div>
                <div className="text-sm font-medium text-zinc-200">Archiviazione Persistente</div>
                <div className="text-xs text-zinc-500">Evita che il browser cancelli i modelli AI scaricati</div>
              </div>
            </div>
            {storageGranted ? (
              <Check className="w-5 h-5 text-emerald-500" />
            ) : (
              <button onClick={requestStorage} className="text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600 transition-colors">
                Richiedi
              </button>
            )}
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <Folder className="w-5 h-5 text-zinc-400" />
              <div>
                <div className="text-sm font-medium text-zinc-200">Accesso File System</div>
                <div className="text-xs text-zinc-500">Necessario per leggere il Vault Obsidian locale</div>
              </div>
            </div>
            {fsGranted ? (
              <Check className="w-5 h-5 text-emerald-500" />
            ) : (
              <button onClick={requestFS} className="text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600 transition-colors">
                Seleziona Vault
              </button>
            )}
          </div>
        </div>

        <button 
          onClick={handleClose}
          className="w-full py-3 bg-zinc-100 text-zinc-900 rounded-xl font-medium hover:bg-white transition-colors"
        >
          Continua nell'App
        </button>
      </div>
    </div>
  );
}
