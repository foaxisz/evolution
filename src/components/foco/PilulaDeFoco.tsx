import { Play, Pause, Maximize2 } from 'lucide-react';
import type { FocoEmAndamento } from '../../types';
import { segundosRestantes, progresso, formatarRelogio } from '../../lib/pomodoro';
import ProgressRing from '../ui/ProgressRing';

interface PilulaDeFocoProps {
  /** `null` = nenhum bloco correndo; mostra o tempo padrão e um play. */
  foco: FocoEmAndamento | null;
  minutosPadrao: number;
  cor: string;
  onAbrir: () => void;
  onIniciar: () => void;
  onPausar: () => void;
  onRetomar: () => void;
}

/**
 * Cronômetro encolhido, fixo no rodapé da frente.
 *
 * O corpo abre a cabine em tela cheia; o botão da direita comanda sem
 * abrir nada — quem está no meio de um bloco quer pausar com um toque,
 * não navegar.
 *
 * `bottom-20` no celular para não encostar na nav de baixo, que é fixa e
 * mede ~61px.
 */
export default function PilulaDeFoco({
  foco, minutosPadrao, cor, onAbrir, onIniciar, onPausar, onRetomar,
}: PilulaDeFocoProps) {
  const rodando = !!foco && foco.pausadaEm === null;
  const pausado = !!foco && foco.pausadaEm !== null;
  const segundos = foco ? segundosRestantes(foco) : minutosPadrao * 60;
  const pct = foco ? progresso(foco) * 100 : 0;

  const rotulo = rodando ? 'Pausar' : pausado ? 'Retomar' : 'Começar a focar';

  function comandar(e: React.MouseEvent) {
    e.stopPropagation();
    if (rodando) onPausar();
    else if (pausado) onRetomar();
    else onIniciar();
  }

  return (
    // `md:left-60` acompanha a barra lateral: com `inset-x-0` a pílula
    // centraliza na janela inteira e fica 120px à esquerda da coluna de
    // conteúdo, que já é deslocada pela sidebar de 240px.
    <div className="pointer-events-none fixed bottom-20 left-0 right-0 z-[90] flex justify-center px-4 md:bottom-6 md:left-60">
      <div
        onClick={onAbrir}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}
        aria-label="Abrir o foco em tela cheia"
        className="pointer-events-auto group flex cursor-pointer items-center gap-3 rounded-xl border bg-bg-secondary p-2 transition-[border-color,background-color] duration-200 hover:bg-bg-card-hover"
        style={{
          // Sombra só de profundidade, sem halo colorido. O brilho em volta
          // fazia a peça parecer um adesivo aceso em vez de um controle.
          borderColor: foco ? `color-mix(in oklab, ${cor} 38%, transparent)` : 'var(--color-border-light)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
        }}
      >
        <ProgressRing value={pct} size={34} strokeWidth={4} ticks={24} color={cor} centro={<span />} />

        <span className="tabular-nums text-sm font-semibold leading-none tracking-tight text-text-primary">
          {formatarRelogio(segundos)}
        </span>

        <span
          className="hidden text-[9px] uppercase tracking-[0.2em] text-text-muted sm:inline"
          aria-hidden
        >
          {rodando ? 'focando' : pausado ? 'pausado' : 'pronto'}
        </span>

        <Maximize2
          size={11}
          className="hidden text-text-muted transition-colors group-hover:text-text-secondary sm:block"
          aria-hidden
        />

        <button
          onClick={comandar}
          aria-label={rotulo}
          title={rotulo}
          className="alvo-toque flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border transition-[background-color,border-color] duration-200"
          style={{
            borderColor: `color-mix(in oklab, ${cor} 55%, transparent)`,
            backgroundColor: `color-mix(in oklab, ${cor} 18%, transparent)`,
            color: cor,
          }}
        >
          {rodando ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
      </div>
    </div>
  );
}
