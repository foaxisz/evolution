import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  /** Barra fixa embaixo, fora da área de rolagem — para os botões de ação
   *  de formulários altos continuarem alcançáveis. */
  rodape?: React.ReactNode;
  /** Repassado ao container: usado para colar imagem com Ctrl+V. */
  onPaste?: (e: React.ClipboardEvent) => void;
}

export default function Modal({
  isOpen, onClose, title, children, maxWidth = 'max-w-lg', rodape, onPaste,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Trava o scroll do fundo enquanto o modal está aberto
  useEffect(() => {
    if (!isOpen) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, [isOpen]);

  if (!isOpen) return null;

  // Portal para o body: garante que nenhum ancestral com transform/filter/
  // will-change roube o bloco de contenção do position:fixed.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Fundo bem escuro em vez de blur: backdrop-filter forçava repintura
          de toda a árvore atrás a cada frame e engasgava a animação. */}
      <div className="absolute inset-0 bg-black/85 animate-fade-in" onClick={onClose} />

      {/* max-h + coluna: sem isto, um formulário alto estoura a viewport
          e o topo (título e primeiro campo) fica inalcançável. */}
      <div
        onPaste={onPaste}
        className={`relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-bg-card shadow-2xl animate-scale-in ${maxWidth}`}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="rolagem-limpa min-h-0 flex-1 px-6 py-5">{children}</div>

        {rodape && (
          <div className="flex-shrink-0 border-t border-border bg-bg-card px-6 py-4">{rodape}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
