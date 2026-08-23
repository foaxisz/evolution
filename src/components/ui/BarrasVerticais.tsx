import { useState } from 'react';

/**
 * Trilho apagado marcando o lugar de cada item, barra a 50% que só fecha
 * na cor cheia sob o cursor, rótulo acendendo junto.
 *
 * Existia em duplicata — dia da semana no painel de dados, dia do período
 * no histórico de metas — e as duas cópias divergiram até desenharem a
 * mesma coisa de dois jeitos. O que de fato muda entre os usos é só ONDE a
 * leitura aparece, e isso entra por função: `rotulo` decide o texto sob a
 * barra, `onApontar` avisa quem mostra o valor em outro lugar. Nenhum dos
 * dois precisa de um sinalizador de modo.
 *
 * Mora em `ui/` porque deixou de ser peça do Foco: o dashboard desenha a
 * série de constância com o mesmo componente.
 */
export default function BarrasVerticais({
  valores, cor, rotulo, onApontar, larguraMaxima, descricao,
}: {
  valores: number[];
  cor: string;
  /** Texto sob a barra `i`. `aceso` diz se é a barra apontada. */
  rotulo: (i: number, aceso: boolean) => string;
  onApontar?: (i: number | null) => void;
  /** Teto de largura da barra, em CSS. Sem isto, poucas barras numa faixa
   *  larga viram tijolo. */
  larguraMaxima?: string;
  /** Frase lida por leitor de tela para a barra `i`. */
  descricao?: (i: number) => string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const pico = Math.max(1, ...valores);

  // Barra zerada não responde ao mouse: não há valor para ler, e a barra
  // ausente já disse que ali não houve nada.
  function apontar(i: number | null) {
    const alvo = i === null || valores[i] === 0 ? null : i;
    setAtivo(alvo);
    onApontar?.(alvo);
  }

  return (
    <div onMouseLeave={() => apontar(null)}>
      <div className="flex h-24 items-end gap-2">
        {valores.map((v, i) => (
          <button
            key={i}
            className="relative flex h-full flex-1 items-end focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
            onMouseEnter={() => apontar(i)}
            onFocus={() => apontar(i)}
            onBlur={() => apontar(null)}
            aria-label={descricao?.(i)}
          >
            <div className="relative mx-auto flex h-full w-full items-end" style={{ maxWidth: larguraMaxima }}>
              <span className="absolute inset-0 bg-bg-input/40" aria-hidden="true" />
              <span
                className="barra-crescendo relative w-full transition-[background-color] duration-150"
                style={{
                  // Piso de 3%: barra invisível e barra ausente contam
                  // coisas diferentes e não podem parecer a mesma.
                  height: v > 0 ? `${Math.max(3, (v / pico) * 100)}%` : '0%',
                  backgroundColor: ativo === i ? cor : `color-mix(in oklab, ${cor} 50%, transparent)`,
                  animationDelay: `${i * 40}ms`,
                }}
                aria-hidden="true"
              />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        {valores.map((_, i) => {
          const aceso = ativo === i;
          return (
            <span
              key={i}
              className="font-arcade flex-1 whitespace-nowrap text-center text-[0.4rem] leading-none transition-colors"
              style={{
                color: aceso ? cor : 'var(--color-text-muted)',
                textShadow: aceso ? `0 0 10px color-mix(in oklab, ${cor} 60%, transparent)` : undefined,
              }}
            >
              {rotulo(i, aceso)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
