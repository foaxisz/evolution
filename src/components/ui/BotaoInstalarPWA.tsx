import { useState, useEffect } from 'react';
import { Download, Share, X, CheckCircle2, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
  const [promptEvt, setPromptEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [emStandalone, setEmStandalone] = useState(false);
  const [ehIOS, setEhIOS] = useState(false);

  useEffect(() => {
    // Verifica se já está rodando como PWA instalado em tela cheia
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    setEmStandalone(isStandalone);

    const isIosDevice = /iPhone|iPad|iPod/.test(navigator.userAgent);
    setEhIOS(isIosDevice);

    const aoDetectarPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', aoDetectarPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', aoDetectarPrompt);
    };
  }, []);

  const instalar = async () => {
    if (promptEvt) {
      await promptEvt.prompt();
      await promptEvt.userChoice;
      setPromptEvt(null);
    }
  };

  return { promptEvt, emStandalone, ehIOS, instalar };
}

export default function BotaoInstalarPWA() {
  const { promptEvt, emStandalone, ehIOS, instalar } = usePwaInstall();
  const [modalAberto, setModalAberto] = useState(false);

  if (emStandalone) return null;

  const handleClick = () => {
    if (promptEvt) {
      instalar();
    } else {
      setModalAberto(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-2.5 rounded-xl border border-accent/40 bg-accent/15 px-3 py-2 text-xs font-semibold text-accent-light transition-all hover:bg-accent/25 hover:border-accent"
      >
        <Download size={15} className="animate-bounce text-accent-light" />
        <span>Instalar App</span>
      </button>

      {/* Modal com instruções detalhadas se o prompt nativo não disparar automaticamente */}
      {modalAberto && (
        <ModalInstalacao
          ehIOS={ehIOS}
          temPrompt={!!promptEvt}
          onInstalarNativo={instalar}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </>
  );
}

/** Banner superior visível ao abrir o site no navegador */
export function BannerInstalarPWA() {
  const { promptEvt, emStandalone, ehIOS, instalar } = usePwaInstall();
  const [visivel, setVisivel] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    const dispensado = sessionStorage.getItem('evo_pwa_banner_fechado');
    if (dispensado === 'true') {
      setVisivel(false);
    }
  }, []);

  if (emStandalone || !visivel) return null;

  const fechar = () => {
    setVisivel(false);
    sessionStorage.setItem('evo_pwa_banner_fechado', 'true');
  };

  const handleAcao = () => {
    if (promptEvt) {
      instalar();
    } else {
      setModalAberto(true);
    }
  };

  return (
    <>
      <div className="bg-gradient-to-r from-accent/30 via-accent/20 to-accent/30 border-b border-accent/30 px-4 py-2.5 text-text-primary">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Smartphone size={16} className="text-accent-light flex-shrink-0 animate-pulse" />
            <span>
              Instale o <strong>Evolution</strong> no celular ou PC para usar como aplicativo offline.
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleAcao}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1 font-bold text-white shadow transition-transform hover:scale-105"
            >
              <Download size={13} />
              <span>Instalar</span>
            </button>
            <button
              onClick={fechar}
              className="p-1 text-text-muted hover:text-text-primary"
              title="Fechar"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>

      {modalAberto && (
        <ModalInstalacao
          ehIOS={ehIOS}
          temPrompt={!!promptEvt}
          onInstalarNativo={instalar}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </>
  );
}

function ModalInstalacao({
  ehIOS,
  temPrompt,
  onInstalarNativo,
  onFechar,
}: {
  ehIOS: boolean;
  temPrompt: boolean;
  onInstalarNativo: () => void;
  onFechar: () => void;
}) {
  return (
    <div
      onClick={onFechar}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-border bg-bg-card p-6 shadow-2xl animate-scale-in"
      >
        <button
          onClick={onFechar}
          className="absolute right-4 top-4 text-text-muted hover:text-text-primary"
        >
          <X size={18} />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-accent-light">
            <Download size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary">Instalar o Evolution</h3>
            <p className="text-xs text-text-muted">Aplicativo web rápido e offline</p>
          </div>
        </div>

        {temPrompt ? (
          <div className="space-y-4 text-xs text-text-secondary">
            <p>Seu navegador suporta a instalação direta em 1 clique!</p>
            <button
              onClick={() => {
                onInstalarNativo();
                onFechar();
              }}
              className="btn-grad flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg"
            >
              <Download size={16} />
              Confirmar Instalação
            </button>
          </div>
        ) : ehIOS ? (
          <div className="space-y-3 text-xs text-text-secondary">
            <p className="font-medium text-text-primary">No iPhone ou iPad (Safari):</p>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-input p-3">
              <Share size={20} className="text-accent-light flex-shrink-0" />
              <span>1. Toque no botão <strong>Compartilhar</strong> (quadrado com seta no rodapé do Safari).</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-input p-3">
              <CheckCircle2 size={20} className="text-success flex-shrink-0" />
              <span>2. Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-text-secondary">
            <p className="font-medium text-text-primary">No Android, Chrome ou Edge:</p>
            <div className="rounded-xl border border-border bg-bg-input p-3">
              1. Clique nos <strong>3 pontinhos (⋮)</strong> no canto superior direito do navegador.
            </div>
            <div className="rounded-xl border border-border bg-bg-input p-3">
              2. Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
            </div>
          </div>
        )}

        <button
          onClick={onFechar}
          className="mt-5 w-full rounded-xl border border-border bg-bg-secondary py-2 text-xs font-semibold text-text-secondary hover:text-text-primary"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
