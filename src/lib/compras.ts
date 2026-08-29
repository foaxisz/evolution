/**
 * Contas de dinheiro da aba Compras.
 *
 * Sem imports, como `marcos.ts`, `registros.ts` e `tarefas.ts`: roda no
 * `node` direto e dá para testar sem bundler.
 *
 * ── Por que existe tolerância ──
 *
 * O campo de preço obrigava um número seco para algo que ainda não foi
 * comprado — precisão que quase nunca se tem. "Por volta de dois mil e
 * trezentos" virava `2300`, e o total da lista somava fingimentos.
 *
 * Com tolerância, o item guarda o que se sabe de verdade, e o total vira uma
 * FAIXA. Um total que diz "entre 3.690 e 4.590" é honesto; um que diz
 * "4.140" não era.
 */

export interface Faixa {
  min: number;
  max: number;
}

function sao(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * A faixa de um item. `null` quando não há preço — item sem preço não entra
 * em conta nenhuma, e devolver `{0,0}` o faria pesar como se fosse grátis.
 */
export function faixaDePreco(preco?: number, tolerancia?: number): Faixa | null {
  const p = sao(preco);
  if (p <= 0) return null;

  // Tolerância maior que o preço daria mínimo negativo. Nada custa menos que
  // zero, então o piso fica ali.
  const t = Math.abs(sao(tolerancia));
  return { min: Math.max(0, p - t), max: p + t };
}

/** Soma as faixas de todos os itens que têm preço. */
export function totalDaLista(
  itens: readonly { price?: number; tolerancia?: number }[],
): Faixa {
  let min = 0;
  let max = 0;
  for (const i of itens) {
    const f = faixaDePreco(i.price, i.tolerancia);
    if (!f) continue;
    min += f.min;
    max += f.max;
  }
  return { min, max };
}

/** A faixa é exata quando as pontas coincidem — aí a tela mostra um número só. */
export function faixaExata(f: Faixa): boolean {
  return f.min === f.max;
}

/**
 * Quanto do preço já foi guardado, de 0 a 1.
 *
 * Sem preço devolve 0, e não 1: item sem preço não está "pago", está sem
 * informação — e uma barra cheia diria a coisa errada.
 */
export function progressoGuardado(guardado?: number, preco?: number): number {
  const p = sao(preco);
  const g = sao(guardado);
  if (p <= 0) return 0;
  return Math.min(1, Math.max(0, g / p));
}

/** Quanto ainda falta juntar. Nunca negativo — guardar a mais não vira crédito. */
export function faltaGuardar(guardado?: number, preco?: number): number {
  return Math.max(0, sao(preco) - sao(guardado));
}
