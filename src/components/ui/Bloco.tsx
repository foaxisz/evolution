/**
 * Moldura de seção: título em fonte de arcade, fio até a borda, e o
 * `apoio` à direita — que é onde entra a leitura do hover, no lugar onde
 * já havia texto, em vez de abrir uma faixa nova sob o gráfico.
 *
 * O topo da borda vem tingido com a cor da seção; o resto fica na cor
 * neutra. É o traço de identidade sem virar caixa colorida.
 *
 * Com `destaque`, a borda de topo vem mais tingida e entra um anel fino de
 * 1px — é como a seção protagonista se separa das outras sem mudar de
 * tamanho, de fundo nem de cor do conteúdo.
 */
export default function Bloco({
  titulo, apoio, cor, destacado, destaque, acao, children,
}: {
  titulo: string;
  apoio?: string;
  cor: string;
  /** Tinge o `apoio` com a cor da seção — usado enquanto há leitura ativa. */
  destacado?: boolean;
  /** Seção protagonista: borda de topo mais forte e anel na borda. */
  destaque?: boolean;
  /** Slot à direita do cabeçalho: filtro, "ver todas", o que couber. */
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      // `h-full`: emparelhado numa linha de grade, o bloco preenche a
      // altura da linha em vez de fechar na altura do próprio conteúdo.
      // Sem isso, dois blocos lado a lado terminam em alturas diferentes e
      // a linha fica torta — o mais curto deixa um vão embaixo.
      className="relative flex h-full flex-col rounded-xl border bg-bg-card p-4 md:p-5"
      style={{
        borderColor: 'var(--color-border)',
        borderTopColor: `color-mix(in oklab, ${cor} ${destaque ? 70 : 40}%, var(--color-border))`,
        boxShadow: destaque ? `0 0 0 1px color-mix(in oklab, ${cor} 30%, transparent)` : undefined,
      }}
    >
      {/* Altura travada E `items-center`, não `items-baseline`.
          Com linha de base compartilhada, entrar um texto de corpo maior
          (o `apoio`, 11px, contra os 7,2px do título) reposiciona a base
          comum e o título sobe e desce a cada hover. Centralizado, cada
          item se coloca sozinho e nada se mexe. */}
      <div className="relative mb-4 flex h-4 items-center gap-2.5">
        {/* Marca de canal: o quadrado de 3px que abre rótulo importante no
            resto do app. Custa nada e é o que faz o cabeçalho parecer
            mostrador em vez de título de relatório. */}
        <span
          className="h-[5px] w-[5px] flex-shrink-0 rounded-[1px]"
          style={{ backgroundColor: cor, boxShadow: `0 0 8px color-mix(in oklab, ${cor} 60%, transparent)` }}
          aria-hidden="true"
        />
        <h2 className="font-arcade flex-shrink-0 text-[0.45rem] uppercase leading-[1.4]" style={{ color: cor }}>
          {titulo}
        </h2>
        <span className="h-px flex-1 bg-border" />
        {apoio && (
          <span
            className="flex-shrink-0 truncate text-[11px] leading-none tabular-nums transition-colors duration-150"
            style={{ color: destacado ? cor : 'var(--color-text-muted)' }}
            aria-live="polite"
          >
            {apoio}
          </span>
        )}
        {acao && <span className="flex-shrink-0">{acao}</span>}
      </div>

      <div className="relative">{children}</div>
    </section>
  );
}
