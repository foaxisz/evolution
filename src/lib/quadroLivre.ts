/**
 * As decisões do quadro livre que dá para testar sem navegador.
 *
 * Sem imports, como os outros `lib` daqui: roda no `node` direto.
 */

/** O pedaço de um elemento de cena que interessa para copiar texto. */
export interface ElementoDeCena {
  id: string;
  type: string;
  /** O texto como está DESENHADO, já com as quebras que o Excalidraw
   *  inventou para caber na largura da caixa. */
  text?: string;
  /** O texto como foi ESCRITO, com as quebras de quem escreveu. */
  originalText?: string;
  isDeleted?: boolean;
}

/** Separa um texto do próximo quando a seleção tem mais de um. */
export const SEPARADOR = '\n\n';

/**
 * O texto de uma seleção do quadro — ou `null` quando não é caso de texto.
 *
 * Ctrl+C no Excalidraw copia o JSON dos elementos, e isso é CERTO: é assim
 * que se cola uma forma em outro quadro, com cor, tamanho e posição. O
 * problema é o caso mais comum de todos, que é escrever um texto na
 * prancheta e querer levá-lo para fora — aí o que cola no outro programa é
 * um `{"type":"excalidraw/clipboard",...}` de mil caracteres, inútil.
 *
 * Então a regra é estreita de propósito: só quando TUDO o que está
 * selecionado é texto. Um texto junto de um retângulo continua indo como
 * elemento, porque aí quem copiou quer as formas — e adivinhar errado
 * custaria o copiar-e-colar entre quadros, que é o que a função nativa faz
 * bem.
 *
 * Devolve `originalText` e não `text`: o segundo traz as quebras de linha
 * que o Excalidraw inseriu para caber na largura da caixa, e essas quebras
 * não são do texto — coladas num editor, viram lixo no meio das frases.
 */
export function textoDaSelecao(
  elementos: readonly ElementoDeCena[],
  selecionados: Readonly<Record<string, boolean>>,
): string | null {
  const escolhidos = elementos.filter(e => !e.isDeleted && selecionados[e.id]);
  if (escolhidos.length === 0) return null;
  if (escolhidos.some(e => e.type !== 'text')) return null;

  const texto = escolhidos
    .map(e => e.originalText ?? e.text ?? '')
    .join(SEPARADOR);

  // Seleção de texto vazio não vale a intervenção: melhor deixar o
  // comportamento nativo do que entregar uma área de transferência vazia e
  // deixar a pessoa achando que o copiar falhou.
  return texto.trim() === '' ? null : texto;
}
