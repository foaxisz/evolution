interface SparklineProps {
  valores: number[];
  min?: number;
  max?: number;
  largura?: number;
  altura?: number;
  cor?: string;
}

/** Linha minúscula de evolução — usada nas áreas das reviews e por hábito. */
export default function Sparkline({
  valores, min = 0, max = 5, largura = 72, altura = 22, cor = 'var(--color-accent)',
}: SparklineProps) {
  if (valores.length === 0) return null;

  if (valores.length === 1) {
    return (
      <svg width={largura} height={altura}>
        <circle cx={largura / 2} cy={altura / 2} r={2.5} fill={cor} />
      </svg>
    );
  }

  const faixa = max - min || 1;
  const x = (i: number) => (i / (valores.length - 1)) * (largura - 6) + 3;
  const y = (v: number) => altura - 3 - ((v - min) / faixa) * (altura - 6);

  const d = valores.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  return (
    <svg width={largura} height={altura} style={{ display: 'block', overflow: 'visible' }}>
      <path d={d} fill="none" stroke={cor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <circle cx={x(valores.length - 1)} cy={y(valores[valores.length - 1])} r={2.6} fill={cor} />
    </svg>
  );
}
