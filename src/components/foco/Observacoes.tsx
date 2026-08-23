import { useEffect, useRef, useState } from 'react';

/**
 * Anotação livre sobre o período.
 *
 * Ao contrário das metas, não tem modo de edição: o campo está sempre
 * aberto e sem moldura, então clicar embaixo do título já escreve. Havia
 * aqui um lápis que trocava o texto por uma caixa com borda — dois passos
 * e um salto visual para fazer o que o cursor sozinho resolve.
 *
 * Texto corrido, sem perguntas prontas e sem marcadores. Pergunta na tela
 * vira formulário, e formulário se preenche por obrigação; marcador viraria
 * uma segunda lista de metas logo abaixo da primeira. Aqui vai o que
 * aconteceu de fato — o que travou, o que mudou de plano —, que é a peça
 * que falta entre a intenção e os números.
 */
export default function Observacoes({
  texto, cor, onGravar,
}: { texto: string; cor: string; onGravar: (texto: string) => void }) {
  const [valor, setValor] = useState(texto);
  const campo = useRef<HTMLTextAreaElement>(null);

  // A altura acompanha o conteúdo. É o que permite não ter moldura: sem
  // isto o campo teria altura fixa e uma barra de rolagem por dentro, que
  // é justamente o aspecto de caixa que não se quer aqui.
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [valor]);

  return (
    <section>
      <div className="mb-2 flex h-4 items-center gap-2">
        <h2 className="font-arcade flex-shrink-0 text-[0.45rem] uppercase leading-[1.4]" style={{ color: cor }}>
          Observações
        </h2>
        <span className="h-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
      </div>

      <textarea
        ref={campo}
        value={valor}
        onChange={e => setValor(e.target.value)}
        // Grava ao sair do campo — clicar em qualquer lugar fora encerra.
        onBlur={() => {
          const limpo = valor.trim();
          setValor(limpo);
          onGravar(limpo);
        }}
        // Esc só tira o foco. Desfazer aqui surpreenderia: como não há modo
        // de edição, não há um "antes" visível para o qual voltar.
        onKeyDown={e => { if (e.key === 'Escape') campo.current?.blur(); }}
        rows={1}
        aria-label="Observações da semana"
        // Sem borda, sem fundo, sem respiro interno: tem que ler como o
        // texto da página, não como um campo em cima dela. `min-h` de uma
        // linha para haver onde clicar quando está vazio.
        className="font-terminal w-full resize-none border-0 bg-transparent p-0 text-[16px] leading-6 text-text-primary focus:outline-none"
        style={{ minHeight: '1.5rem' }}
      />
    </section>
  );
}
