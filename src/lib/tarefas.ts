/**
 * Regras de vencimento, prioridade e ordem das tarefas.
 *
 * Vive sem nenhum import de propósito, como o `registros.ts`: assim roda no
 * `node` direto e dá para testar sem bundler nem framework. Aritmética de
 * data e reordenação são exatamente o tipo de código em que o erro é de um
 * dia ou de uma posição — invisível na tela, óbvio num teste.
 */

/**
 * Prioridade é 1, 2 ou 3 — nunca 4.
 *
 * A bandeira cinza do menu é a AUSÊNCIA de prioridade, não um quarto nível.
 * Guardar um `4` para "nenhuma" criaria dois jeitos de dizer a mesma coisa,
 * e aí todo lugar que lê o campo teria de saber dos dois.
 */
export type Prioridade = 1 | 2 | 3;

/**
 * Fósforo de arcade, não cor de painel.
 *
 * A primeira versão reusava sucesso/aviso/perigo do tema, para não
 * introduzir cor nova. Errado: aquelas existem para conviver com texto e
 * gráfico sem gritar — o verde é menta e o "perigo" é rosa-choque. Bandeira
 * de prioridade é sinal, e sinal de arcade é saturado: vermelho tem de ler
 * como VERMELHO.
 */
export const PRIORIDADES: { nivel: Prioridade; rotulo: string; cor: string }[] = [
  { nivel: 1, rotulo: 'Baixa', cor: 'var(--color-prio-baixa)' },
  { nivel: 2, rotulo: 'Média', cor: 'var(--color-prio-media)' },
  { nivel: 3, rotulo: 'Alta', cor: 'var(--color-prio-alta)' },
];

/** A bandeira cinza: tirar a prioridade. */
export const SEM_PRIORIDADE_COR = 'var(--color-text-muted)';

export function corDaPrioridade(p: Prioridade | undefined): string | null {
  return PRIORIDADES.find(x => x.nivel === p)?.cor ?? null;
}

// ══════════════════════════════════════════════════════════════════════
// Datas
// ══════════════════════════════════════════════════════════════════════

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Meio-dia, nunca meia-noite.
 *
 * Em fuso negativo — o nosso — a meia-noite de um dia cai no dia anterior
 * em UTC, e a data inteira anda uma casa. É a mesma precaução que o
 * calendário do painel de metas já toma.
 */
function comoData(dia: string): Date {
  return new Date(`${dia}T12:00:00`);
}

/** 'YYYY-MM-DD' de um `Date`, no fuso local. */
export function paraISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

/** O dia de hoje, no fuso local. */
export function hojeISO(): string {
  return paraISO(new Date());
}

/** Soma dias a uma data 'YYYY-MM-DD', sem escorregar de mês nem de fuso. */
export function somarDias(dia: string, n: number): string {
  const d = comoData(dia);
  d.setDate(d.getDate() + n);
  return paraISO(d);
}

/** Quantos dias de `de` até `para`. Negativo quando `para` já passou. */
export function diferencaEmDias(de: string, para: string): number {
  const ms = comoData(para).getTime() - comoData(de).getTime();
  return Math.round(ms / 86_400_000);
}

export interface RotuloDeVencimento {
  texto: string;
  /** Já passou. Quem desenha pinta de vermelho. */
  atrasado: boolean;
}

/**
 * O texto do selo à direita da tarefa.
 *
 * Escala do mais útil para o menos: quando é hoje ou amanhã, o nome do dia
 * diz tudo e a data seria ruído. Dentro da semana, o dia da semana já
 * localiza sem precisar contar. Passando disso, só a data resolve.
 */
export function rotuloDeVencimento(dueDate: string, hoje: string): RotuloDeVencimento {
  const dias = diferencaEmDias(hoje, dueDate);

  if (dias === 0) return { texto: 'Hoje', atrasado: false };
  if (dias === 1) return { texto: 'Amanhã', atrasado: false };
  if (dias === -1) return { texto: 'Ontem', atrasado: true };

  const d = comoData(dueDate);
  const curto = `${d.getDate()} ${MESES[d.getMonth()]}`;

  if (dias < 0) return { texto: curto, atrasado: true };
  // Dentro dos próximos 6 dias o nome do dia basta e é mais rápido de ler.
  if (dias <= 6) return { texto: DIAS[d.getDay()], atrasado: false };

  // Ano diferente: sem o ano, "3 fev" do ano que vem parece atrasado.
  const anoDeHoje = comoData(hoje).getFullYear();
  return {
    texto: d.getFullYear() === anoDeHoje ? curto : `${curto} ${d.getFullYear()}`,
    atrasado: false,
  };
}

