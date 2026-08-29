/**
 * A trilha de marcos da aba Compras.
 *
 * Sem nenhum import, como `registros.ts` e `tarefas.ts`: roda no `node`
 * direto e dá para testar sem bundler.
 *
 * ── Por que isto existe ──
 *
 * A barra anterior mostrava `conquistados ÷ (pendentes + conquistados)`.
 * Como o total incluía o que ainda faltava comprar, adicionar um desejo novo
 * DERRUBAVA a porcentagem: 3 de 6 é 50%, some um sétimo item e vira 43%.
 * Numa aba chamada "Rumo à sua melhor versão", sonhar mais alto fazia a
 * barra andar para trás.
 *
 * A correção está na assinatura destas funções: elas recebem só quantos
 * itens foram conquistados. O total da lista nem chega aqui, então não há
 * como ele empurrar o progresso para trás.
 */

export const MARCOS = [1, 3, 5, 10, 25, 50] as const;

/**
 * Normaliza a contagem.
 *
 * Contagem vem de `filter().length`, então na prática é sempre um inteiro
 * são. Mas um `NaN` chegando aqui viraria `NaN` em toda largura de CSS e
 * apagaria a trilha inteira da tela — barato demais para não proteger.
 */
function saneada(conquistados: number): number {
  if (!Number.isFinite(conquistados)) return 0;
  return Math.max(0, Math.floor(conquistados));
}

/** O próximo marco a bater. `null` quando já passou do último. */
export function proximoMarco(conquistados: number): number | null {
  const n = saneada(conquistados);
  return MARCOS.find(m => m > n) ?? null;
}

/** Quantos faltam para o próximo marco. `null` quando já passou do último. */
export function faltamPara(conquistados: number): number | null {
  const alvo = proximoMarco(conquistados);
  return alvo === null ? null : alvo - saneada(conquistados);
}

export interface PontoDaTrilha {
  marco: number;
  /** Já foi batido. */
  aceso: boolean;
  /**
   * De 0 a 1: quanto do trecho que CHEGA a este marco está preenchido.
   *
   * O trecho enche proporcionalmente em vez de acender de uma vez ao bater o
   * marco. Entre o marco 25 e o 50 são vinte e cinco itens — com a linha
   * binária, a trilha ficaria parada esse tempo todo, e uma progressão que
   * não se move é o oposto do que esta tela existe para fazer. O pino ainda
   * só acende no marco; o que anda a cada item é a linha.
   */
  preenchimento: number;
}

/**
 * O estado de desenho da trilha, um item por marco.
 *
 * Devolve tudo mastigado para o componente não fazer conta nenhuma — mesmo
 * arranjo de `ordenarTarefas` e `reordenar`, e é o que permite testar a
 * trilha inteira sem renderizar nada.
 */
export function trilha(conquistados: number): PontoDaTrilha[] {
  const n = saneada(conquistados);

  return MARCOS.map((marco, i) => {
    // O trecho que chega ao primeiro marco começa no zero.
    const anterior = i === 0 ? 0 : MARCOS[i - 1];
    const vao = marco - anterior;
    const andado = n - anterior;

    return {
      marco,
      aceso: n >= marco,
      preenchimento: Math.min(1, Math.max(0, andado / vao)),
    };
  });
}
