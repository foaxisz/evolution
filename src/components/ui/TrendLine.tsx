interface Ponto {
  rotulo: string;
  valor: number; // 0..100
}

interface TrendLineProps {
  pontos: Ponto[];
  altura?: number;
  cor?: string;
}

/** Regressão linear simples — usada para desenhar a reta de tendência. */
export function calcularTendencia(valores: number[]): { inclinacao: number; intercepto: number } {
  const n = valores.length;
  if (n < 2) return { inclinacao: 0, intercepto: valores[0] ?? 0 };
  const somaX = (n * (n - 1)) / 2;
  const mediaX = somaX / n;
  const mediaY = valores.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  valores.forEach((y, x) => {
    num += (x - mediaX) * (y - mediaY);
    den += (x - mediaX) ** 2;
  });
  const inclinacao = den === 0 ? 0 : num / den;
  return { inclinacao, intercepto: mediaY - inclinacao * mediaX };
}

/**
 * Área + linha de consistência (0–100%) com a reta de tendência sobreposta.
 * Normalizar em porcentagem é o que permite comparar semanas mesmo quando
 * você cria hábitos novos — contagem crua faria parecer que piorou.
 */
export default function TrendLine({ pontos, altura = 150, cor = 'var(--color-accent)' }: TrendLineProps) {
  const W = 520;
  const H = altura;
  const PAD_B = 22;
  const PAD_T = 10;
  const chartH = H - PAD_B - PAD_T;

  if (pontos.length < 2) return null;

  const x = (i: number) => (i / (pontos.length - 1)) * (W - 16) + 8;
  const y = (v: number) => PAD_T + chartH - (Math.max(0, Math.min(100, v)) / 100) * chartH;

  const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.valor)}`).join(' ');
  const area = `${linha} L ${x(pontos.length - 1)} ${PAD_T + chartH} L ${x(0)} ${PAD_T + chartH} Z`;

  const { inclinacao, intercepto } = calcularTendencia(pontos.map(p => p.valor));
  const tendInicio = intercepto;
  const tendFim = inclinacao * (pontos.length - 1) + intercepto;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grades em 25 / 50 / 75 / 100% */}
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={8} x2={W - 8} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth={1} opacity={v === 0 ? 0.8 : 0.35} />
          <text x={0} y={y(v) - 2} fontSize={8} fill="var(--color-text-muted)">{v}</text>
        </g>
      ))}

      <path d={area} fill="url(#trend-fill)" />

      {/* reta de tendência */}
      <line
        x1={x(0)} y1={y(tendInicio)}
        x2={x(pontos.length - 1)} y2={y(tendFim)}
        stroke="var(--color-text-muted)"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />

      <path d={linha} fill="none" stroke={cor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {pontos.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.valor)} r={i === pontos.length - 1 ? 4 : 2.5} fill={cor}>
          <title>{`${p.rotulo}: ${Math.round(p.valor)}%`}</title>
        </circle>
      ))}

      {pontos.map((p, i) =>
        i % Math.ceil(pontos.length / 6) === 0 || i === pontos.length - 1 ? (
          <text key={`l${i}`} x={x(i)} y={H - 6} fontSize={9} fill="var(--color-text-muted)" textAnchor="middle">
            {p.rotulo}
          </text>
        ) : null
      )}
    </svg>
  );
}
