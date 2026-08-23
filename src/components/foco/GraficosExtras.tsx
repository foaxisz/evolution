import { useState } from 'react';
import { formatarDuracao } from '../../lib/pomodoro';
import { diasDoMes, mesCurto, serieAcumulada, type MetricasDoMes } from '../../lib/metricas';

/**
 * Gráficos de análise do painel. Os de `Graficos.tsx` descrevem o mês —
 * quanto, quando, em quê. Estes respondem perguntas: estou melhor que mês
 * passado, meus blocos duram o que eu planejo, a que horas eu desisto.
 */

type Leitor = (texto: string | null) => void;

/** `findLastIndex` só existe a partir do ES2023 e o alvo aqui é menor. */
function ultimoIndice<T>(lista: T[], teste: (v: T) => boolean): number {
  for (let i = lista.length - 1; i >= 0; i--) if (teste(lista[i])) return i;
  return -1;
}

// ══════════════════════════════════════════════════════════════════════
// Ritmo acumulado
// ══════════════════════════════════════════════════════════════════════

/**
 * Soma correndo do mês, com o mês passado por baixo como régua.
 *
 * Aqui a linha é a forma certa, ao contrário do tempo por dia: acumulado
 * é monótono e contínuo — o valor no dia 12 existe mesmo no caminho entre
 * o 11 e o 13. E é o único gráfico que responde "estou à frente ou atrás
 * do mês passado?".
 */
export function RitmoAcumulado({
  m, anterior, cor, onLer,
}: { m: MetricasDoMes; anterior: MetricasDoMes; cor: string; onLer: Leitor }) {
  const [ativo, setAtivo] = useState<number | null>(null);

  const atual = serieAcumulada(m);
  const passado = serieAcumulada(anterior);
  const dias = diasDoMes(m.mes);

  const teto = Math.max(1, ...atual.map(v => v ?? 0), ...passado.map(v => v ?? 0));
  const L = 600;
  const A = 120;
  const x = (i: number) => (i / Math.max(1, dias.length - 1)) * L;
  const y = (v: number) => A - (v / teto) * A;

  const caminho = (serie: (number | null)[]) => {
    const pts = serie
      .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean);
    return pts.length ? `M${pts.join(' L')}` : '';
  };

  const linha = caminho(atual);
  const fim = ultimoIndice(atual, v => v !== null);
  const area = linha && fim >= 0 ? `${linha} L${x(fim).toFixed(1)},${A} L0,${A} Z` : '';

  function apontar(i: number | null) {
    if (i === null || atual[i] === null) { setAtivo(null); onLer(null); return; }
    setAtivo(i);
    const dif = atual[i]! - (passado[i] ?? 0);
    onLer(`dia ${i + 1} · ${formatarDuracao(atual[i]!)} · ${dif >= 0 ? '+' : '−'}${formatarDuracao(Math.abs(dif))}`);
  }

  return (
    <div onMouseLeave={() => apontar(null)}>
      <svg
        viewBox={`0 0 ${L} ${A}`}
        preserveAspectRatio="none"
        className="h-28 w-full"
        role="img"
        aria-label="Ritmo acumulado do mês"
      >
        {[0, 0.5, 1].map(f => (
          <line
            key={f} x1="0" x2={L} y1={A * f} y2={A * f}
            stroke="var(--color-border)" strokeWidth="1" vectorEffect="non-scaling-stroke"
            strokeDasharray={f === 1 ? undefined : '2 4'}
          />
        ))}

        {/* Mês passado tracejado e apagado: é régua, não protagonista. */}
        <path
          d={caminho(passado)} fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5"
          strokeDasharray="4 4" vectorEffect="non-scaling-stroke" opacity="0.6"
        />

        <path d={area} fill={cor} opacity="0.12" className="area-surgindo" />
        <path
          d={linha} fill="none" stroke={cor} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        />

        {ativo !== null && atual[ativo] !== null && (
          <>
            <line
              x1={x(ativo)} x2={x(ativo)} y1="0" y2={A}
              stroke={cor} strokeWidth="1" strokeOpacity="0.45" vectorEffect="non-scaling-stroke"
            />
            <circle cx={x(ativo)} cy={y(atual[ativo]!)} r="3.5" fill={cor} />
          </>
        )}

        {/* Faixas de captura: acertar a linha com o mouse é impossível. */}
        {dias.map((d, i) => (
          <rect
            key={d} x={x(i) - L / dias.length / 2} y="0"
            width={L / dias.length} height={A} fill="transparent"
            onMouseEnter={() => apontar(i)}
          />
        ))}
      </svg>

      <div className="mt-2 flex items-center gap-4">
        <Legenda cor={cor} texto="este mês" />
        <Legenda tracejada texto={mesCurto(anterior.mes)} />
      </div>
    </div>
  );
}

