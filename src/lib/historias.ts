/**
 * A prática de colecionar momentos — "Homework for Life".
 *
 * Sem imports, como os outros `lib` deste projeto: roda no `node` direto e
 * dá para testar sem bundler. Contagem de dias seguidos erra por um dia em
 * virada de mês, ano bissexto e fuso — invisível na tela, óbvio num teste.
 */

/** O mínimo que estas funções precisam saber de uma história. */
export interface ComData {
  /** 'YYYY-MM-DD' */
  data: string;
}

/** 'YYYY-MM-DD' de um `Date`, no fuso local. */
function paraISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

/**
 * Soma dias a 'YYYY-MM-DD'.
 *
 * Meio-dia, nunca meia-noite: em fuso negativo — o nosso — a meia-noite de um
 * dia cai no dia anterior em UTC e a data inteira anda uma casa.
 */
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  return paraISO(d);
}

export interface DiaDeHistorias<T> {
  dia: string;
  itens: T[];
}

/**
 * Agrupa por dia, do mais novo para o mais velho.
 *
 * Dentro do dia, a ordem de chegada é preservada — quem escreveu duas coisas
 * numa noite escreveu numa ordem, e ela é parte do relato.
 */
export function agruparPorDia<T extends ComData>(historias: readonly T[]): DiaDeHistorias<T>[] {
  const porDia = new Map<string, T[]>();
  for (const h of historias) {
    const lista = porDia.get(h.data);
    if (lista) lista.push(h);
    else porDia.set(h.data, [h]);
  }

  return [...porDia.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dia, itens]) => ({ dia, itens }));
}

/**
 * Quantos dias seguidos têm pelo menos uma história.
 *
 * ── A regra que importa ──
 *
 * Se ainda não há entrada de HOJE, a contagem parte de ONTEM. A prática é de
 * escrever à noite: sem esta regra, às três da tarde a tela diria que a
 * sequência quebrou, punindo justamente quem ainda vai cumprir o ritual.
 *
 * A sequência só chega a zero quando ontem TAMBÉM está vazio — aí ela quebrou
 * de verdade.
 */
export function sequencia(historias: readonly ComData[], hoje: string): number {
  if (historias.length === 0) return 0;

  const dias = new Set(historias.map(h => h.data));

  // Onde a contagem começa: hoje, se já houver; senão ontem.
  let cursor = dias.has(hoje) ? hoje : somarDias(hoje, -1);
  if (!dias.has(cursor)) return 0;

  let n = 0;
  while (dias.has(cursor)) {
    n++;
    cursor = somarDias(cursor, -1);
  }
  return n;
}

/** Já existe história para este dia? Serve para o campo de hoje se anunciar. */
export function temNoDia(historias: readonly ComData[], dia: string): boolean {
  return historias.some(h => h.data === dia);
}

/**
 * Os meses que têm história, do mais novo para o mais velho.
 *
 * Só os que existem: um seletor com meses vazios faria o usuário escolher
 * uma vista garantidamente em branco.
 */
export function mesesComHistoria(historias: readonly ComData[]): string[] {
  return [...new Set(historias.map(h => h.data.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
}

/** Filtra por 'YYYY-MM'. `null` devolve tudo. */
export function doMes<T extends ComData>(historias: readonly T[], mes: string | null): T[] {
  return mes === null ? [...historias] : historias.filter(h => h.data.startsWith(mes));
}

/**
 * As histórias como planilha.
 *
 * Ponto e vírgula, não vírgula: o Excel em português decide o separador pela
 * configuração regional, e um CSV com vírgula abre com tudo espremido na
 * coluna A. Mesma convenção do relatório de foco.
 *
 * Sai em ordem CRESCENTE, ao contrário da tela: numa planilha se lê a vida
 * do começo para o fim, e é assim que o Dicks mantém a dele.
 */
export function montarCSVDeHistorias(historias: readonly (ComData & { texto: string })[]): string {
  const campo = (v: string) =>
    /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

  const linhas = [...historias]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(h => [campo(h.data), campo(h.texto)].join(';'));

  return ['Data;História', ...linhas].join('\n');
}
