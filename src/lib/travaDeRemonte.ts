/**
 * A trava que segura o remonte da página enquanto alguém está trabalhando.
 *
 * O app remonta a árvore inteira quando a sincronização traz novidade — é
 * o `<div key={versao}>` do App. Para uma lista isso é barato e correto:
 * desmonta, monta de novo, e o dado novo aparece.
 *
 * Para o quadro livre é destrutivo. O Excalidraw guarda no ESTADO DELE o
 * que não está no disco: o zoom, a posição da vista, a pilha de desfazer,
 * a ferramenta na mão. Remontar joga tudo isso fora e reconstrói a cena a
 * partir do `initialData` com `scrollToContent`. Medido: o zoom volta de
 * 110% para 100% e a vista salta de volta para o conteúdo. Quem estava
 * desenhando vê o quadro se resetar embaixo da mão — e como cada gravação
 * agenda um ciclo, isso acontecia sem parar.
 *
 * Então a novidade ESPERA. Enquanto a trava está de pé, o remonte não
 * acontece; ele é cobrado no instante em que a última trava cai. Nada se
 * perde: o dado novo já está no `localStorage`, que é de onde a página lê
 * quando finalmente remonta.
 *
 * O contador existe porque travar não é exclusivo — duas telas podem
 * querer segurar o remonte ao mesmo tempo, e a página só volta a remontar
 * quando a última soltar.
 */

let travas = 0;
const ouvintes = new Set<() => void>();

/**
 * Segura o remonte. Devolve a função que solta — feita para ser o retorno
 * de um `useEffect`, então o React solta sozinho no desmonte.
 */
export function travarRemonte(): () => void {
  travas++;
  let soltou = false;
  return () => {
    // Guarda contra soltar duas vezes: em modo estrito o React executa a
    // limpeza mais de uma vez, e um contador que desce a mais nunca mais
    // fecha — a trava ficaria negativa e o remonte passaria de novo.
    if (soltou) return;
    soltou = true;
    travas--;
    if (travas > 0) return;

    /*
     * Avisa no tique seguinte, e reconfere.
     *
     * Em modo estrito o React monta, desmonta e monta de novo na mesma
     * batida — soltar e travar outra vez acontece de forma síncrona. Avisar
     * ali mesmo cobraria o remonte no INSTANTE em que o quadro abriu, que é
     * exatamente o que esta trava existe para impedir. Esperar um tique e
     * conferir se a trava continua livre distingue o desmonte de verdade do
     * vai-e-volta do modo estrito.
     */
    queueMicrotask(() => {
      if (travas === 0) for (const f of ouvintes) f();
    });
  };
}

export function remonteTravado(): boolean {
  return travas > 0;
}

/** Avisa quando a última trava cair. Devolve a função que cancela o aviso. */
export function aoDestravarRemonte(f: () => void): () => void {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}
