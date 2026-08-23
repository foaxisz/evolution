import { useState } from 'react';
import BarrasVerticais from '../ui/BarrasVerticais';
import { formatarDuracao } from '../../lib/pomodoro';
import { formatarData } from '../../lib/data';
import { DIAS_CURTOS, diasDoMes, type MetricasDoMes } from '../../lib/metricas';

/**
 * Gráficos do painel de dados. SVG e divs à mão, sem biblioteca.
 *
 * Nenhum deles tem legenda ou linha de instrução: o valor sob o cursor
 * aparece no cabeçalho do bloco, via `onLer`, no lugar onde já havia
 * texto. Assim não sobra faixa vazia esperando um hover que talvez não
 * venha.
 */

type Leitor = (texto: string | null) => void;

// ══════════════════════════════════════════════════════════════════════
// Barras por dia do mês
// ══════════════════════════════════════════════════════════════════════

export function BarrasDoMes({ m, cor, onLer }: { m: MetricasDoMes; cor: string; onLer: Leitor }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const dias = diasDoMes(m.mes);
  const valores = dias.map(d => m.porDia.get(d) ?? 0);
  const pico = Math.max(1, ...valores);

  // Só dia com foco responde ao mouse. Passar por um dia zerado e ler
  // "sem foco" no cabeçalho é ruído: a barra ausente já disse isso.
  function apontar(i: number | null) {
    if (i === null || valores[i] === 0) { setAtivo(null); onLer(null); return; }
    setAtivo(i);
    onLer(`${formatarData(dias[i], "d 'de' MMM", dias[i])} · ${formatarDuracao(valores[i])}`);
  }

  return (
    <div className="flex gap-3" onMouseLeave={() => apontar(null)}>
      <div className="flex h-32 w-9 flex-col justify-between text-right">
        {[pico, pico / 2, 0].map((v, i) => (
          <span key={i} className="font-arcade text-[0.4rem] leading-none text-text-muted">
            {v === 0 ? '0' : formatarDuracao(v).replace(' ', '')}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative">
          {[0, 0.5, 1].map(f => (
            <span
              key={f}
              className="pointer-events-none absolute inset-x-0 h-px bg-border"
              style={{ top: `${f * 100}%`, opacity: f === 1 ? 1 : 0.55 }}
            />
          ))}

          <div className="flex h-32 items-end gap-[2px]">
            {valores.map((v, i) => (
              <div
                key={dias[i]}
                className="relative flex h-full flex-1 items-end"
                onMouseEnter={() => apontar(i)}
              >
                <span
                  className="barra-crescendo w-full rounded-t-[1px] transition-[background-color] duration-150"
                  style={{
                    // Piso de 2%: barra invisível e barra ausente contam
                    // coisas diferentes e não podem parecer a mesma.
                    height: v > 0 ? `${Math.max(2, (v / pico) * 100)}%` : '0%',
                    backgroundColor: ativo === i ? cor : `color-mix(in oklab, ${cor} 55%, transparent)`,
                    animationDelay: `${i * 16}ms`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 1, 10, 20 e o último dia. `whitespace-nowrap` porque em
            `left: 100%` sobra largura zero e o "31" quebra em duas linhas. */}
        <div className="relative mt-2 h-3">
          {dias.map((d, i) => {
            const dia = Number(d.slice(8));
            const ultimo = i === dias.length - 1;
            if (dia !== 1 && dia !== 10 && dia !== 20 && !ultimo) return null;
            return (
              <span
                key={d}
                className={`absolute whitespace-nowrap font-arcade text-[0.4rem] leading-none text-text-muted ${
                  i === 0 ? '' : ultimo ? '-translate-x-full' : '-translate-x-1/2'
                }`}
                style={{ left: `${(i / (dias.length - 1)) * 100}%` }}
              >
                {dia}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Grade de horário — dia × hora
// ══════════════════════════════════════════════════════════════════════

const FIM_DA_GRADE = 24;

/**
 * Onde cada bloco caiu no dia, ao longo do mês. Um retângulo por bloco,
 * na posição real dele no relógio — é o que responde "a que horas eu de
 * fato trabalho", que nenhum total por dia responde.
 */
export function GradeDeHorarios({ m, cor, onLer }: { m: MetricasDoMes; cor: string; onLer: Leitor }) {
  const [ativo, setAtivo] = useState<string | null>(null);

  const dias = [...diasDoMes(m.mes)].reverse();

  // Começa às 5h porque antes disso quase nunca há bloco e a hora morta
  // comeria metade da largura. Mas quem vira a noite tem bloco às 3h, e
  // fixar o começo o empurraria para fora — a faixa se abre para trás.
  const inicioDaGrade = Math.min(5, ...m.blocosDoMes.map(b => Math.floor(b.inicioMin / 60)));
  const janela = FIM_DA_GRADE - inicioDaGrade;
  const posicao = (min: number) => ((min / 60 - inicioDaGrade) / janela) * 100;

  const porDia = new Map<string, MetricasDoMes['blocosDoMes']>();
  m.blocosDoMes.forEach(b => {
    if (!porDia.has(b.dia)) porDia.set(b.dia, []);
    porDia.get(b.dia)!.push(b);
  });

  const horas = Array.from({ length: janela + 1 }, (_, i) => inicioDaGrade + i);

  function apontar(dia: string | null) {
    const blocos = dia ? porDia.get(dia) : null;
    if (!dia || !blocos?.length) { setAtivo(null); onLer(null); return; }
    setAtivo(dia);
    onLer(`${formatarData(dia, "d 'de' MMM", dia)} · ${blocos.length}× · ${formatarDuracao(m.porDia.get(dia) ?? 0)}`);
  }

  return (
    <div>
      <div className="relative ml-[34px] mb-1 h-3">
        {horas.map(h => (
          h % 3 === 0 && h < FIM_DA_GRADE ? (
            <span
              key={h}
              className="absolute whitespace-nowrap font-arcade text-[0.4rem] leading-none text-text-muted"
              style={{ left: `${((h - inicioDaGrade) / janela) * 100}%` }}
            >
              {String(h).padStart(2, '0')}
            </span>
          ) : null
        ))}
      </div>

      <div className="rolagem-limpa max-h-[336px]" onMouseLeave={() => apontar(null)}>
        {dias.map(dia => {
          const blocos = porDia.get(dia) ?? [];
          const dow = new Date(`${dia}T12:00:00`).getDay();
          return (
            <div
              key={dia}
              className="flex items-center transition-colors duration-150"
              style={{ backgroundColor: ativo === dia ? 'var(--color-bg-card-hover)' : undefined }}
              onMouseEnter={() => apontar(dia)}
            >
              <span
                className="w-[34px] flex-shrink-0 pr-2 text-right text-[9px] leading-[18px] tabular-nums"
                style={{ color: blocos.length ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}
              >
                {Number(dia.slice(8))} {DIAS_CURTOS[dow].slice(0, 1)}
              </span>

              <div className="relative h-[18px] min-w-0 flex-1 border-b border-border/50">
                {horas.map(h => (
                  h % 3 === 0 ? (
                    <span
                      key={h}
                      className="pointer-events-none absolute inset-y-0 w-px bg-border/40"
                      style={{ left: `${((h - inicioDaGrade) / janela) * 100}%` }}
                    />
                  ) : null
                ))}

                {blocos.map(b => {
                  const esquerda = Math.max(0, posicao(b.inicioMin));
                  // Bloco iniciado 23h50 termina depois da meia-noite e
                  // passaria da borda. O que sobra do dia é o teto.
                  const largura = Math.min((b.duracaoMin / 60 / janela) * 100, 100 - esquerda);
                  return (
                    <span
                      key={b.id}
                      className="bloco-surgindo absolute top-[3px] h-[12px] rounded-[1px]"
                      style={{
                        left: `${esquerda}%`,
                        // Piso de 3px: 15 minutos ocupam 1,3% da faixa.
                        width: `max(3px, ${largura}%)`,
                        backgroundColor: b.completa ? cor : `color-mix(in oklab, ${cor} 45%, transparent)`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Barras por dia da semana
// ══════════════════════════════════════════════════════════════════════

export function BarrasDaSemana({ m, cor, onLer }: { m: MetricasDoMes; cor: string; onLer: Leitor }) {
  const ordem = [1, 2, 3, 4, 5, 6, 0]; // segunda primeiro
  const valores = ordem.map(d => m.porDiaDaSemana[d]);

  return (
    <BarrasVerticais
      valores={valores}
      cor={cor}
      rotulo={i => DIAS_CURTOS[ordem[i]]}
      onApontar={i => onLer(i === null ? null : `${DIAS_CURTOS[ordem[i]]} · ${formatarDuracao(valores[i])}`)}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════
// Ranking de tarefas
// ══════════════════════════════════════════════════════════════════════

/**
 * Ranking de tarefas: o nome DENTRO da barra, não acima dela.
 *
 * Antes cada item ocupava duas linhas — rótulo em cima, fio de 1,5px
 * embaixo — e oito itens viravam uma coluna alta e rala, com o fio fino
 * demais para se comparar de relance. Com o rótulo dentro, a barra pode
 * ter altura de verdade, a proporção fica óbvia e o bloco cabe em metade
 * do espaço.
 *
 * O nome usa a fonte de terminal porque é o mesmo nome que aparece na
 * lista de tarefas — texto igual em duas fontes na mesma tela denuncia.
 */
export function RankingDeTarefas({ m, cor }: { m: MetricasDoMes; cor: string }) {
  const topo = m.porTarefa.slice(0, 8);
  if (topo.length === 0) {
    return <p className="py-6 text-center text-sm text-text-muted">Nada neste mês.</p>;
  }

  const pico = Math.max(1, topo[0].segundos);

  return (
    <div className="space-y-1.5">
      {topo.map((t, i) => (
        <div
          key={t.id}
          className="relative h-8 overflow-hidden rounded-[3px] bg-bg-input"
          title={t.nome}
        >
          {/* Preenchimento por opacidade, não por `color-mix`: o texto vem
              por cima e precisa de contraste previsível. Tarefa concluída
              vem mais forte que tarefa ainda aberta. */}
          <span
            className="barra-esticando absolute inset-y-0 left-0"
            style={{
              '--largura': `${Math.max(1.5, (t.segundos / pico) * 100)}%`,
              backgroundColor: cor,
              opacity: t.concluida ? 0.32 : 0.18,
              animationDelay: `${i * 45}ms`,
            } as React.CSSProperties}
          />

          <div className="relative flex h-full items-center gap-2.5 px-2.5">
            <span className="font-terminal min-w-0 flex-1 truncate text-[16px] leading-none text-text-primary">
              {t.nome}
            </span>
            <span className="flex-shrink-0 text-[10px] tabular-nums text-text-muted">{t.blocos}×</span>
            <span className="font-arcade flex-shrink-0 text-[0.45rem] leading-none" style={{ color: cor }}>
              {formatarDuracao(t.segundos)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
