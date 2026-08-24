import { useState, useEffect } from 'react';
import { Download, Share, X, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
  const [promptEvt, setPromptEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [ehIOS, setEhIOS] = useState(false);

  useEffect(() => {
    // Verifica se já está rodando como PWA (instalado)
    const emStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (emStandalone) {
      setInstalado(true);
      return;
    }

    // Detecta se é iOS (iPhone/iPad)
    const isIosDevice = /iPhone|iPad|iPod/.test(navigator.userAgent) && !emStandalone;
    setEhIOS(isIosDevice);

    const aoDetectarPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', aoDetectarPrompt);
    window.addEventListener('appinstalled', () => setInstalado(true));

    return () => {
      window.removeEventListener('beforeinstallprompt', aoDetectarPrompt);
    };
  }, []);

  const instalar = async () => {
    if (promptEvt) {
      await promptEvt.prompt();
      const escolha = await promptEvt.userChoice;
      if (escolha.outcome === 'accepted') {
        setInstalado(true);
      }
      setPromptEvt(null);
    }
  };

  return { promptEvt, instalado, ehIOS, instalar };
}

export default function BotaoInstalarPWA({ modalOnly = false }: { modalOnly?: boolean }) {
  const { promptEvt, instalado, ehIOS, instalar } = usePwaInstall();
  const [modalIOSAberto, setModalIOSAberto] = useState(false);

  if (instalado) return null;

  // Se não tem evento nativo e não é iOS, exibe botão que aciona orientação genérica
  const handleClick = () => {
    if (promptEvt) {
      instalar();
    } else {
      setModalIOSAberto(true);
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

      {/* Modal com guia para iOS / Navegadores sem prompt direto */}
      {modalIOSAberto && (
        <div
          onClick={() => setModalIOSAberto(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-border bg-bg-card p-6 shadow-2xl animate-scale-in"
          >
            <button
              onClick={() => setModalIOSAberto(false)}
              className="absolute right-4 top-4 text-text-muted hover:text-text-primary"
            >
              <X size={18} />
            </button>

            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent-light">
                <Download size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Instalar o Evolution</h3>
                <p className="text-xs text-text-muted">Como aplicativo na tela inicial</p>
              </div>
            </div>

            {ehIOS ? (
              <div className="space-y-3 text-xs text-text-secondary">
                <p>No iPhone / iPad, a instalação é feira pelo Safari:</p>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-input p-3">
                  <Share size={20} className="text-accent-light flex-shrink-0" />
                  <span>1. Toque no botão <strong>Compartilhar</strong> (no rodapé do Safari).</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-input p-3">
                  <CheckCircle2 size={20} className="text-success flex-shrink-0" />
                  <span>2. Role a lista e selecione <strong>Adicionar à Tela de Início</strong>.</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-text-secondary">
                <p>Para instalar no seu navegador:</p>
                <div className="rounded-xl border border-border bg-bg-input p-3">
                  Clique no ícone de <strong>Instalar / Monitor com seta</strong> na barra de endereço (onde fica o link do site) ou no menu <strong>⋮ → Instalar aplicativo</strong>.
                </div>
              </div>
            )}

            <button
              onClick={() => setModalIOSAberto(false)}
              className="btn-grad mt-5 w-full rounded-xl py-2.5 text-xs font-semibold text-white"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
