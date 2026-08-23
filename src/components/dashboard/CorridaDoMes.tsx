import { caminho, type Corrida } from '../../lib/evolucao';

const L = 620;
const A = 110;

/**
 * O mês corrente correndo contra o anterior.
 *
 * Duas curvas acumuladas na MESMA escala, alinhadas pelo dia do mês. É a
 * única comparação do painel que não é contra um ideal: é contra você
 * mesmo, um mês atrás, no mesmo ponto do calendário.
 *
 * A curva de trás vai inteira, até o fim do mês passado, e a da frente
 * para no dia de hoje. Assim o pontilhado à direita do ponto atual é
 * literalmente a marca que falta bater.
 */
export default function CorridaDoMes({ dados, cor }: { dados: Corrida; cor: string }) {
  const { atual, anterior, diasNoAnterior, nomeAtual, nomeAnterior, vantagem } = dados;

  // Escala compartilhada: duas curvas em escalas próprias não se comparam,
  // e o desenho mentiria mostrando a menor tão alta quanto a maior.
  const pico = Math.max(1, atual[atual.length - 1] ?? 0, anterior[anterior.length - 1] ?? 0);
  const larguraPorDia = L / Math.max(1, diasNoAnterior - 1);

  const traco = (serie: number[]) => caminho(serie, larguraPorDia * (serie.length - 1), A - 14, 6, pico);
  const ultimoY = 6 + (A - 14) - ((atual[atual.length - 1] ?? 0) / pico) * (A - 14);
  const ultimoX = larguraPorDia * (atual.length - 1);

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border border-border bg-bg-input/70">
        <svg
          viewBox={`0 0 ${L} ${A}`}
          width="100%"
          preserveAspectRatio="none"
          className="block h-28"
          role="img"
          aria-label={`${nomeAtual} contra ${nomeAnterior}: ${atual[atual.length - 1] ?? 0} contra ${anterior[anterior.length - 1] ?? 0} conclusões`}
        >
          <defs>
            <linearGradient id="corrida" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={cor} stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={`${traco(atual)} L${ultimoX},${A} L0,${A} Z`} fill="url(#corrida)" />

          {/* Mês anterior: pontilhado e apagado — é referência, não sujeito. */}
          <path
            d={traco(anterior)}
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            opacity="0.7"
          />

          <path
            d={traco(atual)}
            fill="none"
            stroke={`color-mix(in oklab, ${cor} 45%, white)`}
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            className="linha-desenhando"
          />
        </svg>

        {/* Ponta em HTML: dentro do SVG esticado ela viraria retângulo. */}
        <span
          className="pointer-events-none absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${(ultimoX / L) * 100}%`,
            top: `${(ultimoY / A) * 100}%`,
            backgroundColor: `color-mix(in oklab, ${cor} 40%, white)`,
            boxShadow: `0 0 10px color-mix(in oklab, ${cor} 70%, transparent)`,
          }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="font-arcade text-[0.4rem] leading-none text-text-muted">dia 1</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-3 rounded-[1px]" style={{ backgroundColor: `color-mix(in oklab, ${cor} 45%, white)` }} />
            <span className="font-arcade text-[0.4rem] leading-none" style={{ color: cor }}>{nomeAtual}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-3 border-t border-dashed border-text-muted" />
            <span className="font-arcade text-[0.4rem] leading-none text-text-muted">{nomeAnterior}</span>
          </span>
        </span>
        <span className="font-arcade text-[0.4rem] leading-none text-text-muted">dia {diasNoAnterior}</span>
      </div>

      {vantagem !== null && Math.round(vantagem) !== 0 && (
        <p className="font-terminal mt-3 text-[16px] leading-none">
          <span style={{ color: vantagem > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
            {vantagem > 0
              ? `você está ${Math.round(vantagem)}% à frente de ${nomeAnterior} no mesmo dia`
              : `${Math.abs(Math.round(vantagem))}% atrás de ${nomeAnterior} no mesmo dia`}
          </span>
        </p>
      )}
    </div>
  );
}
