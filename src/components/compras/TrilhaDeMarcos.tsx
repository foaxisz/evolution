import { Fragment } from 'react';
import { trilha, faltamPara } from '../../lib/marcos';

/**
 * A trilha de marcos da aba Compras.
 *
 * Recebe SÓ quantos itens foram conquistados — nunca o total da lista. É a
 * assinatura que corrige o defeito da barra anterior, que dividia pelo total
 * e por isso andava para trás quando um desejo novo entrava na lista.
 *
 * Tudo em flexbox, sem posicionamento absoluto: os pinos e os trechos se
 * alinham pela linha de base do contêiner. Uma versão anterior deste desenho
 * usava `absolute` com `left: %` e quebrava quando a caixa mudava de largura.
 */
export default function TrilhaDeMarcos({ conquistados }: { conquistados: number }) {
  const pontos = trilha(conquistados);
  const faltam = faltamPara(conquistados);

  return (
    <div className="border-t border-border p-4">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Rumo à sua melhor versão
        </p>
        <p className="font-arcade flex-shrink-0 text-[11px] leading-none text-accent-light">
          {conquistados}
        </p>
      </div>

      {/* `items-end`: os pinos têm o número em cima, então alinhar pelo topo
          desencontraria as alturas. Pelo pé, todos assentam na mesma linha. */}
      <div className="flex items-end" role="img" aria-label={`${conquistados} conquistados`}>
        {pontos.map((p, i) => (
          <Fragment key={p.marco}>
            {/* O trecho que CHEGA a este marco. Não existe antes do primeiro
                pino — ali a trilha começa, não vem de lugar nenhum. */}
            {i > 0 && (
              <div className="mb-[4.5px] h-[3px] flex-1 overflow-hidden rounded-full bg-bg-input">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${p.preenchimento * 100}%`,
                    backgroundColor: 'var(--color-accent)',
                    boxShadow: p.preenchimento > 0
                      ? '0 0 5px color-mix(in oklab, var(--color-accent) 40%, transparent)'
                      : undefined,
                  }}
                />
              </div>
            )}

            <div className="flex flex-col items-center gap-1.5">
              <span
                className="font-arcade text-[8px] leading-none transition-colors duration-300"
                style={{ color: p.aceso ? 'var(--color-accent-light)' : 'var(--color-text-muted)' }}
              >
                {p.marco}
              </span>
              {/* Quadrado de canto 2px, nunca círculo — é a mesma casa do
                  calendário e da bandeira de prioridade. O brilho é curto:
                  são seis pinos lado a lado, e halo largo repetido seis vezes
                  vira borrão, como já aconteceu nas prioridades. */}
              <span
                className="h-3 w-3 flex-shrink-0 rounded-[3px] border-2 transition-colors duration-300"
                style={{
                  backgroundColor: p.aceso ? 'var(--color-accent)' : 'var(--color-bg-primary)',
                  borderColor: p.aceso ? 'var(--color-accent)' : 'var(--color-border-light)',
                  boxShadow: p.aceso
                    ? '0 0 5px color-mix(in oklab, var(--color-accent) 45%, transparent)'
                    : undefined,
                }}
              />
            </div>
          </Fragment>
        ))}
      </div>

      <p className="mt-3 text-xs text-text-secondary">
        <span className="tabular-nums text-text-primary">
          {conquistados} {conquistados === 1 ? 'conquistado' : 'conquistados'}
        </span>
        {faltam !== null && ` · ${faltam === 1 ? 'falta 1' : `faltam ${faltam}`} para o próximo marco`}
      </p>
    </div>
  );
}
