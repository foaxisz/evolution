import HabitIcon from '../ui/HabitIcon';

export interface SegmentoDeCategoria {
  /** Identificador devolvido no clique. */
  chave: string;
  rotulo: string;
  /** Ausente = cor de destaque padrão. */
  cor?: string;
  /** Chave de HABIT_ICONS. */
  icone?: string;
  /** Ausente = segmento sem número (é o caso do formulário). */
  contagem?: number;
}

/**
 * As categorias como uma fita segmentada.
 *
 * Eram pílulas `rounded-full` de texto normal com a contagem em cinza — chip
 * genérico de web, num app que é todo quadrado e de fonte arcade. Agora é uma
 * peça só, dividida por filetes, com o rótulo em micro-caixa-alta arcade.
 *
 * ── Rola de lado, nunca quebra linha ──
 *
 * Com muitas categorias a fita aperta. Quebrar em duas linhas destruiria a
 * leitura de "peça única", que é o ponto do desenho — viraria duas fitas
 * soltas. Então ela rola na horizontal, com `rolagem-lateral`.
 *
 * NÃO usar a `rolagem-limpa` aqui: ela trava `overflow-x: hidden` de
 * propósito, para áreas de rolagem vertical. Aplicada nesta fita, esconderia
 * a barra e impediria a rolagem ao mesmo tempo — a fita ficaria cortada.
 */
export default function FitaDeCategorias({
  segmentos, ativo, onEscolher,
}: {
  segmentos: SegmentoDeCategoria[];
  /** `chave` do segmento selecionado. */
  ativo: string;
  onEscolher: (chave: string) => void;
}) {
  if (segmentos.length === 0) return null;

  return (
    <div className="rolagem-lateral -mx-1 px-1 pb-1">
      <div
        className="inline-flex min-w-full overflow-hidden rounded-lg border-solid"
        style={{ borderWidth: 2, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-card)' }}
        role="tablist"
      >
        {segmentos.map((s, i) => {
          const cor = s.cor ?? 'var(--color-accent)';
          const on = s.chave === ativo;

          return (
            <button
              key={s.chave}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onEscolher(s.chave)}
              className="flex flex-shrink-0 items-center gap-2 px-3.5 py-2.5 transition-colors duration-200"
              style={{
                // Filete só ENTRE segmentos: no último ele viraria uma borda
                // dupla junto com a da fita.
                borderRight: i < segmentos.length - 1 ? '1px solid var(--color-border)' : undefined,
                backgroundColor: on ? `color-mix(in oklab, ${cor} 16%, transparent)` : 'transparent',
              }}
            >
              {s.icone && (
                <HabitIcon name={s.icone} size={12} color={on ? cor : 'var(--color-text-muted)'} />
              )}
              <span
                className="font-arcade whitespace-nowrap text-[7px] uppercase leading-none"
                style={{ color: on ? cor : 'var(--color-text-muted)' }}
              >
                {s.rotulo}
              </span>
              {s.contagem !== undefined && (
                <span
                  className="font-arcade text-[8px] leading-none"
                  style={{ color: on ? 'var(--color-text-primary)' : 'var(--color-border-light)' }}
                >
                  {s.contagem}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
