import type { Marca } from '../../lib/evolucao';

/**
 * Recordes pessoais, em células de placar.
 *
 * Marca não é medalha. Medalha premia um limiar que o app escolheu — 100
 * conclusões, 30 dias — e isso é gamificação, que o projeto recusa. Marca
 * é o melhor que a própria pessoa já fez, com a data em que fez, e serve
 * como alvo: existe para ser batida, não para ser exibida.
 *
 * Por isso cada uma carrega o CONTEXTO. "19 dias" sozinho é troféu;
 * "19 dias, terminou em 2 de junho" é um ponto na sua história.
 */
export default function SuasMarcas({ marcas, cor }: { marcas: Marca[]; cor: string }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2">
      {marcas.map(m => (
        <div key={m.id} className="bg-bg-card px-3.5 py-3">
          <p className="text-[9px] uppercase tracking-[0.18em] text-text-muted">{m.rotulo}</p>
          <p className="mt-2 flex items-baseline leading-none">
            <span className="font-arcade text-[0.8rem] leading-[1.45] tabular-nums" style={{ color: cor }}>
              {m.valor}
            </span>
            <span className="font-terminal text-[15px] text-text-muted">{m.unidade}</span>
          </p>
          <p className="font-terminal mt-1 truncate text-[15px] leading-none text-text-muted">{m.contexto}</p>
        </div>
      ))}
    </div>
  );
}
