import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

interface ToastProps {
  /** Muda a cada nova mensagem — remonta a animação e reinicia o timer. */
  chave: number;
  mensagem: string;
  detalhe?: string;
  acaoRotulo?: string;
  onAcao?: () => void;
  onFechar: () => void;
  /** Milissegundos até sumir sozinho. */
  duracao?: number;
}

/**
 * Barra de confirmação com desfazer. Uma por vez: quando uma nova mensagem
 * chega, ela substitui a anterior e o tempo recomeça.
 *
 * Portal para o body pelo mesmo motivo do Modal — nenhum ancestral pode
 * roubar o bloco de contenção do position:fixed.
 */
export default function Toast({
  chave, mensagem, detalhe, acaoRotulo, onAcao, onFechar, duracao = 6000,
}: ToastProps) {
  // O callback vive num ref: se ele entrasse nas dependências, cada
  // re-render do pai recriaria a função e reiniciaria a contagem, e a
  // barra ficaria na tela para sempre.
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    const t = window.setTimeout(() => fechar.current(), duracao);
    return () => window.clearTimeout(t);
  }, [chave, duracao]);

  return createPortal(
    // bottom-24 no celular: a nav de baixo é fixa e mede ~61px; medido,
    // isso deixa ~23px de folga entre a barra e a nav.
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[110] flex justify-center px-4 md:bottom-6">
      <div
        key={chave}
        className="toast-entrando pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-border-light bg-bg-card px-4 py-3 shadow-2xl"
      >
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-success/15">
          <Check size={13} strokeWidth={3} className="text-success" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{mensagem}</p>
          {detalhe && <p className="truncate text-xs text-text-muted">{detalhe}</p>}
        </div>

        {acaoRotulo && onAcao && (
          // Botão fantasma de propósito: um botão preenchido aqui rouba
          // mais atenção do que a própria confirmação merece.
          <button
            onClick={onAcao}
            className="flex-shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent-light transition-colors hover:bg-accent/10"
          >
            {acaoRotulo}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
