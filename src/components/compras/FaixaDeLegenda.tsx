import { faixaExata, type Faixa } from '../../lib/compras';

function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Faixa vira "R$ 1.000 – 1.400"; exata vira um número só. */
function escrever(f: Faixa): string {
  if (f.max === 0) return moeda(0);
  if (faixaExata(f)) return moeda(f.min);
  return `${moeda(f.min)} – ${moeda(f.max).replace(/^R\$\s?/, '')}`;
}

/**
 * O bloco de legenda da prancha: o que está em projeto e o que foi executado.
 *
 * Substitui um painel de duas colunas que tinha quatro linhas de cada lado, o
 * filtro de período pendurado só na direita — o que o deixava assimétrico e
 * alto — e traços no lugar dos números quando havia pouca coisa cadastrada.
 *
 * Aqui o DINHEIRO é o número grande e a contagem vira apoio: numa lista de
 * coisas para comprar, o que se quer saber é quanto, não quantos. E quando os
 * itens têm tolerância de preço, o valor sai como faixa — um total exato
 * somado de estimativas seria precisão inventada.
 */
export default function FaixaDeLegenda({
  emProjeto, executado,
}: {
  emProjeto: { itens: number; valor: Faixa };
  executado: { itens: number; valor: Faixa };
}) {
  const caixas = [
    { rotulo: 'Em projeto', dados: emProjeto, aceso: false },
    { rotulo: 'Executado', dados: executado, aceso: true },
  ];

  return (
    <div className="mb-5 flex gap-2.5">
      {caixas.map(c => (
        <div
          key={c.rotulo}
          className="flex-1 rounded-md border-solid px-4 py-3.5"
          style={{
            borderWidth: 1,
            borderColor: c.aceso
              ? 'color-mix(in oklab, var(--color-accent) 45%, transparent)'
              : 'var(--color-border)',
            backgroundColor: 'var(--color-bg-card)',
          }}
        >
          <p className="font-arcade text-[0.5rem] uppercase leading-none tracking-[0.06em] text-text-muted">
            {c.rotulo}
          </p>
          <p
            className="font-arcade mt-3 text-[1.05rem] leading-none"
            style={{ color: c.aceso ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
          >
            {escrever(c.dados.valor)}
          </p>
          <p className="mt-2.5 text-xs tabular-nums text-text-muted">
            {c.dados.itens} {c.dados.itens === 1 ? 'item' : 'itens'}
          </p>
        </div>
      ))}
    </div>
  );
}
