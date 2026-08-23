/**
 * Placar: fileira de números com hairlines separando as células, como
 * leitura de painel de máquina.
 *
 * O fio entre células é o `gap-px` sobre um fundo da cor da borda — sem
 * `border` em cada célula, que dobraria a espessura nos encontros.
 *
 * Vive em `ui/` e não em `foco/` porque a mesma fileira ancora o histórico
 * de metas e o dashboard. Copiar em vez de compartilhar já custou caro
 * neste projeto: duas cópias do mesmo desenho divergem e viram duas telas
 * mostrando a mesma coisa de dois jeitos.
 */
export function Placar({ children, colunas = 4 }: { children: React.ReactNode; colunas?: 2 | 3 | 4 }) {
  // Classes literais: Tailwind não compila nome de classe montado em
  // tempo de execução.
  const grade = colunas === 2 ? 'grid-cols-2'
    : colunas === 3 ? 'grid-cols-3'
    : 'grid-cols-2 sm:grid-cols-4';
  return (
    <div className={`grid ${grade} gap-px overflow-hidden rounded-lg bg-border`}>
      {children}
    </div>
  );
}

/**
 * Uma célula do placar. `apoio` é a linha de contexto embaixo — tem altura
 * reservada mesmo vazia, senão células com e sem contexto ficam com alturas
 * diferentes e a fileira desalinha.
 *
 * Com `onClick`, vira botão: o número leva para a aba de onde ele veio.
 */
export function CelulaPlacar({
  rotulo, apoio, delta, sufixoDelta = '%', onClick, rotuloAcao, children,
}: {
  rotulo: string;
  apoio?: string;
  /** Variação contra o período anterior. `null` quando não há base de
   *  comparação — aí nada é mostrado, em vez de um "+100%" saído do nada. */
  delta?: number | null;
  sufixoDelta?: string;
  onClick?: () => void;
  /** Rótulo acessível da ação, quando `onClick` existe. */
  rotuloAcao?: string;
  children: React.ReactNode;
}) {
  const conteudo = (
    <>
      <p className="text-[9px] uppercase tracking-[0.18em] text-text-muted">{rotulo}</p>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        {children}
        {delta !== null && delta !== undefined && Math.round(delta) !== 0 && (
          <span
            className="text-[10px] font-semibold tabular-nums"
            style={{ color: delta > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
          >
            {/* Sinal explícito: o delta nunca é só cor. Em escala de cinza,
                ou para quem não distingue verde de vermelho, o `+`/`−` é o
                que sobra. */}
            {delta > 0 ? '+' : '−'}{Math.abs(Math.round(delta))}{sufixoDelta}
          </span>
        )}
      </div>
      <p className="mt-0.5 h-3 truncate text-[10px] leading-none text-text-muted">{apoio ?? ''}</p>
    </>
  );

  if (!onClick) {
    return <div className="bg-bg-card px-3.5 py-3">{conteudo}</div>;
  }

  return (
    <button
      onClick={onClick}
      aria-label={rotuloAcao}
      className="bg-bg-card px-3.5 py-3 text-left transition-colors hover:bg-bg-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-light"
    >
      {conteudo}
    </button>
  );
}

/** Número cru do placar: valor em corpo cheio, unidade em corpo pequeno. */
export function Cru({ valor, unidade, cor }: { valor: string; unidade?: string; cor: string }) {
  return (
    <span className="font-arcade inline-flex items-baseline leading-[1.45]" style={{ color: cor }}>
      <span className="text-[0.8rem]">{valor}</span>
      {unidade && <span className="ml-1.5 text-[0.45rem] text-text-muted">{unidade}</span>}
    </span>
  );
}
