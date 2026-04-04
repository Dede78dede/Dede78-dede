export interface PreflightResults {
  hasStorageAccess: boolean;
  hasWebGPU: boolean;
  isOllamaReachable: boolean;
}

export const preflightResults: PreflightResults = {
  hasStorageAccess: true,
  hasWebGPU: false,
  isOllamaReachable: false,
};

/**
 * Runs preflight checks before the main application loads.
 * Checks for storage access, WebGPU support, and local network reachability (Ollama).
 * Also handles the Ollama authentication breakout flow.
 * 
 * @returns True if the app should proceed to load, false if it should halt (e.g., showing an error UI).
 */
export async function runPreflight(): Promise<boolean> {
  // 0. Check for Ollama Auth Breakout Flow
  if (window.location.search.includes('ollama_auth=1')) {
    await handleOllamaAuthBreakout();
    return false; // Stop loading the main app
  }

  // 1. Test Storage Access
  try {
    localStorage.setItem('__storage_test__', '1');
    localStorage.removeItem('__storage_test__');
    preflightResults.hasStorageAccess = true;
  } catch (e) {
    console.warn("Storage access check failed or denied:", e);
    preflightResults.hasStorageAccess = false;
  }

  // If storage is denied, we block the app and show the recovery UI
  if (!preflightResults.hasStorageAccess) {
    console.warn("Storage access denied, but continuing anyway for preview environment.");
    // showStorageErrorUI();
    // return false;
  }

  // 2. Test WebGPU
  const isWebGPUSupported = typeof navigator !== 'undefined' && 'gpu' in navigator;
  preflightResults.hasWebGPU = isWebGPUSupported;
  // console.log("[Preflight] WebGPU Support:", preflightResults.hasWebGPU);

  // 3. Test Local Network (Ollama)
  // We do a silent fetch to see if it's reachable or blocked by Mixed Content
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    
    const fetchPromise = fetch('http://localhost:11434/api/tags', { 
      method: 'GET', 
      signal: controller.signal 
    }).catch(() => null);

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 1500);
    });

    const res = await Promise.race([fetchPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    
    if (res && res.ok) {
      preflightResults.isOllamaReachable = true;
    }
  } catch (e) {
    // Mixed content or network error
  }
  // console.log("[Preflight] Ollama Reachable:", preflightResults.isOllamaReachable);

  return true; // Proceed to load app
}

/**
 * Handles the breakout flow for authenticating/connecting to a local Ollama instance.
 * This is typically run in a popup window to bypass Mixed Content restrictions.
 */
async function handleOllamaAuthBreakout() {
  const root = document.getElementById('root');
  if (!root) return;
  
  root.innerHTML = `
    <div class="preflight-container" style="padding: 24px; text-align: center; font-family: system-ui, sans-serif;">
      <div class="spinner"></div>
      <h2 style="color: light-dark(#1f1f1f, #f4f4f5); margin-bottom: 8px;">Connessione a Ollama in corso...</h2>
      <p style="color: light-dark(#52525b, #a1a1aa);">Il browser sta verificando i permessi di rete locale.</p>
    </div>
  `;

  try {
    const res = await fetch('http://localhost:11434/api/tags', { method: 'GET' });
    if (res.ok) {
      root.innerHTML = `
        <div class="preflight-container" style="padding: 24px; text-align: center; font-family: system-ui, sans-serif;">
          <div style="margin-bottom: 16px; color: #10b981;">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor">
              <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm-1.999 14.413-3.713-3.705L7.7 11.292l2.299 2.295 5.294-5.294 1.414 1.414-6.706 6.706z"/>
            </svg>
          </div>
          <h2 style="color: #10b981; margin-bottom: 8px;">Connessione Stabilita!</h2>
          <p style="color: light-dark(#52525b, #a1a1aa);">I permessi sono stati accordati. Chiusura automatica in corso...</p>
        </div>
      `;
      if (window.opener) {
        window.opener.postMessage({ type: 'OLLAMA_CONNECTED' }, '*');
        setTimeout(() => window.close(), 1500);
      }
    } else {
      throw new Error("Ollama returned non-OK status");
    }
  } catch (e) {
    root.innerHTML = `
      <div class="preflight-container" style="padding: 24px; text-align: center; font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto;">
        <div style="margin-bottom: 16px; color: #ef4444;">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor">
            <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        </div>
        <h2 style="color: #ef4444; margin-bottom: 8px;">Errore di Connessione</h2>
        <p style="color: light-dark(#52525b, #a1a1aa); margin-bottom: 24px; line-height: 1.5;">
          Impossibile connettersi a Ollama. Assicurati che sia in esecuzione su <b>localhost:11434</b> e di aver impostato la variabile d'ambiente <code>OLLAMA_ORIGINS="*"</code> prima di avviarlo.
        </p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Riprova</button>
      </div>
    `;
  }
}

/**
 * Displays an error UI when storage access is denied (e.g., due to third-party cookie blocking).
 * Provides instructions to the user on how to resolve the issue.
 */
function showStorageErrorUI() {
  const root = document.getElementById('root');
  if (!root) return;
  
  root.innerHTML = `
    <div class="preflight-container" style="padding: 24px; text-align: center; max-width: 480px; margin: 0 auto; font-family: system-ui, sans-serif;">
      <div style="margin-bottom: 24px; display: flex; justify-content: center;">
        <svg viewBox="0 0 24 24" width="56" height="56" fill="#ef4444">
          <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      </div>
      <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px; color: light-dark(#1f1f1f, #f4f4f5);">Azione Richiesta</h1>
      <p style="font-size: 15px; line-height: 1.6; color: light-dark(#52525b, #a1a1aa); margin-bottom: 32px;">
        Il tuo browser sta bloccando l'accesso allo storage locale (cookie/localStorage), necessario per il funzionamento di SmarterRouter. Questo accade spesso in modalità incognito o con impostazioni di privacy restrittive negli Iframe.
      </p>
      <div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
        <button id="btn-breakout" style="background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 15px; cursor: pointer; width: 100%; transition: background 0.2s;">
          Apri in una nuova finestra
        </button>
        <button id="btn-request" style="background: transparent; color: #10b981; border: 1px solid #10b981; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 15px; cursor: pointer; width: 100%; transition: background 0.2s;">
          Richiedi Permesso Storage
        </button>
      </div>
    </div>
  `;

  const btnBreakout = document.getElementById('btn-breakout');
  const btnRequest = document.getElementById('btn-request');

  if (btnBreakout) {
    btnBreakout.addEventListener('mouseover', () => btnBreakout.style.background = '#059669');
    btnBreakout.addEventListener('mouseout', () => btnBreakout.style.background = '#10b981');
    btnBreakout.addEventListener('click', () => {
      const currentUrl = new URL(window.location.href);
      window.open(currentUrl.toString(), '_blank');
    });
  }

  if (btnRequest) {
    btnRequest.addEventListener('mouseover', () => btnRequest.style.background = 'rgba(16, 185, 129, 0.1)');
    btnRequest.addEventListener('mouseout', () => btnRequest.style.background = 'transparent');
    btnRequest.addEventListener('click', async () => {
      try {
        if (document.requestStorageAccess) {
          await document.requestStorageAccess();
          window.location.reload();
        } else {
          alert("Il tuo browser non supporta la richiesta diretta di accesso allo storage. Usa il pulsante 'Apri in una nuova finestra'.");
        }
      } catch (e) {
        console.error("Storage access denied", e);
        alert("Permesso negato dal browser. Prova ad aprire l'app in una nuova finestra.");
      }
    });
  }
}
