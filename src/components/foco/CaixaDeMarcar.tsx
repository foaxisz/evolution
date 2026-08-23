import { useState } from 'react';
import { Check } from 'lucide-react';

/**
 * Caixa de marcar de uma tarefa.
 *
 * Existia copiada em três telas — lista da frente, cabine e histórico — e
 * era um quadrado de borda parada: nada acontecia ao chegar perto, então
 * não se anunciava como coisa clicável.
 *
 * O retorno de apontar é o tique aparecendo apagado ANTES do clique.
 * Prever a ação é o que faz uma caixa dessas parecer botão de verdade.
 *
 * O estado vem do React e o estilo é inline, não `:hover` com `var()` no
 * CSS: a cor é de cada frente, e passar cor de frente para regra de folha
 * exige custom property, que aqui é uma indireção a mais para resolver o
 * que uma linha de estado resolve.
 */
export default function CaixaDeMarcar({
  marcada, cor, rotulo, tamanho = 18, onAlternar,
}: {
  marcada: boolean;
  cor: string;
  rotulo: string;
  tamanho?: number;
  onAlternar: () => void;
}) {
  const [apontando, setApontando] = useState(false);

  return (
    <button
      onClick={onAlternar}
      onMouseEnter={() => setApontando(true)}
      onMouseLeave={() => setApontando(false)}
      onFocus={() => setApontando(true)}
      onBlur={() => setApontando(false)}
      aria-label={rotulo}
      aria-pressed={marcada}
      className="alvo-toque flex flex-shrink-0 items-center justify-center rounded-[3px] border-2 transition-[background-color,border-color] duration-200 focus:outline-none"
      style={{
        width: tamanho,
        height: tamanho,
        borderColor: marcada || apontando ? cor : 'var(--color-border-light)',
        // Preenchimento neutro ao apontar, não uma mistura da cor da frente:
        // quem sinaliza é a borda acesa mais o tique surgindo, e um
        // `color-mix` aqui é uma dependência a mais para um fundo que
        // praticamente não se vê.
        backgroundColor: marcada ? cor : apontando ? 'var(--color-bg-card-hover)' : 'transparent',
      }}
    >
      <Check
        size={Math.round(tamanho * 0.56)}
        strokeWidth={3}
        className="transition-opacity duration-200"
        style={{
          color: marcada ? 'var(--color-bg-primary)' : cor,
          opacity: marcada ? 1 : apontando ? 0.6 : 0,
        }}
      />
    </button>
  );
}
