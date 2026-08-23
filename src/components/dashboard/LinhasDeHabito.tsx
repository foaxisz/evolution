import type { Habit } from '../../types';
import HabitIcon from '../ui/HabitIcon';

export interface LinhaDeHabito {
  habit: Habit;
  /** Consistência do período, em 0–100. */
  atual: number;
  /** Diferença em pontos percentuais contra o período anterior. */
  delta: number;
}

/**
 * Consistência por hábito, no mesmo desenho do ranking de tarefas: o nome
 * DENTRO da barra, não acima dela.
 *
 * Com o rótulo fora, cada item ocupava duas alturas e a barra precisava
 * ser um fio de 8px para caber — fino demais para comparar de relance.
 * Com o nome dentro, a barra tem altura de verdade e a proporção fica
 * óbvia.
 *
 * A ordem é do PIOR para o melhor. A pergunta da seção é "o que está
 * escapando", e uma lista que abre pelos hábitos que já vão bem responde
 * a pergunta oposta.
 */
export default function LinhasDeHabito({ linhas }: { linhas: LinhaDeHabito[] }) {
  return (
    <div className="space-y-1.5">
      {linhas.map(({ habit, atual, delta }, i) => {
        const cor = habit.color ?? 'var(--color-accent)';
        const parado = Math.abs(delta) < 1;
        return (
          <div key={habit.id} className="relative h-8 overflow-hidden rounded-[3px] bg-bg-input">
            <span
              className="barra-esticando absolute inset-y-0 left-0"
              style={{
                '--largura': `${Math.max(1.5, atual)}%`,
                backgroundColor: cor,
                opacity: 0.28,
                animationDelay: `${i * 45}ms`,
              } as React.CSSProperties}
            />

            <div className="relative flex h-full items-center gap-2.5 px-2.5">
              <HabitIcon name={habit.icon} size={13} color={cor} />
              <span className="font-terminal min-w-0 flex-1 truncate text-[16px] leading-none text-text-primary">
                {habit.name}
              </span>
              <span
                className="flex-shrink-0 text-[10px] font-semibold tabular-nums"
                style={{
                  color: parado ? 'var(--color-text-muted)'
                    : delta > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                }}
              >
                {parado ? '—' : `${delta > 0 ? '+' : ''}${Math.round(delta)}pp`}
              </span>
              <span className="font-arcade flex-shrink-0 text-[0.45rem] leading-none" style={{ color: cor }}>
                {Math.round(atual)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
