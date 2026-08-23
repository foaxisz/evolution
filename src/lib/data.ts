import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Datas em YYYY-MM-DD no fuso local.
 *
 * Existia uma versão disto em quatro arquivos, duas delas usando
 * `toISOString()`, que devolve UTC: no horário de Brasília, das 21h às
 * 23h59 a data em UTC já é a de amanhã, e o registro feito à noite era
 * gravado no dia seguinte.
 *
 * Vale só para data-do-calendário (o "balde do dia"). Carimbo de momento
 * — `createdAt`, `completedAt` — continua sendo `toISOString()`, que é
 * exatamente o certo para instante no tempo.
 */

/** Uma data qualquer em YYYY-MM-DD, no fuso local. */
export function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Hoje em YYYY-MM-DD, no fuso local. */
export function hojeISO(): string {
  return dataISO(new Date());
}

/** Soma (ou subtrai) dias a uma data YYYY-MM-DD, em horário local. */
export function somarDias(base: string, dias: number): string {
  const [y, m, d] = base.split('-').map(Number);
  return dataISO(new Date(y, m - 1, d + dias));
}

/**
 * Dia da semana de uma data `YYYY-MM-DD` — 0 = domingo.
 *
 * Monta a data pelos componentes em vez de `new Date(iso)`: a string pura
 * é lida como UTC, e em fuso negativo isso devolve o dia anterior.
 */
