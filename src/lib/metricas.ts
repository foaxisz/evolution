import type { SessaoDeFoco, Action } from '../types';
import { dataISO, diaLocal, hojeISO, paraData, formatarData, segundaDaSemana, somarDias } from './data';

/**
 * Números do painel de dados de uma frente.
 *
 * Tudo aqui é função pura sobre o que já está guardado — nenhuma métrica
 * nova é persistida. Painel que grava o próprio resumo fica desatualizado
 * na primeira vez que um registro é editado ou apagado; recalcular na hora
 * custa nada nesta escala e nunca mente.
 *
 * O eixo do tempo é sempre o dia LOCAL (`diaLocal`), nunca `slice(0, 10)`
 * do ISO — esse lê UTC e joga tudo que foi feito depois das 21h no dia
 * seguinte.
 */

export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Mês corrente em YYYY-MM. */
export function mesAtual(): string {
  return hojeISO().slice(0, 7);
}

/** "agosto de 2026" — cabeçalho do painel. */
export function nomeDoMes(mes: string): string {
  return formatarData(`${mes}-01`, "MMMM 'de' yyyy", mes);
}

/** "ago/26" — rótulo curto do seletor. */
export function mesCurto(mes: string): string {
  const [ano, m] = mes.split('-');
  return `${MESES_CURTOS[Number(m) - 1] ?? '?'}/${ano.slice(2)}`;
}

/** Anda `n` meses a partir de YYYY-MM. */
export function somarMeses(mes: string, n: number): string {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 1 + n, 1);
  return dataISO(d).slice(0, 7);
}

