interface RelogioArcadeProps {
  /** Texto já formatado, tipo "24:59" ou "1:05:00". */
  tempo: string;
  cor: string;
  /** Tamanho da fonte em rem. */
  tamanho: number;
  className?: string;
}

/**
 * Relógio no idioma de placar de arcade: cada dígito é desenhado à parte,
 * e os zeros à esquerda ficam apagados — o display da máquina sempre teve
 * todas as casas acesas, só que as inúteis em brasa baixa.
 *
 * Mesma ideia do `ScoreDisplay`, mas para tempo: ali a largura vem do
 * valor de referência, aqui o texto já chega formatado com os dois-pontos.
 */
export default function RelogioArcade({ tempo, cor, tamanho, className = '' }: RelogioArcadeProps) {
  // Apaga os zeros do começo até achar o primeiro dígito de verdade. Os
  // dois-pontos nunca apagam: são a moldura do display, não conteúdo.
  const primeiroSignificativo = tempo.search(/[1-9]/);
  const apagarAte = primeiroSignificativo === -1 ? 0 : primeiroSignificativo;

  return (
    <span
      className={`font-arcade tabular-nums leading-none ${className}`}
      style={{ fontSize: `${tamanho}rem` }}
      aria-label={`${tempo} restantes`}
    >
      {tempo.split('').map((ch, i) => {
        const apagado = i < apagarAte && ch === '0';
        return (
          <span
            key={i}
            style={
              apagado
                ? { color: 'var(--color-border-light)' }
                : {
                    color: cor,
                    // Halo curto e fraco: um brilho largo transformava o
                    // display em borrão neon e comia a nitidez do pixel.
                    textShadow: `0 0 5px color-mix(in oklab, ${cor} 30%, transparent)`,
                  }
            }
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}