export function diaDaSemanaDe(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * Converte uma data guardada em `Date`, ou `null` se ela não for válida.
 *
 * `format()` do date-fns lança `RangeError: Invalid time value` quando
 * recebe data inválida, e a exceção subindo pelo render derruba a página
 * inteira em tela branca. Basta um registro com data estranha — vindo de
 * importação, de edição manual ou de sincronização — para o app sumir.
 */
export function paraData(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  // `YYYY-MM-DD` puro vira meio-dia local: à meia-noite, qualquer
  // deslocamento de fuso jogaria a data para o dia anterior.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(`${valor}T12:00:00`)
    : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * O dia do calendário LOCAL de um instante gravado.
 *
 * `SessaoDeFoco.inicio` é `toISOString()`, ou seja UTC — o certo para
 * guardar um instante. Mas `inicio.slice(0, 10)` lê o dia EM UTC: às 21h
 * em Brasília isso já é amanhã, e o bloco feito à noite ia parar no balde
 * do dia seguinte. Quem separa por dia tem que passar por aqui.
 */
export function diaLocal(instante: string): string {
  const d = paraData(instante);
  return d ? dataISO(d) : '';
}

/** "18:30" no fuso local — `instante.slice(11, 16)` daria a hora em UTC. */
export function horaLocal(instante: string): string {
  const d = paraData(instante);
  if (!d) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Mês YYYY-MM de um instante gravado, no fuso local. */
export function mesLocal(instante: string): string {
  return diaLocal(instante).slice(0, 7);
}

/**
 * Segunda-feira da semana de uma data, em YYYY-MM-DD.
 *
 * A semana começa na segunda, não no domingo: é como se pensa "esta
 * semana" no Brasil, e o fim de semana fecha o ciclo em vez de abri-lo.
 * Serve de chave do plano semanal.
 */
export function segundaDaSemana(iso: string = hojeISO()): string {
  const [y, m, d] = iso.split('-').map(Number);
  const data = new Date(y, m - 1, d);
  const dow = (data.getDay() + 6) % 7; // segunda = 0
  data.setDate(data.getDate() - dow);
  return dataISO(data);
}

/**
 * "18–24 ago", ou "28 jul–3 ago" quando a semana atravessa o mês.
 *
 * Travessão, não ponto médio: `18 · 24 ago` se lê como dois itens de uma
 * lista, não como um intervalo — era preciso parar e decifrar que aquilo
 * era "de 18 a 24".
 */
export function faixaDaSemana(segunda: string): string {
  const domingo = somarDias(segunda, 6);
  const dSeg = Number(segunda.split('-')[2]);
  const dDom = Number(domingo.split('-')[2]);
  const mesInicio = formatarData(segunda, 'MMM');
  const mesFim = formatarData(domingo, 'MMM');
  return mesInicio === mesFim
    ? `${dSeg}–${dDom} ${mesFim}`
    : `${dSeg} ${mesInicio}–${dDom} ${mesFim}`;
}

/**
 * "Esta semana", "Semana passada", ou a faixa de dias.
 *
 * Numa lista de semanas o que se procura quase sempre é uma das duas
 * últimas, e para essas a data é o caminho mais longo até a resposta:
 * ninguém sabe de cor que a semana passada começou dia 10.
 */
export function nomeDaSemana(segunda: string): string {
  const atual = segundaDaSemana();
  if (segunda === atual) return 'Esta semana';
  if (segunda === somarDias(atual, -7)) return 'Semana passada';
  return faixaDaSemana(segunda);
}

/** Quantas semanas separam duas segundas-feiras. */
export function semanasEntre(de: string, ate: string): number {
  const [ya, ma, da] = de.split('-').map(Number);
  const [yb, mb, db] = ate.split('-').map(Number);
  const ms = new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
  return Math.round(ms / (7 * 86_400_000));
}

/**
 * A quinta-feira da semana — o dia que decide a qual período ela pertence.
 *
 * É a convenção da ISO 8601 para semanas do ano, e existe porque a semana
 * que cavalga a virada precisa de UM dono. Pela segunda-feira, a semana de
 * 29 jun a 5 jul ficaria com o trimestre que acaba em junho, e o trimestre
 * de julho começaria na "semana 2" — nunca haveria uma semana 1.
 */
export function quintaDaSemana(segunda: string): string {
  return somarDias(segunda, 3);
}

/**
 * Onde a semana cai dentro de um período: `{ posicao: 3, total: 13 }`.
 *
 * É a identidade que a data não dá. "17–23 ago" diz quando foi; "semana 3
 * de 13" diz em que ponto do trimestre você estava — se ainda dava tempo
 * ou se já era a reta final. É o que amarra as duas escalas do
 * planejamento uma na outra.
 *
 * A semana que CONTÉM o início é a de número 1, e a que contém o fim é a
 * última — sem olhar a quinta-feira. É o modelo intuitivo: se você começa
 * o trimestre hoje, esta semana é a semana 1, mesmo que hoje seja sexta e
 * a semana já esteja quase no fim. Contar pela quinta empurrava a primeira
 * semana para a seguinte quando o início caía tarde na semana, e aí "hoje"
 * não virava semana 1.
 */
export function posicaoDaSemana(
  semana: string,
  inicio: string,
  fim: string
): { posicao: number; total: number } {
  const primeira = segundaDaSemana(inicio);
  const ultima = segundaDaSemana(fim);
  const total = Math.max(1, semanasEntre(primeira, ultima) + 1);
  const posicao = Math.min(total, Math.max(1, semanasEntre(primeira, semana) + 1));
  return { posicao, total };
}

/**
 * "Jul–set 2026" — período longo pelos meses, não pelos dias exatos.
 *
 * `1 jul · 30 set '26` carrega quatro números para dizer uma coisa que
 * dois meses já dizem. O dia exato continua editável no painel; aqui o
 * que importa é reconhecer o período de relance.
 */
export function nomeDoPeriodo(inicio: string, fim: string): string {
  const mesInicio = formatarData(inicio, 'MMM', '');
  const mesFim = formatarData(fim, 'MMM', '');
  const anoInicio = inicio.slice(0, 4);
  const anoFim = fim.slice(0, 4);
  const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  if (anoInicio !== anoFim) {
    return `${maiuscula(mesInicio)} ${anoInicio}–${mesFim} ${anoFim}`;
  }
  return mesInicio === mesFim
    ? `${maiuscula(mesInicio)} ${anoFim}`
    : `${maiuscula(mesInicio)}–${mesFim} ${anoFim}`;
}


/** `true` se a data guardada dá para formatar sem estourar. */
export function dataValida(valor: string | null | undefined): boolean {
  return paraData(valor) !== null;
}

/** Formata sem derrubar a tela: data inválida vira `alternativa`. */
export function formatarData(
  valor: string | null | undefined,
  padrao: string,
  alternativa = 'sem data'
): string {
  const d = paraData(valor);
  return d ? format(d, padrao, { locale: ptBR }) : alternativa;
}

/** "há 3 dias" — também tolerante a data inválida. */
export function desdeQuando(
  valor: string | null | undefined,
  alternativa = 'sem data'
): string {
  const d = paraData(valor);
  return d ? formatDistanceToNow(d, { addSuffix: true, locale: ptBR }) : alternativa;
}
