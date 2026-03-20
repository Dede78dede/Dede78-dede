import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';

// 1. Definizione dei tipi (TypeScript Best Practices)

// Rappresenta un comando rapido
export interface Macro {
  id: string;
  trigger: string;      // es. "refactor" (usato come /refactor)
  label: string;        // es. "Refactoring del Codice"
  template: string;     // Il prompt esteso che sostituirà il trigger
}

// Rappresenta un contesto operativo
export interface Profile {
  id: string;
  name: string;         // es. "Coder", "Writer", "Default"
  icon: string;         // Nome dell'icona Lucide
  masterModel?: string;  // Override del modello cloud (es. gemini-2.5-flash)
  fallbackModel?: string;// Override del modello locale (es. qwen3-4b-thinking)
  systemPrompt?: string; // Istruzioni di sistema specifiche per questo profilo
}

export interface AppSettings {
  routerQualityPreference: number;
  semanticCacheEnabled: boolean;
  cacheSimilarityThreshold: number;
  masterModel: string;
  openAiApiKey: string;
  anthropicApiKey: string;
  groqApiKey: string;
  deepseekApiKey: string;
  fallbackModel: string;
  edgeModel: string;
  ollamaUrl: string;
  obsidianVaultPath: string;
  allowedWritePath: string;
  colabEndpoint: string;
  llmclEnabled: boolean;
  agentPollingInterval: number;
  macros: Macro[];
  profiles: Profile[];
  activeProfileId: string;
  requireLocalPrivacy: boolean;
  maxCostPer1kTokens: number;
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

// 2. Valori di default
export const defaultMacros: Macro[] = [
  {
    id: 'macro-1',
    trigger: 'daily',
    label: 'Daily Briefing',
    template: 'Analizza le mie note Obsidian di oggi e crea un riassunto dei task aperti.'
  },
  {
    id: 'macro-2',
    trigger: 'refactor',
    label: 'Refactoring del Codice',
    template: 'Analizza il seguente codice, individua vulnerabilità e riscrivilo applicando i principi SOLID:\n\n'
  },
  {
    id: 'macro-3',
    trigger: 'eli5',
    label: 'Spiega come a un bambino (ELI5)',
    template: 'Spiega questo concetto in modo semplice, come se parlassi a un bambino di 5 anni:\n\n'
  }
];

export const defaultProfiles: Profile[] = [
  {
    id: 'profile-default',
    name: 'Default',
    icon: 'Bot',
    masterModel: 'gemini-2.5-flash',
    fallbackModel: 'qwen2:7b',
    systemPrompt: 'Sei un assistente AI esperto, parte di una piattaforma LLM avanzata (SmarterRouter). Rispondi in modo conciso e professionale in italiano.\nSe ti viene chiesto di creare un file, usa il protocollo LLM-CL per indicare l\'azione. Formato: @v1.0{#create_file #filename "nome_file.md" #content "contenuto del file"}'
  },
  {
    id: 'profile-thinker',
    name: 'Deep Thinker',
    icon: 'Brain',
    masterModel: 'gemini', // gemini-3.1-pro-preview
    fallbackModel: 'qwen3-4b-thinking-2507-gguf',
    systemPrompt: 'Sei un analista profondo. Rifletti attentamente prima di rispondere, esplorando tutte le sfumature del problema. Mostra il tuo ragionamento passo passo.'
  },
  {
    id: 'profile-coder',
    name: 'Coder',
    icon: 'Code',
    masterModel: 'anthropic', // Claude 3.5 Sonnet
    fallbackModel: 'qwen3-4b-thinking-2507-gguf',
    systemPrompt: 'Sei un Senior Software Engineer. Scrivi codice pulito, efficiente e ben documentato. Usa sempre le best practice e i design pattern appropriati. Rispondi principalmente con blocchi di codice.'
  }
];

const defaultSettings: AppSettings = {
  routerQualityPreference: 0.5,
  semanticCacheEnabled: true,
  cacheSimilarityThreshold: 0.85,
  masterModel: 'gemini-2.5-flash',
  openAiApiKey: '',
  anthropicApiKey: '',
  groqApiKey: '',
  deepseekApiKey: '',
  fallbackModel: 'qwen2:7b',
  edgeModel: 'bitnet-b1',
  ollamaUrl: 'http://localhost:11434',
  obsidianVaultPath: '/Users/dev/Obsidian/LLM-Platform',
  allowedWritePath: 'AI/Responses',
  colabEndpoint: 'https://<your-ngrok-url>.ngrok.io/generate',
  llmclEnabled: true,
  agentPollingInterval: 5000,
  macros: defaultMacros,
  profiles: defaultProfiles,
  activeProfileId: 'profile-default',
  requireLocalPrivacy: false,
  maxCostPer1kTokens: 0.01,
};

// 3. Helper per Cookie Partizionati (CHIPS)
const SETTINGS_KEY = 'smarter_router_settings';

function getCookie(name: string): string | null {
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i].trim();
    if (cookie.startsWith(name + '=')) {
      return decodeURIComponent(cookie.substring(name.length + 1));
    }
  }
  return null;
}

