import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { runPreflight } from './preflight';
import { ErrorBoundary } from './components/ErrorBoundary';

/**
 * Application entry point.
 * Runs preflight checks before rendering the React application.
 * Wraps the application in an ErrorBoundary to catch unhandled errors.
 */
runPreflight().then((canProceed) => {
  if (canProceed) {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  }
});