/** Todos os dias de YYYY-MM, em ordem. */
export function diasDoMes(mes: string): string[] {
  const [ano, m] = mes.split('-').map(Number);
  const quantos = new Date(ano, m, 0).getDate();
  return Array.from({ length: quantos }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
}

/**
 * Meses que têm algo para mostrar, do mais recente para o mais antigo.
 *
 * O mês corrente entra sempre, mesmo vazio: abrir o painel no dia 1º e não
 * encontrar o próprio mês na lista seria absurdo.
 */
export function mesesComDados(sessoes: SessaoDeFoco[]): string[] {
  const meses = new Set<string>([mesAtual()]);
  sessoes.forEach(s => {
    const dia = diaLocal(s.inicio);
    if (dia) meses.add(dia.slice(0, 7));
  });
  return [...meses].sort().reverse();
}

export interface MetricasDoMes {
  mes: string;
  /** Segundos focados no mês. */
  totalSegundos: number;
  blocos: number;
  blocosCompletos: number;
  /** Segundos por bloco, na média. 0 quando não houve bloco. */
  mediaPorBloco: number;
  diasAtivos: number;
  diasNoMes: number;
  /** Média por dia ATIVO, não por dia do mês: dividir por 31 num mês em
   *  que se trabalhou 8 dias produz um número que não descreve nada. */
  mediaPorDiaAtivo: number;
  melhorDia: { data: string; segundos: number } | null;
  /** Maior corrida de dias seguidos com foco, dentro do mês. */
  maiorSequencia: number;
  /** ISO do dia → segundos. Só dias com registro. */
  porDia: Map<string, number>;
  /** 24 posições, segundos por hora de início do bloco. */
  porHora: number[];
  /** 7 posições, domingo = 0. */
  porDiaDaSemana: number[];
  porTarefa: { id: string; nome: string; segundos: number; blocos: number; concluida: boolean }[];
  tarefasConcluidas: number;
  /** Cada bloco com o minuto do dia em que começou — a grade de horário
   *  desenha um retângulo por bloco, não um agregado. */
  blocosDoMes: { id: string; dia: string; inicioMin: number; duracaoMin: number; completa: boolean }[];
}

/** Vazio bem formado — evita `null` espalhado por toda a tela. */
function vazio(mes: string): MetricasDoMes {
  return {
    mes,
    totalSegundos: 0,
    blocos: 0,
    blocosCompletos: 0,
    mediaPorBloco: 0,
    diasAtivos: 0,
    diasNoMes: diasDoMes(mes).length,
    mediaPorDiaAtivo: 0,
    melhorDia: null,
    maiorSequencia: 0,
    porDia: new Map(),
    porHora: Array(24).fill(0),
    porDiaDaSemana: Array(7).fill(0),
    porTarefa: [],
    tarefasConcluidas: 0,
    blocosDoMes: [],
  };
}

export function calcularMes(
  sessoes: SessaoDeFoco[],
  acoes: Action[],
  categoriaId: string,
  mes: string
): MetricasDoMes {
  const r = vazio(mes);
  const dias = diasDoMes(mes);

  const doMes = sessoes.filter(
    s => s.tipo === 'foco' && s.categoriaId === categoriaId && diaLocal(s.inicio).startsWith(mes)
  );

  const porTarefa = new Map<string, { segundos: number; blocos: number }>();

  doMes.forEach(s => {
    const dia = diaLocal(s.inicio);
    const inicio = paraData(s.inicio);

    r.totalSegundos += s.segundosFocados;
    r.blocos += 1;
    if (s.completa) r.blocosCompletos += 1;

    r.porDia.set(dia, (r.porDia.get(dia) ?? 0) + s.segundosFocados);

    if (inicio) {
      // A hora é a de INÍCIO do bloco. Um bloco de 25min que começa às
      // 09:50 conta inteiro nas 9h; ratear os minutos entre duas horas
      // daria um gráfico mais exato e ilegível.
      r.porHora[inicio.getHours()] += s.segundosFocados;
      r.porDiaDaSemana[inicio.getDay()] += s.segundosFocados;

      r.blocosDoMes.push({
        id: s.id,
        dia,
        inicioMin: inicio.getHours() * 60 + inicio.getMinutes(),
        duracaoMin: s.segundosFocados / 60,
        completa: s.completa,
      });
    }

    const chave = s.actionId ?? `rotulo:${s.rotulo ?? ''}`;
    const atual = porTarefa.get(chave) ?? { segundos: 0, blocos: 0 };
    porTarefa.set(chave, { segundos: atual.segundos + s.segundosFocados, blocos: atual.blocos + 1 });
  });

  r.diasAtivos = r.porDia.size;
  r.mediaPorBloco = r.blocos ? Math.round(r.totalSegundos / r.blocos) : 0;
  r.mediaPorDiaAtivo = r.diasAtivos ? Math.round(r.totalSegundos / r.diasAtivos) : 0;

  for (const [data, segundos] of r.porDia) {
    if (!r.melhorDia || segundos > r.melhorDia.segundos) r.melhorDia = { data, segundos };
  }

  let corrida = 0;
  dias.forEach(d => {
    corrida = r.porDia.has(d) ? corrida + 1 : 0;
    if (corrida > r.maiorSequencia) r.maiorSequencia = corrida;
  });

  r.porTarefa = [...porTarefa.entries()]
    .map(([chave, v]) => {
      const acao = acoes.find(a => a.id === chave);
      return {
        id: chave,
        nome: acao?.name ?? (chave.startsWith('rotulo:') ? chave.slice(7) || 'Foco livre' : 'Tarefa removida'),
        segundos: v.segundos,
        blocos: v.blocos,
        concluida: !!acao?.completed,
      };
    })
    .sort((a, b) => b.segundos - a.segundos);

  r.tarefasConcluidas = acoes.filter(
    a => a.categoriaId === categoriaId && a.completed && a.completedAt && diaLocal(a.completedAt).startsWith(mes)
  ).length;

  return r;
}

/**
 * Total focado em cada um dos últimos `n` meses.
 *
 * O painel inteiro é de um mês; sem isto não há como ver se o mês em
 * questão foi bom ou ruim para os seus padrões.
 */
export function ultimosMeses(
  sessoes: SessaoDeFoco[],
  categoriaId: string,
  ate: string,
  n = 6
): { mes: string; segundos: number }[] {
  const soma = new Map<string, number>();
  sessoes.forEach(s => {
    if (s.tipo !== 'foco' || s.categoriaId !== categoriaId) return;
    const mes = diaLocal(s.inicio).slice(0, 7);
    soma.set(mes, (soma.get(mes) ?? 0) + s.segundosFocados);
  });
  return Array.from({ length: n }, (_, i) => {
    const mes = somarMeses(ate, -(n - 1 - i));
    return { mes, segundos: soma.get(mes) ?? 0 };
  });
}

/**
 * Soma correndo dia a dia.
 *
 * Para o mês corrente a série para HOJE. Continuar até o dia 31 desenharia
 * uma reta horizontal no futuro, que se lê como "parei de trabalhar" —
 * quando na verdade o dia ainda não chegou.
 */
export function serieAcumulada(m: MetricasDoMes): (number | null)[] {
  const hoje = hojeISO();
  let soma = 0;
  return diasDoMes(m.mes).map(dia => {
    if (dia > hoje) return null;
    soma += m.porDia.get(dia) ?? 0;
    return soma;
  });
}

export interface ResumoDoPeriodo {
  inicio: string;
  fim: string;
  totalSegundos: number;
  blocos: number;
  blocosCompletos: number;
  diasAtivos: number;
  diasNoPeriodo: number;
  mediaPorDiaAtivo: number;
  melhorDia: { data: string; segundos: number } | null;
  tarefasConcluidas: number;
  /** ISO do dia → segundos. Só dias com registro. */
  porDia: Map<string, number>;
  /** 24 posições: segundos focados por hora de início do bloco. Mostra o
   *  ritmo do dia — em que horas o foco de fato acontece. */
  porHora: number[];
  /** As tarefas que receberam tempo, da que mais recebeu para a que menos. */
  porTarefa: { nome: string; segundos: number; blocos: number }[];
}

/**
 * Os números de um intervalo qualquer de dias.
 *
 * Serve semana e trimestre com o mesmo código: o que muda entre eles é só
 * o tamanho do intervalo. É o que o armazém mostra ao lado das metas que
 * tinham sido escritas para aquele período.
 */
export function resumoDoPeriodo(
  sessoes: SessaoDeFoco[],
  acoes: Action[],
  categoriaId: string,
  inicio: string,
  fim: string
): ResumoDoPeriodo {
  const r: ResumoDoPeriodo = {
    inicio, fim,
    totalSegundos: 0, blocos: 0, blocosCompletos: 0,
    diasAtivos: 0, diasNoPeriodo: 0, mediaPorDiaAtivo: 0,
    melhorDia: null, tarefasConcluidas: 0,
    porDia: new Map(), porHora: Array(24).fill(0), porTarefa: [],
  };

  // Contagem de dias pela diferença de datas, não iterando: um trimestre
  // são noventa e poucas voltas de laço sem necessidade.
  const [ai, mi, di] = inicio.split('-').map(Number);
  const [af, mf, df] = fim.split('-').map(Number);
  const ms = new Date(af, mf - 1, df).getTime() - new Date(ai, mi - 1, di).getTime();
  r.diasNoPeriodo = Math.max(1, Math.round(ms / 86_400_000) + 1);

  const porTarefa = new Map<string, { segundos: number; blocos: number }>();

  sessoes.forEach(s => {
    if (s.tipo !== 'foco' || s.categoriaId !== categoriaId) return;
    const dia = diaLocal(s.inicio);
    if (dia < inicio || dia > fim) return;

    r.totalSegundos += s.segundosFocados;
    r.blocos += 1;
    if (s.completa) r.blocosCompletos += 1;
    r.porDia.set(dia, (r.porDia.get(dia) ?? 0) + s.segundosFocados);

    // Hora de INÍCIO do bloco, no fuso local — o bloco conta inteiro na
    // hora em que começou.
    const inicioLocal = paraData(s.inicio);
    if (inicioLocal) r.porHora[inicioLocal.getHours()] += s.segundosFocados;

    const nome = s.actionId
      ? acoes.find(a => a.id === s.actionId)?.name ?? 'Tarefa removida'
      : s.rotulo || 'Foco livre';
    const atual = porTarefa.get(nome) ?? { segundos: 0, blocos: 0 };
    porTarefa.set(nome, { segundos: atual.segundos + s.segundosFocados, blocos: atual.blocos + 1 });
  });

  r.diasAtivos = r.porDia.size;
  r.mediaPorDiaAtivo = r.diasAtivos ? Math.round(r.totalSegundos / r.diasAtivos) : 0;
  for (const [data, segundos] of r.porDia) {
    if (!r.melhorDia || segundos > r.melhorDia.segundos) r.melhorDia = { data, segundos };
  }

  r.tarefasConcluidas = acoes.filter(a => {
    if (a.categoriaId !== categoriaId || !a.completed || !a.completedAt) return false;
    const dia = diaLocal(a.completedAt);
    return dia >= inicio && dia <= fim;
  }).length;

  r.porTarefa = [...porTarefa.entries()]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.segundos - a.segundos);

  return r;
}

