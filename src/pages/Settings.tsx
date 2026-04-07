import React from 'react';
import { Save, Server, Database, Shield, CheckCircle2, RefreshCw, AlertCircle, Command, User, Plus, Trash2, Box, Loader2, Cloud, UploadCloud, DownloadCloud } from 'lucide-react';
import { SyncStatus, KnownModelId } from '../core/enums';
import { authenticatedFetch } from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useSettingsLogic, WEBLLM_MODELS } from '../features/settings/hooks/useSettingsLogic';

/**
 * Settings page component.
 * Allows users to configure application settings, including API keys,
 * default models, Ollama integration, and caching preferences.
 */
export const Settings = React.memo(function Settings() {
  const {
    localSettings,
    isSaved,
    ollamaModels,
    isSyncingOllama,
    ollamaSyncStatus,
    notification,
    ragStatus,
    webLlmCacheStatus,
    isCheckingCache,
    syncStatus,
    isGoogleDriveConnected,
    lastBackupTime,
    handleChange,
    handleSave,
    addMacro,
    updateMacro,
    deleteMacro,
    addProfile,
    updateProfile,
    deleteProfile,
    syncOllamaModels,
    checkWebLlmCache,
    deleteWebLlmModel,
    showNotification,
    connectGoogleDrive,
    disconnectGoogleDrive,
    triggerManualBackup,
    restoreLatestBackup
  } = useSettingsLogic();

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
        <Button 
          onClick={handleSave}
          className="flex items-center gap-2 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
        >
          {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {isSaved ? 'Salvato' : 'Salva Modifiche'}
        </Button>
      </header>

      <div className="space-y-6">
        {/* Routing Settings */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center gap-3 border-b border-zinc-800 pb-4">
            <Server className="w-5 h-5 text-emerald-400" />
            <CardTitle>SmarterRouter Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <Label className="text-zinc-300 mb-2 block">Quality Preference (0.0 - 1.0)</Label>
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
                <Label className="text-zinc-300 block">Privacy Mode (Local Only)</Label>
                <p className="text-xs text-zinc-500 mt-1">Forza l'uso esclusivo di modelli locali per garantire la privacy dei dati.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={localSettings.requireLocalPrivacy}
                  onChange={(e) => handleChange('requireLocalPrivacy', e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div>
              <Label className="text-zinc-300 mb-2 block">Budget Massimo (USD per 1k token)</Label>
              <div className="flex items-center gap-4">
                <Input 
                  type="number" 
                  step="0.001"
                  min="0"
                  value={localSettings.maxCostPer1kTokens}
                  onChange={(e) => handleChange('maxCostPer1kTokens', parseFloat(e.target.value))}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 focus-visible:ring-emerald-500" 
                />
              </div>
              <p className="text-xs text-zinc-500 mt-2">Imposta il costo massimo consentito per i modelli cloud. I modelli più costosi verranno ignorati.</p>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-zinc-300 block">Semantic Cache</Label>
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

            <div className="flex items-center justify-between border-t border-zinc-800 pt-6">
              <div>
                <Label className="text-zinc-300 block">RAG Locale (Privacy 100%)</Label>
                <p className="text-xs text-zinc-500 mt-1">Usa i tuoi documenti locali come contesto per le risposte.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={localSettings.useLocalRag}
                  onChange={(e) => handleChange('useLocalRag', e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            
            {localSettings.useLocalRag && (
              <div className="bg-zinc-950/50 p-4 rounded-lg border border-zinc-800 space-y-4">
                <div>
                  <Label className="text-zinc-400 mb-1 block">Percorso Vault Obsidian</Label>
                  <Input 
                    type="text" 
                    value={localSettings.obsidianVaultPath}
                    onChange={(e) => handleChange('obsidianVaultPath', e.target.value)}
                    placeholder="/Users/nome/Documents/Obsidian"
                    className="bg-zinc-900 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-500">
                    {ragStatus && (
                      <span className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5" />
                        {ragStatus.isIndexing ? (
                          <span className="text-emerald-500 animate-pulse">Indicizzazione in corso... ({ragStatus.totalChunks} frammenti)</span>
                        ) : (
                          <span>Stato: Pronto ({ragStatus.totalChunks} frammenti indicizzati)</span>
                        )}
                      </span>
                    )}
                  </div>
                  <Button 
                    onClick={async () => {
                      try {
                        showNotification('Avvio indicizzazione...', 'success');
                        const res = await authenticatedFetch('/api/rag/index', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ vaultPath: localSettings.obsidianVaultPath })
                        });
                        if (!res.ok) throw new Error(await res.text());
                        showNotification('Indicizzazione avviata in background.', 'success');
                      } catch (e: any) {
                        showNotification(`Errore: ${e.message}`, 'error');
                      }
                    }}
                    disabled={ragStatus?.isIndexing}
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-300"
                  >
                    {ragStatus?.isIndexing ? 'Indicizzazione...' : 'Indicizza Vault Ora'}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-zinc-800 pt-6">
              <div>
                <Label className="text-zinc-300 mb-2 block">Cache Similarity Threshold</Label>
                <Input 
                  type="number" 
                  value={localSettings.cacheSimilarityThreshold}
                  onChange={(e) => handleChange('cacheSimilarityThreshold', parseFloat(e.target.value))}
                  step="0.05" min="0" max="1" 
                  className="bg-zinc-950 border-zinc-800 text-zinc-200 w-32 focus-visible:ring-emerald-500" 
                />
              </div>
              <Button 
                onClick={() => {
                  import('../services/MemorySystem').then(async ({ memorySystem }) => {
                    await memorySystem.clearCache();
                    showNotification('Cache svuotata con successo!');
                  });
                }}
                variant="destructive"
                className="bg-red-500/10 text-red-400 hover:bg-red-500/20"
              >
                Svuota Cache
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Profiles Management */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-indigo-400" />
              <CardTitle>Profili Utente (Personas)</CardTitle>
            </div>
            <Button onClick={addProfile} variant="outline" size="sm" className="h-8 bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700">
              <Plus className="w-3 h-3 mr-1" /> Aggiungi Profilo
            </Button>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {localSettings.profiles.map(profile => (
              <div key={profile.id} className="p-4 border border-zinc-800 rounded-lg space-y-4 bg-zinc-950/50">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-4">
                    <div>
                      <Label className="text-zinc-400 mb-1 block">Nome Profilo</Label>
                      <Input 
                        type="text" 
                        value={profile.name}
                        onChange={(e) => updateProfile(profile.id, 'name', e.target.value)}
                        className="bg-zinc-900 border-zinc-800 text-zinc-200 focus-visible:ring-indigo-500" 
                      />
                    </div>
                    <div>
                      <Label className="text-zinc-400 mb-1 block">System Prompt (Istruzioni)</Label>
                      <textarea 
                        value={profile.systemPrompt}
                        onChange={(e) => updateProfile(profile.id, 'systemPrompt', e.target.value)}
                        rows={3}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500 text-sm resize-none" 
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={() => deleteProfile(profile.id)}
                    variant="ghost"
                    size="icon"
                    className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                    title="Elimina profilo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Macros Management */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <Command className="w-5 h-5 text-emerald-400" />
              <CardTitle>Macro (Slash Commands)</CardTitle>
            </div>
            <Button onClick={addMacro} variant="outline" size="sm" className="h-8 bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700">
              <Plus className="w-3 h-3 mr-1" /> Aggiungi Macro
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {localSettings.macros.map(macro => (
              <div key={macro.id} className="flex flex-col md:flex-row gap-4 p-4 border border-zinc-800 rounded-lg bg-zinc-950/50 items-start">
                <div className="w-full md:w-1/4 space-y-2">
                  <Input 
                    type="text" 
                    value={macro.trigger}
                    onChange={(e) => updateMacro(macro.id, 'trigger', e.target.value)}
                    placeholder="/comando"
                    className="bg-zinc-900 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500 font-mono" 
                  />
                  <Input 
                    type="text" 
                    value={macro.label}
                    onChange={(e) => updateMacro(macro.id, 'label', e.target.value)}
                    placeholder="Descrizione breve"
                    className="bg-zinc-900 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500 text-xs" 
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
                <Button 
                  onClick={() => deleteMacro(macro.id)}
                  variant="ghost"
                  size="icon"
                  className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 self-end md:self-start"
                  title="Elimina macro"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Master & Fallback */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-indigo-400" />
              <CardTitle>Master Cloud Models & API Keys</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <Label className="text-zinc-300 mb-2 block">Modello Master Predefinito</Label>
              <select 
                value={localSettings.masterModel}
                onChange={(e) => handleChange('masterModel', e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-sm"
              >
                <option value={KnownModelId.GEMINI_2_5_FLASH}>Gemini 2.5 Flash (Google) - Consigliato</option>
                <option value={KnownModelId.GEMINI_3_1_PRO}>Gemini 3.1 Pro (Google)</option>
                <option value={KnownModelId.GPT_4O}>GPT-4o (OpenAI)</option>
                <option value={KnownModelId.CLAUDE_3_5_SONNET}>Claude 3.5 Sonnet (Anthropic)</option>
                <option value={KnownModelId.LLAMA_3_70B}>Llama 3 70B (Groq)</option>
                <option value={KnownModelId.DEEPSEEK_CHAT}>DeepSeek Chat</option>
              </select>
              <p className="text-xs text-zinc-500 mt-2">Il modello cloud principale utilizzato dallo SmarterRouter per task complessi e contesti ampi (RAG).</p>
            </div>

            <div className="pt-4 border-t border-zinc-800/50">
              <h4 className="text-sm font-medium text-zinc-400 mb-4">Chiavi API (Salvate localmente nel tuo profilo)</h4>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-zinc-400 mb-1 block">Gemini API Key</Label>
                  <Input 
                    type="password" 
                    value="************************"
                    disabled
                    className="bg-zinc-950/50 border-zinc-800/50 text-zinc-600 cursor-not-allowed" 
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Gestita automaticamente dall'ambiente AI Studio.</p>
                </div>

                <div>
                  <Label className="text-zinc-400 mb-1 block">OpenAI API Key</Label>
                  <Input 
                    type="password" 
                    value={localSettings.openAiApiKey}
                    onChange={(e) => handleChange('openAiApiKey', e.target.value)}
                    placeholder="sk-..."
                    className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500" 
                  />
                </div>

                <div>
                  <Label className="text-zinc-400 mb-1 block">Anthropic API Key</Label>
                  <Input 
                    type="password" 
                    value={localSettings.anthropicApiKey}
                    onChange={(e) => handleChange('anthropicApiKey', e.target.value)}
                    placeholder="sk-ant-..."
                    className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500" 
                  />
                </div>

                <div>
                  <Label className="text-zinc-400 mb-1 block">Groq API Key</Label>
                  <Input 
                    type="password" 
                    value={localSettings.groqApiKey}
                    onChange={(e) => handleChange('groqApiKey', e.target.value)}
                    placeholder="gsk_..."
                    className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500" 
                  />
                </div>

                <div>
                  <Label className="text-zinc-400 mb-1 block">DeepSeek API Key</Label>
                  <Input 
                    type="password" 
                    value={localSettings.deepseekApiKey}
                    onChange={(e) => handleChange('deepseekApiKey', e.target.value)}
                    placeholder="sk-..."
                    className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500" 
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800/50">
              <h4 className="text-sm font-medium text-zinc-400 mb-4">Endpoint Locali e Remoti</h4>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-zinc-400 mb-1 block">Ollama URL</Label>
                  <Input 
                    type="text" 
                    value={localSettings.ollamaUrl}
                    onChange={(e) => handleChange('ollamaUrl', e.target.value)}
                    placeholder="http://localhost:11434"
                    className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500" 
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
                  <Label className="text-zinc-400 mb-1 block">Colab Endpoint URL</Label>
                  <Input 
                    type="text" 
                    value={localSettings.colabEndpoint}
                    onChange={(e) => handleChange('colabEndpoint', e.target.value)}
                    placeholder="https://<your-ngrok-url>.ngrok.io/generate"
                    className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500" 
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">L'URL del notebook Colab esposto tramite ngrok o simili.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-zinc-400 block">Modello Fallback Locale (Ollama)</Label>
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
                  <Label className="text-zinc-400 mb-1 block">Edge Model (WebGPU/WASM)</Label>
                  <select 
                    value={localSettings.edgeModel || KnownModelId.BITNET_B1}
                    onChange={(e) => handleChange('edgeModel', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-sm"
                  >
                    <option value={KnownModelId.BITNET_B1}>BitNet b1 (1.58-bit) - Ultra Light</option>
                    <option value={KnownModelId.QWEN_0_5B_WEBGPU}>Qwen 0.5B (WebGPU)</option>
                    <option value={KnownModelId.GEMINI_4_EDGE}>Gemma 4 (Edge)</option>
                  </select>
                  <p className="text-[10px] text-zinc-500 mt-1">Il modello ultra-leggero eseguito direttamente nel browser per routing e task istantanei.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WebLLM Model Management */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <Box className="w-5 h-5 text-orange-400" />
              <CardTitle>Modelli Locali nel Browser (WebLLM)</CardTitle>
            </div>
            <Button 
              onClick={checkWebLlmCache}
              disabled={isCheckingCache}
              variant="ghost"
              size="sm"
              className="h-8 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isCheckingCache ? 'animate-spin' : ''}`} />
              Aggiorna Stato
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-zinc-400 mb-4">
              I modelli WebLLM vengono scaricati ed eseguiti direttamente nella cache del tuo browser utilizzando WebGPU. 
              Puoi gestire lo spazio occupato eliminando i modelli che non utilizzi.
            </p>
            
            <div className="space-y-3">
              {WEBLLM_MODELS.map(model => {
                const isCached = webLlmCacheStatus[model.id];
                return (
                  <div key={model.id} className="flex items-center justify-between p-3 border border-zinc-800 rounded-lg bg-zinc-950/50">
                    <div>
                      <h4 className="text-sm font-medium text-zinc-200">{model.name}</h4>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">{model.id}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {isCheckingCache ? (
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Verifica...
                        </span>
                      ) : isCached ? (
                        <span className="text-xs text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Scaricato
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">
                          Non scaricato
                        </span>
                      )}
                      
                      <Button
                        onClick={() => deleteWebLlmModel(model.id)}
                        disabled={!isCached || isCheckingCache}
                        variant="ghost"
                        size="icon"
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:text-zinc-500"
                        title="Elimina dalla cache"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Local Environment */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-blue-400" />
              <CardTitle>Ambiente Locale</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <Label className="text-zinc-300 mb-2 block">Google Colab Endpoint (ngrok/localtunnel)</Label>
              <Input 
                type="text" 
                value={localSettings.colabEndpoint}
                onChange={(e) => handleChange('colabEndpoint', e.target.value)}
                placeholder="https://<your-ngrok-url>.ngrok.io/generate"
                className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500" 
              />
              <p className="text-xs text-zinc-500 mt-2">URL per connettersi a un notebook Colab in esecuzione con un modello LLM.</p>
            </div>
            <div>
              <Label className="text-zinc-300 mb-2 block">Ollama URL</Label>
              <Input 
                type="text" 
                value={localSettings.ollamaUrl}
                onChange={(e) => handleChange('ollamaUrl', e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500" 
              />
            </div>
            <div>
              <Label className="text-zinc-300 mb-2 block">Obsidian Vault Path</Label>
              <Input 
                type="text" 
                value={localSettings.obsidianVaultPath}
                onChange={(e) => handleChange('obsidianVaultPath', e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500" 
              />
            </div>
            <div>
              <Label className="text-zinc-300 mb-2 block">Vault Firewall: Allowed Write Path</Label>
              <Input 
                type="text" 
                value={localSettings.allowedWritePath}
                onChange={(e) => handleChange('allowedWritePath', e.target.value)}
                placeholder="AI/Responses"
                className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-emerald-500" 
              />
              <p className="text-xs text-zinc-500 mt-2">Restringe la scrittura dei file solo a questa directory all'interno del Vault (previene sovrascritture accidentali).</p>
            </div>
          </CardContent>
        </Card>

        {/* Multi-Agent System */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-purple-400" />
              <CardTitle>Multi-Agent System & LLM-CL</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-zinc-300 block">LLM-CL Protocol</Label>
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
              <Label className="text-zinc-300 mb-2 block">Agent Polling Interval (ms)</Label>
              <Input 
                type="number" 
                value={localSettings.agentPollingInterval}
                onChange={(e) => handleChange('agentPollingInterval', parseInt(e.target.value))}
                step="1000" min="1000" max="60000" 
                className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-purple-500" 
              />
              <p className="text-xs text-zinc-500 mt-2">Frequenza di aggiornamento della Dashboard per lo stato degli agenti e dei job.</p>
            </div>
          </CardContent>
        </Card>
        {/* Backup & Sync System */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <Cloud className="w-5 h-5 text-sky-400" />
              <CardTitle>Backup & Sincronizzazione</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-4">
              <div>
                <Label className="text-zinc-400 mb-1 block">Google Client ID</Label>
                <Input 
                  type="text" 
                  value={localSettings.googleDriveClientId}
                  onChange={(e) => handleChange('googleDriveClientId', e.target.value)}
                  placeholder="xxxx-xxxx.apps.googleusercontent.com"
                  className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-sky-500" 
                />
              </div>
              <div>
                <Label className="text-zinc-400 mb-1 block">Google API Key</Label>
                <Input 
                  type="password" 
                  value={localSettings.googleDriveApiKey}
                  onChange={(e) => handleChange('googleDriveApiKey', e.target.value)}
                  placeholder="AIzaSy..."
                  className="bg-zinc-950 border-zinc-800 text-zinc-200 focus-visible:ring-sky-500" 
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800 pt-6">
              <div>
                <Label className="text-zinc-300 block">Google Drive Sync</Label>
                <p className="text-xs text-zinc-500 mt-1">Sincronizza automaticamente le configurazioni e i modelli su Google Drive.</p>
              </div>
              <div className="flex items-center gap-3">
                {isGoogleDriveConnected ? (
                  <Button
                    onClick={disconnectGoogleDrive}
                    variant="ghost"
                    size="sm"
                    className="h-8 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                  >
                    Disconnetti
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (!localSettings.googleDriveClientId || !localSettings.googleDriveApiKey) {
                        showNotification('Inserisci Client ID e API Key per connettere Google Drive.', 'error');
                        return;
                      }
                      connectGoogleDrive({
                        clientId: localSettings.googleDriveClientId,
                        apiKey: localSettings.googleDriveApiKey,
                        scopes: 'https://www.googleapis.com/auth/drive.appdata',
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
                      });
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-8 bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 hover:text-sky-300"
                  >
                    Connetti Drive
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800 pt-6">
              <div>
                <Label className="text-zinc-300 block">Stato Sincronizzazione</Label>
                <div className="flex items-center gap-2 mt-1">
                  {syncStatus === SyncStatus.SYNCING && <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />}
                  {syncStatus === SyncStatus.SUCCESS && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  {syncStatus === SyncStatus.ERROR && <AlertCircle className="w-3 h-3 text-red-400" />}
                  <span className="text-xs text-zinc-400">
                    {syncStatus === SyncStatus.IDLE && 'In attesa'}
                    {syncStatus === SyncStatus.SYNCING && 'Sincronizzazione in corso...'}
                    {syncStatus === SyncStatus.SUCCESS && 'Sincronizzato'}
                    {syncStatus === SyncStatus.ERROR && 'Errore di sincronizzazione'}
                  </span>
                </div>
                {lastBackupTime && (
                  <p className="text-[10px] text-zinc-500 mt-1">Ultimo backup: {new Date(lastBackupTime).toLocaleString()}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={triggerManualBackup}
                  disabled={syncStatus === SyncStatus.SYNCING}
                  variant="outline"
                  size="sm"
                  className="h-8 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                >
                  <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                  Backup Ora
                </Button>
                <Button
                  onClick={restoreLatestBackup}
                  disabled={syncStatus === SyncStatus.SYNCING}
                  variant="outline"
                  size="sm"
                  className="h-8 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                >
                  <DownloadCloud className="w-3.5 h-3.5 mr-1.5" />
                  Ripristina
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
