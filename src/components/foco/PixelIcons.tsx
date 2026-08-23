/**
 * Ícones desenhados em pixel.
 *
 * `shapeRendering: crispEdges` desliga o antisserrilhado: as arestas ficam
 * duras, como sprite de máquina.
 *
 * Só entra aqui o que o conjunto padrão não tem. Play, check e afins têm
 * ícone pronto e desenhá-los à mão só piora — a versão em pixel deles saía
 * pequena, magra e estranha ao lado do resto.
 */

/** Lista: marcador e linha, três vezes. */
export function PixelLista({ tamanho = 14, cor }: { tamanho?: number; cor?: string }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 14 14"
      aria-hidden
      style={{ shapeRendering: 'crispEdges' }}
    >
      {[1, 6, 11].map(y => (
        <g key={y}>
          <rect x={0} y={y} width={3} height={2} fill={cor ?? 'currentColor'} />
          <rect x={5} y={y} width={9} height={2} fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}
