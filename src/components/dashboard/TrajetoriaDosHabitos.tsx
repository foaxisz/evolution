import { caminho, type TrajetoriaDeHabito } from '../../lib/evolucao';
import HabitIcon from '../ui/HabitIcon';

const L = 200;
const A = 34;

const TOM = {
  subindo: 'var(--color-success)',
  firme: 'var(--color-text-muted)',
  caindo: 'var(--color-danger)',
} as const;

/**
 * Um minigráfico por hábito, todos na mesma escala de 0 a 100%.
 *
 * É o filme, enquanto o bloco de percentual é a foto. A diferença decide
 * o que fazer: um hábito em 70% e caindo precisa de atenção; um em 40% e
 * subindo está indo bem e só precisa de tempo. Nenhuma leitura de um
 * momento só distingue esses dois casos.
 *
 * A escala é fixa em 0–100 e não no pico de cada série — normalizar cada
 * linha pelo próprio máximo faria um hábito de 20% desenhar a mesma
 * montanha de um de 90%.
 *
 * Cada linha é uma TELA fechada, com grade de fósforo e área preenchida
 * sob o traço. Com um hábito só, um fio solto atravessando o bloco deixava
 * um vão enorme em volta; a tela dá corpo à linha e o percentual atual
 * ocupa a ponta com informação em vez de espaço.
 */
export default function TrajetoriaDosHabitos({ linhas }: { linhas: TrajetoriaDeHabito[] }) {
  return (
    <ul className="space-y-2">
      {linhas.map(({ habit, pontos, tendencia }, i) => {
        const cor = TOM[tendencia];
        const corHabito = habit.color ?? 'var(--color-accent)';
        const atual = Math.round(pontos[pontos.length - 1] ?? 0);
        const traco = caminho(pontos, L, A - 8, 4, 100);

        return (
          <li key={habit.id} className="flex items-center gap-3">
            <HabitIcon name={habit.icon} size={14} color={corHabito} />
            <span className="font-terminal w-24 flex-shrink-0 truncate text-[15px] leading-none text-text-primary">
              {habit.name}
            </span>

            <span className="relative min-w-0 flex-1 overflow-hidden rounded border border-border bg-bg-input/70">
              <svg
                viewBox={`0 0 ${L} ${A}`}
                preserveAspectRatio="none"
                className="block h-9 w-full"
                role="img"
                aria-label={`${habit.name}: ${atual}% da meta, ${tendencia} nas últimas 12 semanas`}
              >
                <path d={`${traco} L${L},${A} L0,${A} Z`} fill={cor} opacity="0.14" />
                <path
                  d={traco}
                  fill="none"
                  stroke={cor}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  className="linha-desenhando"
                  style={{ animationDelay: `${i * 70}ms` }}
                />
              </svg>
            </span>

            <span className="font-arcade w-9 flex-shrink-0 text-right text-[0.45rem] leading-none" style={{ color: corHabito }}>
              {atual}%
            </span>
            <span className="font-arcade w-12 flex-shrink-0 text-right text-[0.4rem] leading-none" style={{ color: cor }}>
              {tendencia}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
