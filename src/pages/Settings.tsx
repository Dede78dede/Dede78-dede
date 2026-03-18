import React, { useState, useEffect, useCallback } from 'react';
import { Save, Server, Database, Shield, CheckCircle2, RefreshCw, AlertCircle, Command, User, Plus, Trash2 } from 'lucide-react';
import { useSettings, Macro, Profile } from '../context/SettingsContext';

/**
 * Settings page component.
 * Allows users to configure application settings, including API keys,
 * default models, Ollama integration, and caching preferences.
 */
export function Settings() {
  const { settings, updateSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaved, setIsSaved] = useState(false);

  // Ollama Sync State
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isSyncingOllama, setIsSyncingOllama] = useState(false);
  const [ollamaSyncStatus, setOllamaSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

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
   * Handles changes to individual setting fields, updating local state
   * before saving to the global context.
   * 
   * @param key The setting key to update.
   * @param value The new value for the setting.
   */
  const handleChange = useCallback(<K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setIsSaved(false);
  }, []);

  /**
   * Attempts to fetch the list of available models from the configured Ollama instance.
   * Handles potential CORS and Mixed Content issues gracefully.
   */
  const syncOllamaModels = useCallback(async () => {
    if (!localSettings.ollamaUrl) return;
    setIsSyncingOllama(true);
    setOllamaSyncStatus('idle');
    try {
      // Check for mixed content issues (HTTPS iframe trying to access HTTP localhost)
      if (window.location.protocol === 'https:' && localSettings.ollamaUrl.startsWith('http://')) {
        console.warn("Attenzione: Stai tentando di accedere a un server HTTP da un ambiente HTTPS. Questo potrebbe essere bloccato dal browser (Mixed Content).");
      }

      const response = await fetch(`${localSettings.ollamaUrl}/api/tags`);
      if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
      const data = await response.json();
      if (data.models && Array.isArray(data.models)) {
        const models = data.models.map((m: any) => m.name);
        setOllamaModels(models);
        setOllamaSyncStatus('success');
        // Se il modello attualmente selezionato non è nella lista e la lista non è vuota, seleziona il primo disponibile
        if (models.length > 0 && !models.includes(localSettings.fallbackModel)) {
          handleChange('fallbackModel', models[0]);
        }
      }
    } catch (error: any) {
      console.warn("Avviso: Sincronizzazione con Ollama non riuscita. Dettagli:", error.message || error);
      if (error.message === 'Failed to fetch') {
        console.warn("Questo è normale se Ollama non è in esecuzione localmente, se CORS non è abilitato (OLLAMA_ORIGINS=\"*\"), o per blocchi Mixed Content.");
      }
      setOllamaSyncStatus('error');
    } finally {
      setIsSyncingOllama(false);
    }
  }, [localSettings.ollamaUrl, localSettings.fallbackModel, handleChange]);

  // Sincronizza all'avvio se c'è un URL
  useEffect(() => {
    if (localSettings.ollamaUrl) {
      syncOllamaModels();
    }
  }, []);

  /**
   * Saves the local settings state to the global SettingsContext.
   */
  const handleSave = () => {
    updateSettings(localSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const addMacro = () => {
    const newMacro: Macro = {
      id: `macro_${Date.now()}`,
      trigger: 'new',
      template: '',
      label: 'Nuova macro'
    };
    handleChange('macros', [...localSettings.macros, newMacro]);
  };

  const updateMacro = (id: string, field: keyof Macro, value: string) => {
    handleChange('macros', localSettings.macros.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const deleteMacro = (id: string) => {
    handleChange('macros', localSettings.macros.filter(m => m.id !== id));
  };

  const addProfile = () => {
    const newProfile: Profile = {
      id: `profile_${Date.now()}`,
      name: 'Nuovo Profilo',
      icon: 'User',
      systemPrompt: 'Sei un assistente utile.',
      masterModel: localSettings.masterModel,
      fallbackModel: localSettings.fallbackModel
    };
    handleChange('profiles', [...localSettings.profiles, newProfile]);
  };

  const updateProfile = (id: string, field: keyof Profile, value: string) => {
    handleChange('profiles', localSettings.profiles.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const deleteProfile = (id: string) => {
    if (localSettings.profiles.length <= 1) {
      showNotification('Devi avere almeno un profilo.', 'error');
      return;
    }
    handleChange('profiles', localSettings.profiles.filter(p => p.id !== id));
    if (localSettings.activeProfileId === id) {
      handleChange('activeProfileId', localSettings.profiles[0].id);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 relative">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium flex items-center gap-2 ${
          notification.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {notification.message}
        </div>
      )}
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Impostazioni Piattaforma</h2>
          <p className="text-zinc-400 mt-1">Configura SmarterRouter, Master e integrazioni locali.</p>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 bg-emerald-500 text-zinc-950 px-4 py-2 rounded-lg font-medium hover:bg-emerald-400 transition-colors"
        >
          {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {isSaved ? 'Salvato' : 'Salva Modifiche'}
        </button>
      </header>

      <div className="space-y-6">
        {/* Routing Settings */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
            <Server className="w-5 h-5 text-emerald-400" />
            <h3 className="font-medium text-zinc-100">SmarterRouter Configuration</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Quality Preference (0.0 - 1.0)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="0" max="1" step="0.1" 
                  value={localSettings.routerQualityPreference}
                  onChange={(e) => handleChange('routerQualityPreference', parseFloat(e.target.value))}
                  className="w-full accent-emerald-500" 
                />
                <span className="text-zinc-400 text-sm w-8 text-right">{localSettings.routerQualityPreference}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-2">0 = Massima velocità (Modelli Locali), 1 = Massima qualità (Master Gemini).</p>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-zinc-300">Semantic Cache</label>
                <p className="text-xs text-zinc-500 mt-1">Abilita la cache basata su similarità semantica.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={localSettings.semanticCacheEnabled}
                  onChange={(e) => handleChange('semanticCacheEnabled', e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Cache Similarity Threshold</label>
                <input 
                  type="number" 
                  value={localSettings.cacheSimilarityThreshold}
                  onChange={(e) => handleChange('cacheSimilarityThreshold', parseFloat(e.target.value))}
                  step="0.05" min="0" max="1" 
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 w-32 focus:outline-none focus:border-emerald-500" 
                />
              </div>
              <button 
                onClick={() => {
                  import('../services/MemorySystem').then(async ({ memorySystem }) => {
                    await memorySystem.clearCache();
                    showNotification('Cache svuotata con successo!');
                  });
                }}
                className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
              >
                Svuota Cache
              </button>
            </div>
          </div>
        </section>

        {/* Profiles Management */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-indigo-400" />
              <h3 className="font-medium text-zinc-100">Profili Utente (Personas)</h3>
            </div>
            <button onClick={addProfile} className="text-xs flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2 py-1 rounded transition-colors">
              <Plus className="w-3 h-3" /> Aggiungi Profilo
            </button>
          </div>
          <div className="p-6 space-y-6">
            {localSettings.profiles.map(profile => (
              <div key={profile.id} className="p-4 border border-zinc-800 rounded-lg space-y-4 bg-zinc-950/50">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Nome Profilo</label>
                      <input 
                        type="text" 
                        value={profile.name}
                        onChange={(e) => updateProfile(profile.id, 'name', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500 text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">System Prompt (Istruzioni)</label>
                      <textarea 
                        value={profile.systemPrompt}
                        onChange={(e) => updateProfile(profile.id, 'systemPrompt', e.target.value)}
                        rows={3}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500 text-sm resize-none" 
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteProfile(profile.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                    title="Elimina profilo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Macros Management */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Command className="w-5 h-5 text-emerald-400" />
              <h3 className="font-medium text-zinc-100">Macro (Slash Commands)</h3>
            </div>
            <button onClick={addMacro} className="text-xs flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2 py-1 rounded transition-colors">
              <Plus className="w-3 h-3" /> Aggiungi Macro
            </button>
          </div>
          <div className="p-6 space-y-4">
            {localSettings.macros.map(macro => (
              <div key={macro.id} className="flex flex-col md:flex-row gap-4 p-4 border border-zinc-800 rounded-lg bg-zinc-950/50 items-start">
                <div className="w-full md:w-1/4 space-y-2">
                  <input 
                    type="text" 
                    value={macro.trigger}
                    onChange={(e) => updateMacro(macro.id, 'trigger', e.target.value)}
                    placeholder="/comando"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-sm font-mono" 
                  />
                  <input 
                    type="text" 
                    value={macro.label}
                    onChange={(e) => updateMacro(macro.id, 'label', e.target.value)}
                    placeholder="Descrizione breve"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-xs" 
                  />
                </div>
                <div className="flex-1 w-full">
                  <textarea 
                    value={macro.template}
                    onChange={(e) => updateMacro(macro.id, 'template', e.target.value)}
                    placeholder="Il prompt esteso che sostituirà il comando..."
                    rows={3}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-sm resize-none" 
                  />
                </div>
                <button 
                  onClick={() => deleteMacro(macro.id)}
                  className="p-2 text-zinc-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10 self-end md:self-start"
                  title="Elimina macro"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Master & Fallback */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h3 className="font-medium text-zinc-100">Master Cloud Models & API Keys</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Modello Master Predefinito</label>
              <select 
                value={localSettings.masterModel}
                onChange={(e) => handleChange('masterModel', e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Google) - Consigliato</option>
                <option value="gemini">Gemini 3.1 Pro (Google)</option>
                <option value="openai">GPT-4o (OpenAI)</option>
                <option value="anthropic">Claude 3.5 Sonnet (Anthropic)</option>
                <option value="groq">Llama 3 70B (Groq)</option>
                <option value="deepseek">DeepSeek Chat</option>
              </select>
              <p className="text-xs text-zinc-500 mt-2">Il modello cloud principale utilizzato dallo SmarterRouter per task complessi e contesti ampi (RAG).</p>
            </div>

            <div className="pt-4 border-t border-zinc-800/50">
              <h4 className="text-sm font-medium text-zinc-400 mb-4">Chiavi API (Salvate localmente nel tuo profilo)</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Gemini API Key</label>
                  <input 
                    type="password" 
                    value="************************"
                    disabled
                    className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-lg px-3 py-2 text-zinc-600 focus:outline-none cursor-not-allowed text-sm" 
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Gestita automaticamente dall'ambiente AI Studio.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">OpenAI API Key</label>
                  <input 
                    type="password" 
                    value={localSettings.openAiApiKey}
                    onChange={(e) => handleChange('openAiApiKey', e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-sm" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Anthropic API Key</label>
                  <input 
                    type="password" 
                    value={localSettings.anthropicApiKey}
                    onChange={(e) => handleChange('anthropicApiKey', e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-sm" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Groq API Key</label>
                  <input 
                    type="password" 
                    value={localSettings.groqApiKey}
                    onChange={(e) => handleChange('groqApiKey', e.target.value)}
                    placeholder="gsk_..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-sm" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">DeepSeek API Key</label>
                  <input 
                    type="password" 
                    value={localSettings.deepseekApiKey}
                    onChange={(e) => handleChange('deepseekApiKey', e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-sm" 
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800/50">
              <h4 className="text-sm font-medium text-zinc-400 mb-4">Endpoint Locali e Remoti</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Ollama URL</label>
                  <input 
                    type="text" 
                    value={localSettings.ollamaUrl}
                    onChange={(e) => handleChange('ollamaUrl', e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-sm" 
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">L'URL dell'istanza Ollama locale (es. http://localhost:11434).</p>
                  <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-500/80 text-[10px] flex items-start gap-1.5">
                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <p>
                      <strong>Avvertenza:</strong> Per permettere al browser di comunicare con Ollama, devi avviare il server Ollama con i permessi CORS abilitati. 
                      Su Mac/Linux esegui: <code className="bg-yellow-500/20 px-1 rounded">OLLAMA_ORIGINS="*" ollama serve</code>. 
                      Su Windows, imposta la variabile d'ambiente <code className="bg-yellow-500/20 px-1 rounded">OLLAMA_ORIGINS</code> a <code className="bg-yellow-500/20 px-1 rounded">*</code> prima di avviare Ollama.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Colab Endpoint URL</label>
                  <input 
                    type="text" 
                    value={localSettings.colabEndpoint}
                    onChange={(e) => handleChange('colabEndpoint', e.target.value)}
                    placeholder="https://<your-ngrok-url>.ngrok.io/generate"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-sm" 
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">L'URL del notebook Colab esposto tramite ngrok o simili.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-zinc-400">Modello Fallback Locale (Ollama)</label>
                    <button 
                      onClick={syncOllamaModels}
                      disabled={isSyncingOllama || !localSettings.ollamaUrl}
                      className="text-xs flex items-center gap-1 text-emerald-500 hover:text-emerald-400 disabled:opacity-50 disabled:hover:text-emerald-500 transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingOllama ? 'animate-spin' : ''}`} />
                      Sincronizza
                    </button>
                  </div>
                  
                  {ollamaSyncStatus === 'error' && (
                    <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded flex items-start gap-2 text-red-400 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p><strong>Impossibile connettersi a Ollama.</strong></p>
                        <ul className="list-disc list-inside pl-1 text-[10px] opacity-90">
                          <li>Verifica che Ollama sia in esecuzione.</li>
                          <li>Verifica che CORS sia abilitato (<code className="bg-red-500/20 px-1 rounded">OLLAMA_ORIGINS="*"</code>).</li>
                          <li>Se usi HTTPS, il browser potrebbe bloccare la richiesta (Mixed Content). In Chrome, clicca sull'icona del lucchetto nella barra degli indirizzi e consenti i contenuti non sicuri.</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  <select 
                    value={localSettings.fallbackModel}
                    onChange={(e) => handleChange('fallbackModel', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-sm"
                  >
                    {ollamaModels.length > 0 ? (
                      ollamaModels.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))
                    ) : (
                      <>
                        <option value="qwen3-4b-thinking-2507-gguf">qwen3-4b-thinking-2507-gguf (Deep Reasoning)</option>
                        <option value="qwen2:7b">qwen2:7b</option>
                        <option value="phi-3-mini">phi-3-mini</option>
                        <option value="llama-3.2-3b">llama-3.2-3b</option>
                      </>
                    )}
                  </select>
                  {ollamaModels.length > 0 && (
                    <p className="text-[10px] text-emerald-500/80 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Trovati {ollamaModels.length} modelli locali.
                    </p>
                  )}
                  <p className="text-xs text-zinc-500 mt-2">Il modello locale (Ollama) usato per task privati e ragionamenti complessi offline.</p>
                </div>

                <div className="pt-4 border-t border-zinc-800/50">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Edge Model (WebGPU/WASM)</label>
                  <select 
                    value={localSettings.edgeModel || 'bitnet-b1'}
                    onChange={(e) => handleChange('edgeModel', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-sm"
                  >
                    <option value="bitnet-b1">BitNet b1 (1.58-bit) - Ultra Light</option>
                    <option value="Xenova/Qwen1.5-0.5B-Chat">Qwen 0.5B (WebGPU)</option>
                  </select>
                  <p className="text-[10px] text-zinc-500 mt-1">Il modello ultra-leggero eseguito direttamente nel browser per routing e task istantanei.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Local Environment */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
            <Database className="w-5 h-5 text-blue-400" />
            <h3 className="font-medium text-zinc-100">Ambiente Locale</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Google Colab Endpoint (ngrok/localtunnel)</label>
              <input 
                type="text" 
                value={localSettings.colabEndpoint}
                onChange={(e) => handleChange('colabEndpoint', e.target.value)}
                placeholder="https://<your-ngrok-url>.ngrok.io/generate"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500" 
              />
              <p className="text-xs text-zinc-500 mt-2">URL per connettersi a un notebook Colab in esecuzione con un modello LLM.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Ollama URL</label>
              <input 
                type="text" 
                value={localSettings.ollamaUrl}
                onChange={(e) => handleChange('ollamaUrl', e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Obsidian Vault Path</label>
              <input 
                type="text" 
                value={localSettings.obsidianVaultPath}
                onChange={(e) => handleChange('obsidianVaultPath', e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Vault Firewall: Allowed Write Path</label>
              <input 
                type="text" 
                value={localSettings.allowedWritePath}
                onChange={(e) => handleChange('allowedWritePath', e.target.value)}
                placeholder="AI/Responses"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500" 
              />
              <p className="text-xs text-zinc-500 mt-2">Restringe la scrittura dei file solo a questa directory all'interno del Vault (previene sovrascritture accidentali).</p>
            </div>
          </div>
        </section>

        {/* Multi-Agent System */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
            <Server className="w-5 h-5 text-purple-400" />
            <h3 className="font-medium text-zinc-100">Multi-Agent System & LLM-CL</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-zinc-300">LLM-CL Protocol</label>
                <p className="text-xs text-zinc-500 mt-1">Abilita il protocollo di comunicazione compresso tra agenti.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={localSettings.llmclEnabled}
                  onChange={(e) => handleChange('llmclEnabled', e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Agent Polling Interval (ms)</label>
              <input 
                type="number" 
                value={localSettings.agentPollingInterval}
                onChange={(e) => handleChange('agentPollingInterval', parseInt(e.target.value))}
                step="1000" min="1000" max="60000" 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-purple-500" 
              />
              <p className="text-xs text-zinc-500 mt-2">Frequenza di aggiornamento della Dashboard per lo stato degli agenti e dei job.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
