import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.tsx';

/**
 * Atualização do app instalado.
 *
 * `onNeedRefresh` sozinho não basta: ele só dispara quando o navegador
 * resolve checar se há service worker novo, e num PWA instalado isso pode
 * demorar muito — o aparelho fica rodando uma versão antiga por dias sem
 * ninguém perceber. Num app com sincronização isso é grave: os dois lados
 * precisam falar o mesmo protocolo, e o aparelho velho estraga o dado do
 * outro sem dar sinal.
 *
 * Por isso a checagem é forçada de hora em hora e sempre que o app volta
 * ao primeiro plano — que é quando a pessoa está prestes a usar.
 */
const DE_HORA_EM_HORA = 60 * 60 * 1000;

const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true);
  },
  immediate: true,
  onRegisteredSW(_url, registro) {
    if (!registro) return;
    const conferir = () => { registro.update().catch(() => {}); };
    setInterval(conferir, DE_HORA_EM_HORA);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') conferir();
    });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
