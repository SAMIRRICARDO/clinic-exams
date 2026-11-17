import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth';
import { App } from './App';
import { loadClinicTimezone } from './api';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Nao bloqueia o primeiro render: a aplicacao monta com o fallback e o fuso
// configurado no backend e aplicado assim que /health responder.
void loadClinicTimezone();