function setCookie(name: string, value: string) {
  // Max-Age=31536000 (1 year). Secure, SameSite=None and Partitioned are required for CHIPS.
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Secure; SameSite=None; Partitioned; Max-Age=31536000;`;
}

function loadSettings(): AppSettings {
  try {
    // 1. Try localStorage first (fastest)
    const local = localStorage.getItem(SETTINGS_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      // Sync to cookie just in case it was cleared
      setCookie(SETTINGS_KEY, local);
      
      // Migration logic: ensure new fields exist in old saves
      const merged = { ...defaultSettings, ...parsed };
      if (!merged.macros) merged.macros = defaultMacros;
      if (!merged.profiles) merged.profiles = defaultProfiles;
      if (!merged.activeProfileId) merged.activeProfileId = 'profile-default';
      
      return merged;
    }
    
    // 2. Fallback to Partitioned Cookie (if localStorage was cleared by Iframe policy)
    const cookie = getCookie(SETTINGS_KEY);
    if (cookie) {
      const parsed = JSON.parse(cookie);
      // Restore to localStorage
      localStorage.setItem(SETTINGS_KEY, cookie);
      // console.log("[Storage] Restored settings from Partitioned Cookie");
      
      // Migration logic
      const merged = { ...defaultSettings, ...parsed };
      if (!merged.macros) merged.macros = defaultMacros;
      if (!merged.profiles) merged.profiles = defaultProfiles;
      if (!merged.activeProfileId) merged.activeProfileId = 'profile-default';
      
      return merged;
    }
  } catch (e) {
    console.warn("[Storage] Failed to load settings, using defaults", e);
  }
  return defaultSettings;
}

// 4. Creazione del Context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

/**
 * SettingsProvider manages the global application settings.
 * It uses a hybrid storage approach (LocalStorage + Partitioned Cookies)
 * to ensure settings persist even in restrictive iframe environments (like AI Studio).
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  // Inizializza leggendo dallo storage ibrido
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  /**
   * Updates the settings state and persists the changes to both
   * LocalStorage and Partitioned Cookies.
   * 
   * @param newSettings A partial object containing the settings to update.
   */
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        const serialized = JSON.stringify(updated);
        // Salva in entrambi i layer di storage
        localStorage.setItem(SETTINGS_KEY, serialized);
        setCookie(SETTINGS_KEY, serialized);
      } catch (e) {
        console.warn("[Storage] Failed to save settings", e);
      }
      return updated;
    });
  }, []);

  const contextValue = useMemo(() => ({
    settings,
    updateSettings
  }), [settings, updateSettings]);

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

// 6. Custom Hook per l'accesso (Fail Fast se usato fuori dal Provider)
/**
 * Custom hook to access the settings context.
 * Must be used within a SettingsProvider.
 */
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings deve essere usato all\'interno di un SettingsProvider');
  }
  return context;
}
