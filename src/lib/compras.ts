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

// ══════════════════════════════════════════════════════════════════════
// Relatório
// ══════════════════════════════════════════════════════════════════════

/** O mínimo que o relatório precisa saber de um item. */
export interface ItemDeRelatorio {
  name: string;
  price?: number;
  completed: boolean;
  createdAt?: string;
  completedAt?: string;
}

/**
 * O mês em que o item foi conquistado, 'YYYY-MM'.
 *
 * Item antigo pode não ter `completedAt` — o campo nasceu depois. Nesses
 * casos vale a data de criação, que é o mesmo desempate que a lista de
 * conquistados já usa para ordenar. Sem nenhuma das duas, o item fica de
 * fora: chutar um mês inventaria uma conquista que não aconteceu ali.
 */
function mesDaConquista(i: ItemDeRelatorio): string | null {
  const bruto = i.completedAt ?? i.createdAt;
  if (!bruto) return null;
  const d = new Date(bruto);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface MesDeCompras {
  /** 'YYYY-MM' */
  mes: string;
  quantidade: number;
  valor: number;
}

/**
 * As conquistas mês a mês, terminando no mês de `hoje`.
 *
 * Devolve TODOS os meses do intervalo, inclusive os vazios. Pular mês sem
 * conquista faria as barras mentirem sobre o ritmo: dois meses parados
 * virariam duas barras coladas, como se tivessem sido seguidos.
 */
export function porMes(
  itens: readonly ItemDeRelatorio[],
  hoje: string,
  meses = 12,
): MesDeCompras[] {
  const [ano, mes] = hoje.split('-').map(Number);
  const linha: MesDeCompras[] = [];
  for (let k = meses - 1; k >= 0; k--) {
    const d = new Date(ano, mes - 1 - k, 1);
    linha.push({
      mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      quantidade: 0,
      valor: 0,
    });
  }

  const porChave = new Map(linha.map(m => [m.mes, m]));
  for (const i of itens) {
    if (!i.completed) continue;
    const chave = mesDaConquista(i);
    const alvo = chave === null ? undefined : porChave.get(chave);
    if (!alvo) continue;
    alvo.quantidade += 1;
    alvo.valor += sao(i.price);
  }
  return linha;
}

export interface Recordes {
  maisCaro: { nome: string; valor: number } | null;
  melhorMes: { mes: string; quantidade: number } | null;
  esperaMaisLonga: { nome: string; dias: number } | null;
}

/**
 * Os três recordes do relatório.
 *
 * `melhorMes` varre TODO o histórico, não a janela de doze meses das barras:
 * um recorde que some da lista quando envelhece não é recorde.
 */
export function recordes(itens: readonly ItemDeRelatorio[], hoje: string): Recordes {
  let maisCaro: Recordes['maisCaro'] = null;
  let esperaMaisLonga: Recordes['esperaMaisLonga'] = null;
  const contagem = new Map<string, number>();

  const agora = new Date(`${hoje}T12:00:00`).getTime();

  for (const i of itens) {
    if (i.completed) {
      const v = sao(i.price);
      if (v > 0 && (maisCaro === null || v > maisCaro.valor)) {
        maisCaro = { nome: i.name, valor: v };
      }
      const chave = mesDaConquista(i);
      if (chave !== null) contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
      continue;
    }

    // Pendente: há quanto tempo espera.
    if (!i.createdAt) continue;
    const nascido = new Date(i.createdAt).getTime();
    if (Number.isNaN(nascido)) continue;
    const dias = Math.max(0, Math.floor((agora - nascido) / 86_400_000));
    if (esperaMaisLonga === null || dias > esperaMaisLonga.dias) {
      esperaMaisLonga = { nome: i.name, dias };
    }
  }

  let melhorMes: Recordes['melhorMes'] = null;
  for (const [mes, quantidade] of contagem) {
    if (melhorMes === null || quantidade > melhorMes.quantidade) {
      melhorMes = { mes, quantidade };
    }
  }

  return { maisCaro, melhorMes, esperaMaisLonga };
}
