import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { gradeDeSeisSemanas, somarMeses, hojeISO } from '../../lib/tarefas';
import { formatarData } from '../../lib/data';

const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Escolher UM dia.
 *
 * É o irmão mais simples do `SeletorDePeriodo` do painel de metas, e de
 * propósito na mesma linguagem: casas quadradas de canto 2px em vez de
 * bolinhas, mês em micro-caixa-alta arcade, realce por `color-mix` na cor da
 * frente. Dois calendários no mesmo app com desenhos diferentes seriam dois
 * apps.
 *
 * A diferença de comportamento é uma só: aqui o clique JÁ escolhe, sem botão
 * de confirmar. Lá o período é decisão de três vezes por ano e merece um
 * passo a mais; aqui é o vencimento de uma tarefa, que se troca à vontade.
 */
export default function CalendarioDeUmDia({
  valor, cor, onEscolher,
}: {
  /** Dia já escolhido, 'YYYY-MM-DD'. Vazio quando não há vencimento. */
  valor?: string;
  cor: string;
  onEscolher: (dia: string) => void;
}) {
  const hoje = hojeISO();
  // Abre no mês do vencimento atual, ou no mês corrente quando não há.
  const [mesVisivel, setMesVisivel] = useState(() => (valor ?? hoje).slice(0, 7));

  const grade = gradeDeSeisSemanas(mesVisivel);
  const mesPorExtenso = formatarData(`${mesVisivel}-01`, "MMMM 'de' yyyy", mesVisivel);
  const seta = 'botao-icone text-text-muted transition-colors hover:text-text-primary';

  return (
    <div
      className="rounded-md border p-2"
      style={{
        borderColor: `color-mix(in oklab, ${cor} 25%, var(--color-border))`,
        backgroundColor: 'var(--color-bg-input)',
      }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => setMesVisivel(m => somarMeses(m, -1))}
          aria-label="Mês anterior"
          className={seta}
        >
          <ChevronLeft size={13} />
        </button>
        <span className="font-arcade text-[0.45rem] uppercase leading-none" style={{ color: cor }}>
          {mesPorExtenso}
        </span>
        <button
          type="button"
          onClick={() => setMesVisivel(m => somarMeses(m, 1))}
          aria-label="Próximo mês"
          className={seta}
        >
          <ChevronRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DIAS_DA_SEMANA.map((d, i) => (
          <span key={i} className="font-arcade pb-1 text-center text-[0.4rem] leading-none text-text-muted">
            {d}
          </span>
        ))}

        {grade.map(dia => {
          const doMes = dia.slice(0, 7) === mesVisivel;
          const escolhido = dia === valor;
          const ehHoje = dia === hoje;

          return (
            <button
              key={dia}
              type="button"
              onClick={() => onEscolher(dia)}
              aria-label={dia}
              aria-current={escolhido ? 'date' : undefined}
              className="group relative h-7"
            >
              <span
                className="font-terminal relative mx-auto flex h-6 w-6 items-center justify-center rounded-[2px] text-[14px] leading-none transition-colors"
                style={{
                  backgroundColor: escolhido ? cor : 'transparent',
                  color: escolhido
                    ? 'var(--color-bg-primary)'
                    : doMes
                      ? 'var(--color-text-secondary)'
                      : 'var(--color-border-light)',
                  // Hoje sem estar escolhido: só um contorno. Preencher
                  // faria dois blocos acesos disputando qual é a escolha.
                  boxShadow: ehHoje && !escolhido ? `inset 0 0 0 1px ${cor}` : undefined,
                }}
              >
                {!escolhido && (
                  <span
                    className="absolute inset-0 rounded-[2px] opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: `color-mix(in oklab, ${cor} 16%, transparent)` }}
                    aria-hidden
                  />
                )}
                <span className="relative">{Number(dia.slice(8))}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
