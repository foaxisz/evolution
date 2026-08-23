import { DIAS_CURTOS } from '../../lib/metricas';
import type { SemanaCorrente } from '../../lib/evolucao';

const ORDEM = [1, 2, 3, 4, 5, 6, 0]; // segunda primeiro

/**
 * A semana corrente em sete pastilhas.
 *
 * Não é gráfico de barras: todas as pastilhas têm a mesma altura, porque a
 * pergunta é binária — teve registro ou não teve. Altura variável aqui
 * sugeriria "quanto", que é outra pergunta e já tem bloco próprio.
 *
 * O dia que ainda não chegou fica mais apagado que o dia que passou em
 * branco. Confundir "não fiz" com "ainda não aconteceu" faria a
 * quarta-feira de segunda-feira parecer uma falha.
 */
export default function SemanaAtual({ dados, cor }: { dados: SemanaCorrente; cor: string }) {
  const { dias, decorridos, total, media } = dados;

  return (
    <div>
      <div className="flex items-end gap-3">
        <div className="flex min-w-0 flex-1 gap-1.5">
          {dias.map((feito, i) => {
            const futuro = i >= decorridos;
            return (
              <span
                key={i}
                className="h-11 flex-1 rounded-[3px]"
                style={{
                  backgroundColor: feito
                    ? cor
                    : futuro
                      ? 'color-mix(in oklab, var(--color-border) 45%, transparent)'
                      : 'var(--color-border)',
                  boxShadow: feito ? `0 0 12px color-mix(in oklab, ${cor} 40%, transparent)` : undefined,
                }}
                title={`${DIAS_CURTOS[ORDEM[i]]}: ${futuro ? 'ainda não chegou' : feito ? 'registrado' : 'sem registro'}`}
              />
            );
          })}
        </div>

        <span className="font-arcade flex-shrink-0 whitespace-nowrap text-[0.9rem] leading-none" style={{ color: cor }}>
          {total}
          <span className="text-[0.45rem] text-text-muted">/7</span>
        </span>
      </div>

      <div className="mt-2 flex gap-1.5 pr-[calc(2.5rem+0.75rem)]">
        {ORDEM.map(d => (
          <span key={d} className="font-arcade flex-1 text-center text-[0.4rem] leading-none text-text-muted">
            {DIAS_CURTOS[d]}
          </span>
        ))}
      </div>

      {media !== null && (
        <p className="font-terminal mt-3 flex items-center gap-2 text-[16px] leading-none">
          <span
            className="h-[3px] w-[3px] flex-shrink-0 rounded-[1px]"
            style={{ backgroundColor: total >= media ? 'var(--color-success)' : 'var(--color-text-muted)' }}
          />
          <span style={{ color: total >= media ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
            {total >= media ? 'melhor que' : 'abaixo d'}
            {total >= media ? '' : 'a'} sua média de {media.toFixed(1).replace('.', ',').replace(',0', '')}
          </span>
        </p>
      )}
    </div>
  );
}
