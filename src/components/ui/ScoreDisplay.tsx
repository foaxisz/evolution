interface ScoreDisplayProps {
  value: number;
  /** Largura em dígitos. Se omitida, deriva do valor de referência. */
  width?: number;
  /** Valor de referência para calcular a largura (ex: o alvo do desafio) */
  reference?: number;
  color?: string;
  className?: string;
}

/**
 * Placar estilo arcade com zero-padding. Os zeros à esquerda ficam
 * apagados, como num display de máquina — o número continua sendo
 * o dado real, só a apresentação é de placar.
 */
export default function ScoreDisplay({
  value,
  width,
  reference,
  color = 'var(--color-accent)',
  className = '',
}: ScoreDisplayProps) {
  const digits = width ?? String(Math.max(reference ?? value, value)).length;
  const padded = String(Math.max(0, Math.round(value))).padStart(digits, '0');
  const firstSignificant = padded.search(/[1-9]/);
  const leadingCount = firstSignificant === -1 ? padded.length - 1 : firstSignificant;

  return (
    <span className={`font-arcade tabular-nums ${className}`} aria-label={String(value)}>
      {padded.split('').map((d, i) => (
        <span
          key={i}
          style={
            i < leadingCount
              ? { color: 'var(--color-border-light)' }
              : { color, textShadow: `0 0 8px color-mix(in oklab, ${color} 55%, transparent)` }
          }
        >
          {d}
        </span>
      ))}
    </span>
  );
}
