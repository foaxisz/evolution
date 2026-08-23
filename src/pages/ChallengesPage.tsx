import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { getInteracoes } from '../store';
import { DESAFIOS, type DefinicaoDesafio } from '../desafios';
import MilInteracoes from '../desafios/MilInteracoes';
import ProgressRing from '../components/ui/ProgressRing';
import HabitIcon from '../components/ui/HabitIcon';

/** Cada desafio tem sua própria página. O mapa liga o id ao componente. */
const PAGINAS: Record<string, React.ComponentType<{ desafio: DefinicaoDesafio; onVoltar: () => void }>> = {
  'mil-interacoes': MilInteracoes,
};

export default function ChallengesPage() {
  const [aberto, setAberto] = useState<string | null>(null);

  if (aberto) {
    const desafio = DESAFIOS.find(d => d.id === aberto);
    const Pagina = desafio ? PAGINAS[desafio.id] : undefined;
    if (desafio && Pagina) {
      return <Pagina desafio={desafio} onVoltar={() => setAberto(null)} />;
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Desafios</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Objetivos longos, cada um com sua própria página
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {DESAFIOS.map(d => {
          const total = getInteracoes(d.id).length;
          const pct = Math.min(100, (total / d.meta) * 100);
          return (
            // min-w-0 no próprio item: grid usa min-width auto por padrão,
            // o conteúdo não cede e o card estoura a largura no mobile
            <button
              key={d.id}
              onClick={() => setAberto(d.id)}
              className="card-soft group flex w-full min-w-0 items-center gap-4 rounded-2xl border border-border bg-bg-card p-5 text-left transition-[border-color,background-color] duration-200 hover:border-border-light hover:bg-bg-card-hover"
            >
              <div className="flex-shrink-0">
                <ProgressRing value={pct} size={72} strokeWidth={7} ticks={28} color={d.cor} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <HabitIcon name={d.icone} size={13} color={d.cor} />
                  <h2 className="truncate text-base font-semibold text-text-primary">{d.titulo}</h2>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-text-muted">{d.subtitulo}</p>
                <p className="mt-2 truncate">
                  <span className="text-xl font-bold tabular-nums leading-none" style={{ color: d.cor }}>
                    {total}
                  </span>
                  <span className="ml-1.5 text-xs text-text-muted">
                    / {d.meta.toLocaleString('pt-BR')} {d.unidade}
                  </span>
                </p>
              </div>

              <ChevronRight size={18} className="flex-shrink-0 text-text-muted transition-colors group-hover:text-accent-light" />
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-text-muted">
        Desafios são definidos em código, em <code className="text-text-secondary">src/desafios/</code>.
        Peça um novo e eu adiciono a página dele.
      </p>
    </div>
  );
}
