import { caminho, type Acumulo } from '../../lib/evolucao';
import { formatarData } from '../../lib/data';
import NumeroRolante from '../ui/NumeroRolante';

const L = 620;
const A = 130;

/** Teto mínimo da escala. Sem ele, uma conclusão sozinha normaliza para o
 *  máximo e a área preenche o bloco inteiro — uma laje de cor que grita
 *  "cheio" quando na verdade a pessoa acabou de começar. */
const TETO_MINIMO = 6;
const FOLGA = 1.15;

/**
 * Conclusões acumuladas desde o primeiro registro.
 *
 * O bloco herói do painel, e o único que responde "estou avançando?" sem
 * rodeio: a curva não desce nunca, porque o que já foi feito não deixa de
 * ter sido feito. Um dia ruim achata o traço; não o derruba.
 *
 * O desenho mora numa TELA embutida — fundo afundado com grade de fósforo,
 * como mostrador de gabinete. É o que separa o dado da moldura e o que dá
 * corpo ao card; sem isso o traço flutua num retângulo vazio.
 */
export default function CurvaDeAcumulo({ dados, cor }: { dados: Acumulo; cor: string }) {
  const teto = Math.max(dados.total * FOLGA, TETO_MINIMO);
  const linha = caminho(dados.pontos, L, A, 0, teto);
  const area = `${linha} L${L},${A} L0,${A} Z`;

  // Altura da ponta em porcentagem, para posicionar a marca em HTML.
  // Dentro do SVG ela seria esticada junto com o traço: `preserveAspect
  // Ratio="none"` deforma qualquer forma fechada, e o quadrado virava um
  // retângulo raspando a borda do bloco.
  const topoDaPonta = (1 - dados.total / teto) * 100;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="font-arcade text-[1.5rem] leading-none tabular-nums"
          style={{ color: cor, textShadow: `0 0 20px color-mix(in oklab, ${cor} 45%, transparent)` }}
        >
          <NumeroRolante valor={dados.total} />
        </span>
        <span className="font-terminal text-[16px] leading-none text-text-secondary">
          conclusões acumuladas
        </span>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-bg-input/70">
        <svg
          viewBox={`0 0 ${L} ${A}`}
          width="100%"
          preserveAspectRatio="none"
          className="block h-32"
          role="img"
          aria-label={`${dados.total} conclusões acumuladas desde ${formatarData(dados.desde, "d 'de' MMMM 'de' yyyy")}`}
        >
          <defs>
            <linearGradient id="acumulo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity="0.38" />
              <stop offset="100%" stopColor={cor} stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={area} fill="url(#acumulo)" />
          <path
            d={linha}
            fill="none"
            stroke={`color-mix(in oklab, ${cor} 45%, white)`}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            className="linha-desenhando"
          />
        </svg>

        {/* Ponta acesa: quadrado de verdade, em HTML, afastado da borda. */}
        <span
          className="pointer-events-none absolute right-2 h-[7px] w-[7px] -translate-y-1/2"
          style={{
            top: `${topoDaPonta}%`,
            backgroundColor: `color-mix(in oklab, ${cor} 40%, white)`,
            boxShadow: `0 0 10px color-mix(in oklab, ${cor} 70%, transparent)`,
          }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-2 flex justify-between">
        <span className="font-arcade text-[0.4rem] leading-none text-text-muted">
          {formatarData(dados.desde, 'MMM')}
        </span>
        <span className="font-arcade text-[0.4rem] leading-none text-text-muted">hoje</span>
      </div>
    </div>
  );
}
