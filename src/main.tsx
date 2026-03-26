import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import { runPreflight } from './preflight';
import { ErrorBoundary } from './components/ErrorBoundary';

/**
 * Application entry point.
 * Runs preflight checks before rendering the React application.
 * Wraps the application in an ErrorBoundary to catch unhandled errors.
 */
runPreflight().then(async (canProceed) => {
  document.getElementById('root')!.innerHTML = '<div style="padding: 20px;">Preflight done. Loading App...</div>';
  if (canProceed) {
    try {
      const { default: App } = await import('./App.tsx');
      document.getElementById('root')!.innerHTML = '<div style="padding: 20px;">App loaded. Rendering...</div>';
      createRoot(document.getElementById('root')!).render(
        <StrictMode>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </StrictMode>,
      );
    } catch (err: any) {
      console.error("Failed to load App module:", err);
      document.getElementById('root')!.innerHTML = `
        <div style="padding: 20px; color: red; font-family: sans-serif;">
          <h2>Module Evaluation Error</h2>
          <pre>${err.stack || err.message || String(err)}</pre>
        </div>
      `;
    }
  }
}).catch((error) => {
  console.error("Preflight failed:", error);
  document.getElementById('root')!.innerHTML = `
    <div style="padding: 20px; color: red; font-family: sans-serif;">
      <h2>Critical Error during startup</h2>
      <pre>${error.message}</pre>
    </div>
  `;
});
