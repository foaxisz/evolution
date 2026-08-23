interface ProgressRingProps {
  value: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  /** Quantidade de ticks do medidor radial */
  ticks?: number;
  /**
   * Conteúdo do centro. Sem isto mostra a porcentagem — que fica em "0"
   * por muito tempo quando a meta é grande (2 de 1000 = 0,2%) e parece
   * que o contador não está funcionando.
   */
  centro?: React.ReactNode;
}

/**
 * Medidor radial segmentado — cada tick é um traço discreto,
 * como um gauge de painel/arcade em vez de um anel liso.
 */
export default function ProgressRing({
  value,
  size = 80,
  strokeWidth = 7,
  color = 'var(--color-accent)',
  ticks = 28,
  centro,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const center = size / 2;
  const outer = center - 1;
  const inner = outer - strokeWidth;
  const litCount = Math.round((clamped / 100) * ticks);

  const segments = Array.from({ length: ticks }, (_, i) => {
    // -90deg para começar às 12h
    const angle = (i / ticks) * 2 * Math.PI - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      i,
      x1: center + inner * cos,
      y1: center + inner * sin,
      x2: center + outer * cos,
      y2: center + outer * sin,
      lit: i < litCount,
    };
  });

  // Largura derivada do espaçamento entre traços, não do tamanho do anel.
  // Com a fórmula antiga (size/24) os traços ficavam mais largos que o
  // espaço entre eles em anéis grandes e o medidor virava um círculo sólido.
  const raioMedio = (outer + inner) / 2;
  const espacamento = (2 * Math.PI * raioMedio) / ticks;
  const tickW = Math.max(2, espacamento * 0.5);

  const anel = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${Math.round(clamped)}% concluído`}
      style={{ display: 'block' }}
    >
      {/* Traços apagados: sem filtro nenhum */}
      {segments.filter(s => !s.lit).map(s => (
        <line
          key={s.i}
          x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke="var(--color-border)"
          strokeWidth={tickW}
          strokeLinecap="butt"
        />
      ))}

      {/* Traços acesos agrupados sob UM único drop-shadow. Antes cada traço
          tinha o seu (64 filtros repintando a cada frame). */}
      <g style={{ filter: `drop-shadow(0 0 ${Math.max(2, tickW * 0.6)}px ${color})` }}>
        {segments.filter(s => s.lit).map(s => (
          <line
            key={s.i}
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke={color}
            strokeWidth={tickW}
            strokeLinecap="butt"
          />
        ))}
      </g>

      {!centro && (
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--color-text-primary)"
          fontSize={size * 0.19}
          className="font-arcade"
        >
          {Math.round(clamped)}
        </text>
      )}
    </svg>
  );

  if (!centro) return anel;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {anel}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {centro}
      </div>
    </div>
  );
}