export interface ResumoGeral {
  totalSegundos: number;
  semanaSegundos: number;
  hojeSegundos: number;
  tarefasTotal: number;
  tarefasSemana: number;
  tarefasHoje: number;
}

/** Total, semana e hoje — independente do mês que o painel está mostrando. */
export function resumoGeral(
  sessoes: SessaoDeFoco[],
  acoes: Action[],
  categoriaId: string
): ResumoGeral {
  const hoje = hojeISO();
  const segunda = segundaDaSemana(hoje);
  const domingo = somarDias(segunda, 6);
  const naSemana = (d: string) => d >= segunda && d <= domingo;

  const r: ResumoGeral = {
    totalSegundos: 0, semanaSegundos: 0, hojeSegundos: 0,
    tarefasTotal: 0, tarefasSemana: 0, tarefasHoje: 0,
  };

  sessoes.forEach(s => {
    if (s.tipo !== 'foco' || s.categoriaId !== categoriaId) return;
    const dia = diaLocal(s.inicio);
    r.totalSegundos += s.segundosFocados;
    if (naSemana(dia)) r.semanaSegundos += s.segundosFocados;
    if (dia === hoje) r.hojeSegundos += s.segundosFocados;
  });

  acoes.forEach(a => {
    if (a.categoriaId !== categoriaId || !a.completed) return;
    r.tarefasTotal += 1;
    if (!a.completedAt) return;
    const dia = diaLocal(a.completedAt);
    if (naSemana(dia)) r.tarefasSemana += 1;
    if (dia === hoje) r.tarefasHoje += 1;
  });

  return r;
}

/**
 * Variação percentual contra o mês anterior.
 *
 * `null` quando o mês anterior foi zero: "+∞%" ou "+100%" saindo do nada
 * não informa, só enfeita. Sem base de comparação, não se compara.
 */
export function variacao(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

/** Série contínua do mês, com os dias sem foco valendo 0. */
export function serieDoMes(m: MetricasDoMes): { data: string; segundos: number }[] {
  return diasDoMes(m.mes).map(data => ({ data, segundos: m.porDia.get(data) ?? 0 }));
}
