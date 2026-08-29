import { Fragment } from 'react';
import { trilha, MARCOS } from '../../lib/marcos';

/**
 * A trilha de marcos, desenhada como COTA de desenho técnico.
 *
 * A lógica não mudou uma linha — `lib/marcos.ts` e seus 23 testes seguem
 * intactos. Mudou só o desenho: traços perpendiculares sobre uma linha fina,
 * com uma seta na posição atual. É a diferença entre "barra de progresso
 * estilizada" e instrumento de medida.
 *
 * A regra que importa continua sendo a da assinatura: recebe só quantos itens
 * foram conquistados, nunca o total da lista. Foi o total que fazia a barra
 * anterior andar para trás quando um desejo novo entrava.
 */
export default function TrilhaDeMarcos({ conquistados }: { conquistados: number }) {
  const pontos = trilha(conquistados);

  /*
   * Onde a seta pousa, em porcentagem da largura.
   *
   * Os traços são igualmente espaçados na tela (cada trecho é `flex-1`),
   * então a posição não sai do NÚMERO conquistado — sai de quantos trechos
   * já foram andados mais o quanto do atual está preenchido. Interpolar pelo
   * número colocaria a seta longe do traço correspondente, porque o vão de 25
   * a 50 é doze vezes maior que o de 1 a 3 e ocupa o mesmo espaço.
   */
  const ultimoAceso = pontos.filter(p => p.aceso).length;
  const emAndamento = pontos[ultimoAceso]?.preenchimento ?? 0;
  const passo = 100 / (MARCOS.length - 1);
  const posicao = Math.min(100, Math.max(0, (ultimoAceso - 1 + emAndamento) * passo));

  return (
    // `pb-5` abre espaço para os números, que são posicionados por cima do
    // fluxo e por isso não empurram nada.
    <div className="relative mb-5 px-1 pb-5 pt-4">
      {conquistados > 0 && (
        <span
          className="font-arcade pointer-events-none absolute top-0 whitespace-nowrap text-[0.45rem] leading-none"
          style={{
            left: `${posicao}%`,
            // Acima de 85% a etiqueta sairia pela direita, então ela vira e
            // se ancora pelo fim em vez do começo.
            transform: posicao > 85 ? 'translateX(-100%)' : 'translateX(-4px)',
            color: 'var(--color-accent)',
          }}
        >
          ▼ VOCÊ
        </span>
      )}

      <div className="flex items-center" role="img" aria-label={`${conquistados} conquistados`}>
        {pontos.map((p, i) => {
          const primeiro = i === 0;
          const ultimo = i === pontos.length - 1;

          return (
            <Fragment key={p.marco}>
              {i > 0 && (
                <span className="h-px flex-1" style={{ backgroundColor: 'var(--color-border-light)' }}>
                  <span
                    className="block h-full transition-[width] duration-500"
                    style={{
                      width: `${p.preenchimento * 100}%`,
                      backgroundColor: 'var(--color-accent)',
                      boxShadow: p.preenchimento > 0
                        ? '0 0 6px color-mix(in oklab, var(--color-accent) 55%, transparent)'
                        : undefined,
                    }}
                  />
                </span>
              )}

              {/*
               * O traço e o NÚMERO na mesma coluna.
               *
               * Antes eram duas fileiras de flex independentes — traços em
               * cima, números embaixo — e elas nunca coincidiam: os números
               * do meio se centravam no próprio trecho, que não é o mesmo
               * lugar onde o traço cai. O resultado era cada número flutuando
               * ao lado da sua marca em vez de sob ela.
               *
               * Agora o número é ABSOLUTO dentro da coluna do traço, então
               * ele acompanha a marca por construção, em qualquer largura.
               */}
              <span className="relative h-[11px] w-px flex-shrink-0">
                <span
                  className="absolute inset-0 transition-colors duration-300"
                  style={{
                    backgroundColor: p.aceso ? 'var(--color-accent)' : 'var(--color-border-light)',
                    boxShadow: p.aceso
                      ? '0 0 6px color-mix(in oklab, var(--color-accent) 60%, transparent)'
                      : undefined,
                  }}
                />
                <span
                  className="font-arcade absolute top-[15px] whitespace-nowrap text-[0.5rem] leading-none transition-colors duration-300"
                  style={{
                    color: p.aceso ? 'var(--color-accent-light)' : 'var(--color-text-muted)',
                    // As pontas ancoram pela borda de dentro, senão metade do
                    // "1" sairia à esquerda e metade do "50" à direita.
                    left: ultimo ? undefined : primeiro ? 0 : '50%',
                    right: ultimo ? 0 : undefined,
                    transform: primeiro || ultimo ? undefined : 'translateX(-50%)',
                  }}
                >
                  {p.marco}
                </span>
              </span>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