function Legenda({ cor, texto, tracejada }: { cor?: string; texto: string; tracejada?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
      <span
        className="h-[2px] w-4"
        style={
          tracejada
            ? { backgroundImage: 'repeating-linear-gradient(90deg, var(--color-text-muted) 0 4px, transparent 4px 8px)' }
            : { backgroundColor: cor }
        }
      />
      {texto}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Últimos meses
// ══════════════════════════════════════════════════════════════════════

/** Barras deitadas dos últimos meses; clicar abre o mês. */
export function UltimosMeses({
  dados, mesAberto, cor, onIr,
}: {
  dados: { mes: string; segundos: number }[];
  mesAberto: string;
  cor: string;
  onIr: (mes: string) => void;
}) {
  const pico = Math.max(1, ...dados.map(d => d.segundos));

  return (
    <div className="space-y-2">
      {dados.map((d, i) => {
        const aberto = d.mes === mesAberto;
        return (
          <button
            key={d.mes}
            onClick={() => onIr(d.mes)}
            className="flex w-full items-center gap-3 rounded px-1 py-1 text-left transition-colors hover:bg-bg-card-hover"
          >
            <span
              className="font-arcade w-12 flex-shrink-0 text-[0.4rem] uppercase leading-none"
              style={{ color: aberto ? cor : 'var(--color-text-muted)' }}
            >
              {mesCurto(d.mes)}
            </span>
            <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-[1px] bg-bg-input">
              <span
                className="barra-esticando block h-full"
                style={{
                  '--largura': `${(d.segundos / pico) * 100}%`,
                  backgroundColor: aberto ? cor : `color-mix(in oklab, ${cor} 45%, transparent)`,
                  animationDelay: `${i * 50}ms`,
                } as React.CSSProperties}
              />
            </span>
            <span
              className="w-14 flex-shrink-0 text-right text-[10px] tabular-nums"
              style={{ color: aberto ? cor : 'var(--color-text-muted)' }}
            >
              {d.segundos ? formatarDuracao(d.segundos) : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Duração real dos blocos
// ══════════════════════════════════════════════════════════════════════

// Borda de cima inclusiva: um bloco de 45 minutos pertence a "30-45", que
// é como se lê o rótulo. Com `<` ele caía em "45-60" e a faixa que a
// pessoa realmente usa aparecia vazia.
const FAIXAS = [
  { ate: 10, nome: '≤10' },
  { ate: 20, nome: '10-20' },
  { ate: 30, nome: '20-30' },
  { ate: 45, nome: '30-45' },
  { ate: 60, nome: '45-60' },
  { ate: Infinity, nome: '60+' },
];

/**
 * Quantos blocos caem em cada faixa de duração.
 *
 * A média esconde o formato: 25 minutos de média tanto pode ser "todo
 * bloco dura 25" quanto "metade dura 45 e metade morre aos 5". São dois
 * problemas diferentes e só a distribuição os separa.
 */
export function DuracaoDosBlocos({ m, cor, onLer }: { m: MetricasDoMes; cor: string; onLer: Leitor }) {
  const [ativo, setAtivo] = useState<number | null>(null);

  const contagem = FAIXAS.map(() => 0);
  m.blocosDoMes.forEach(b => {
    const i = FAIXAS.findIndex(f => b.duracaoMin <= f.ate);
    contagem[i === -1 ? FAIXAS.length - 1 : i] += 1;
  });
  const pico = Math.max(1, ...contagem);

  function apontar(i: number | null) {
    if (i === null || contagem[i] === 0) { setAtivo(null); onLer(null); return; }
    setAtivo(i);
    onLer(`${FAIXAS[i].nome}min · ${contagem[i]}× · ${Math.round((contagem[i] / m.blocos) * 100)}%`);
  }

  return (
    <div onMouseLeave={() => apontar(null)}>
      <div className="flex h-24 items-end gap-2">
        {contagem.map((c, i) => (
          <div key={i} className="relative flex h-full flex-1 items-end" onMouseEnter={() => apontar(i)}>
            <span className="absolute inset-0 bg-bg-input/40" />
            <span
              className="barra-crescendo relative w-full transition-[background-color] duration-150"
              style={{
                height: c > 0 ? `${Math.max(4, (c / pico) * 100)}%` : '0%',
                backgroundColor: ativo === i ? cor : `color-mix(in oklab, ${cor} 50%, transparent)`,
                animationDelay: `${i * 45}ms`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        {FAIXAS.map((f, i) => (
          <span
            key={f.nome}
            className="flex-1 text-center font-arcade text-[0.4rem] leading-none transition-colors"
            style={{ color: ativo === i ? cor : 'var(--color-text-muted)' }}
          >
            {f.nome}
          </span>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Conclusão por hora
// ══════════════════════════════════════════════════════════════════════

/**
 * Blocos concluídos e interrompidos, por hora de início.
 *
 * "Quando você focou" mostra a que horas você trabalha. Este mostra a que
 * horas o que você começa realmente termina — que é onde está a decisão
 * de mudar de horário, não no volume.
 */
export function ConclusaoPorHora({ m, cor, onLer }: { m: MetricasDoMes; cor: string; onLer: Leitor }) {
  const [ativo, setAtivo] = useState<number | null>(null);

  const feitos: number[] = Array(24).fill(0);
  const largados: number[] = Array(24).fill(0);
  m.blocosDoMes.forEach(b => {
    const h = Math.floor(b.inicioMin / 60);
    if (b.completa) feitos[h] += 1;
    else largados[h] += 1;
  });

  const total = feitos.map((f, i) => f + largados[i]);
  const primeira = total.findIndex(v => v > 0);
  const ultima = ultimoIndice(total, v => v > 0);
  const faixa = primeira === -1 ? [] : Array.from({ length: ultima - primeira + 1 }, (_, i) => primeira + i);
  const pico = Math.max(1, ...total);

  function apontar(h: number | null) {
    if (h === null || total[h] === 0) { setAtivo(null); onLer(null); return; }
    setAtivo(h);
    onLer(`${String(h).padStart(2, '0')}h · ${total[h]}× · ${Math.round((feitos[h] / total[h]) * 100)}% até o fim`);
  }

  if (faixa.length === 0) {
    return <p className="py-6 text-center text-sm text-text-muted">Nada neste mês.</p>;
  }

  return (
    <div onMouseLeave={() => apontar(null)}>
      <div className="flex h-24 items-end gap-[3px]">
        {faixa.map(h => (
          <div
            key={h}
            className="relative flex h-full flex-1 flex-col justify-end"
            onMouseEnter={() => apontar(h)}
          >
            <span className="absolute inset-0 bg-bg-input/40" />
            {/* Empilhado na mesma coluna: a altura total é o volume da hora
                e a parte cheia é o aproveitamento dela. */}
            <span
              className="barra-crescendo relative w-full transition-opacity duration-150"
              style={{
                height: `${(largados[h] / pico) * 100}%`,
                backgroundColor: `color-mix(in oklab, ${cor} 22%, transparent)`,
                opacity: ativo === null || ativo === h ? 1 : 0.45,
              }}
            />
            <span
              className="barra-crescendo relative w-full transition-opacity duration-150"
              style={{
                height: `${(feitos[h] / pico) * 100}%`,
                backgroundColor: cor,
                opacity: ativo === null || ativo === h ? 1 : 0.45,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-[3px]">
        {faixa.map(h => (
          <span
            key={h}
            className="flex-1 text-center font-arcade text-[0.4rem] leading-none transition-colors"
            style={{
              color: ativo === h ? cor : 'var(--color-text-muted)',
              visibility: faixa.length <= 8 || h % 3 === 0 ? 'visible' : 'hidden',
            }}
          >
            {String(h).padStart(2, '0')}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="h-2 w-2 rounded-[1px]" style={{ backgroundColor: cor }} />
          até o fim
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="h-2 w-2 rounded-[1px]" style={{ backgroundColor: `color-mix(in oklab, ${cor} 22%, transparent)` }} />
          interrompido
        </span>
      </div>
    </div>
  );
}