/**
 * Sempre 42 casas: seis semanas começando no domingo anterior ao dia 1º.
 *
 * Fixar em seis é o que impede o calendário de mudar de altura ao virar o
 * mês e fazer o menu inteiro pular. As casas que sobram mostram os dias
 * vizinhos, o que também tira o recorte irregular das pontas.
 */
export function gradeDeSeisSemanas(mes: string): string[] {
  const [ano, m] = mes.split('-').map(Number);
  const dow = new Date(`${mes}-01T12:00:00`).getDay();
  return Array.from({ length: 42 }, (_, i) => paraISO(new Date(ano, m - 1, 1 - dow + i)));
}

/** Anda `n` meses num 'YYYY-MM'. */
export function somarMeses(mes: string, n: number): string {
  const [ano, m] = mes.split('-').map(Number);
  return paraISO(new Date(ano, m - 1 + n, 1)).slice(0, 7);
}

// ══════════════════════════════════════════════════════════════════════
// Ordem
// ══════════════════════════════════════════════════════════════════════

/** O mínimo que a ordenação precisa saber de uma tarefa. */
interface Ordenavel {
  id: string;
  ordem?: number;
  createdAt: string;
}

/**
 * A ordem em que as tarefas aparecem.
 *
 * `ordem` quando existe; `createdAt` para desempatar e para quem ainda não
 * tem. Tarefa sem `ordem` afunda para o fim — que é onde uma tarefa criada
 * depois de uma reordenação deve nascer.
 *
 * Não muda o array recebido: quem chama costuma ter o original vindo do
 * store, e ordenar por baixo dele já causou bug em outro lugar.
 */
export function ordenarTarefas<T extends Ordenavel>(tarefas: readonly T[]): T[] {
  return [...tarefas].sort((a, b) => {
    const oa = a.ordem ?? Number.MAX_SAFE_INTEGER;
    const ob = b.ordem ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Move uma tarefa para a posição de outra e renumera a lista inteira.
 *
 * Renumerar tudo, em vez de calcular uma `ordem` fracionária entre os
 * vizinhos, é uma regra só em vez de duas: não existe o caso do float
 * estourando a precisão depois de muitos arrastos no mesmo vão. O custo é
 * gravar N registros por arrasto em vez de um — e para uma categoria com
 * algumas dezenas de tarefas isso é uma requisição, que o sincronizador
 * loteia em 500.
 *
 * Devolve a lista já na ordem nova, com `ordem` de 0 a n-1. Se o id não
 * existe, ou soltar em cima de si mesma, devolve o MESMO array — para quem
 * chama saber que não há o que gravar.
 */
export function reordenar<T extends Ordenavel>(
  ordenadas: readonly T[],
  idArrastado: string,
  idAlvo: string,
): T[] {
  if (idArrastado === idAlvo) return ordenadas as T[];

  const de = ordenadas.findIndex(t => t.id === idArrastado);
  const para = ordenadas.findIndex(t => t.id === idAlvo);
  if (de < 0 || para < 0) return ordenadas as T[];

  const lista = [...ordenadas];
  const [movida] = lista.splice(de, 1);
  lista.splice(para, 0, movida);

  return lista.map((t, i) => (t.ordem === i ? t : { ...t, ordem: i }));
}

/** Só as que mudaram de posição — o que de fato precisa ser gravado. */
export function mudaramDeOrdem<T extends Ordenavel>(
  antes: readonly T[],
  depois: readonly T[],
): T[] {
  const antiga = new Map(antes.map(t => [t.id, t.ordem]));
  return depois.filter(t => antiga.get(t.id) !== t.ordem);
}
