import type { Habit, HabitLog } from '../types';
import { somarDias, diaDaSemanaDe, paraData, formatarData } from './data';
import { MESES_CURTOS } from './metricas';

/**
 * Os números do painel de evolução.
 *
 * O eixo aqui é ACÚMULO, não taxa. A diferença não é de estilo: taxa sobe
 * e desce, e uma tela cheia de taxa lida como boletim — no dia ruim ela
 * diz que você piorou. Acúmulo só cresce, porque o que já foi feito não
 * deixa de ter sido feito. É o que sustenta a sensação de estar avançando
 * sem mentir sobre nada.
 *
 * Toda função devolve `null` quando não há base. Painel que mostra zero em
 * campo vazio vira parede de zeros e diz à pessoa que ela não tem nada —
 * exatamente o oposto do que a tela existe para fazer.
 */

/** Datas distintas com registro, em ordem crescente. */
function diasComRegistro(logs: HabitLog[]): string[] {
  return [...new Set(logs.map(l => l.date))].sort();
}

function diferencaEmDias(de: string, ate: string): number {
  const a = new Date(`${de}T12:00:00`).getTime();
  const b = new Date(`${ate}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

// ══════════════════════════════════════════════════════════════════════
// 1. Sua evolução — conclusões acumuladas
// ══════════════════════════════════════════════════════════════════════

export interface Acumulo {
  /** Um ponto por dia, do primeiro registro até hoje. */
  pontos: number[];
  total: number;
  desde: string;
}

/**
 * Soma correndo desde o primeiro registro.
 *
 * Amostrada para no máximo `MAX_PONTOS` posições quando o histórico é
 * longo: um ano são 365 pontos num traço de 620px, o que é mais vértice
 * do que pixel — o desenho não melhora e o path fica enorme.
 */
const MAX_PONTOS = 180;

export function acumulado(logs: HabitLog[], hoje: string): Acumulo | null {
  if (logs.length === 0) return null;
  const dias = diasComRegistro(logs);
  const desde = dias[0];

  const porDia = new Map<string, number>();
  logs.forEach(l => porDia.set(l.date, (porDia.get(l.date) ?? 0) + 1));

  const span = Math.max(1, diferencaEmDias(desde, hoje) + 1);
  const bruto: number[] = [];
  let soma = 0;
  for (let i = 0; i < span; i++) {
    soma += porDia.get(somarDias(desde, i)) ?? 0;
    bruto.push(soma);
  }

  if (bruto.length <= MAX_PONTOS) return { pontos: bruto, total: soma, desde };

  const passo = bruto.length / MAX_PONTOS;
  const pontos = Array.from({ length: MAX_PONTOS }, (_, i) => bruto[Math.floor(i * passo)]);
  // A última posição precisa ser o total real: amostrar por índice pode
  // parar antes do fim e a curva fecharia abaixo do número escrito acima.
  pontos[pontos.length - 1] = soma;
  return { pontos, total: soma, desde };
}

// ══════════════════════════════════════════════════════════════════════
// 2. Esta semana
// ══════════════════════════════════════════════════════════════════════

export interface SemanaCorrente {
  /** 7 posições, segunda primeiro. */
  dias: boolean[];
  /** Dias já passados desta semana, incluindo hoje. */
  decorridos: number;
  total: number;
  /** Média de dias por semana fechada. `null` sem base. */
  media: number | null;
}

export function semanaCorrente(logs: HabitLog[], hoje: string): SemanaCorrente | null {
  if (logs.length === 0) return null;
  const registrados = new Set(logs.map(l => l.date));

  // Segunda desta semana: o domingo é o 7º dia, não o 1º.
  const dow = diaDaSemanaDe(hoje);
  const segunda = somarDias(hoje, -((dow + 6) % 7));

  const dias = Array.from({ length: 7 }, (_, i) => registrados.has(somarDias(segunda, i)));
  const decorridos = ((dow + 6) % 7) + 1;

  // Média das semanas ANTERIORES fechadas, do primeiro registro para cá.
  const primeiro = diasComRegistro(logs)[0];
  const semanas: number[] = [];
  for (let s = 1; s <= 12; s++) {
    const ini = somarDias(segunda, -7 * s);
    if (ini < somarDias(primeiro, -6)) break;
    let n = 0;
    for (let i = 0; i < 7; i++) if (registrados.has(somarDias(ini, i))) n++;
    semanas.push(n);
  }
  const media = semanas.length > 0
    ? semanas.reduce((a, b) => a + b, 0) / semanas.length
    : null;

  return { dias, decorridos, total: dias.filter(Boolean).length, media };
}

// ══════════════════════════════════════════════════════════════════════
// 3. Números
// ══════════════════════════════════════════════════════════════════════

export interface Numeros {
  sequencia: number;
  esteMes: number;
  /** Variação contra o mesmo trecho do mês passado. `null` sem base. */
  deltaMes: number | null;
  diasAtivos: number;
}

export function numeros(logs: HabitLog[], hoje: string): Numeros | null {
  if (logs.length === 0) return null;
  const registrados = new Set(logs.map(l => l.date));

  // Se hoje ainda não tem registro, a corrida pode estar viva desde
  // ontem — o dia não acabou.
  let sequencia = 0;
  let cursor = registrados.has(hoje) ? hoje : somarDias(hoje, -1);
  while (registrados.has(cursor)) { sequencia++; cursor = somarDias(cursor, -1); }

  const mes = hoje.slice(0, 7);
  const diaDoMes = Number(hoje.slice(8));
  const esteMes = logs.filter(l => l.date.startsWith(mes)).length;

  // Compara com o MESMO trecho do mês anterior: o mês corrente está pela
  // metade, e confrontá-lo com um mês inteiro sempre acusaria queda.
  const [ano, m] = mes.split('-').map(Number);
  const anteriorD = new Date(ano, m - 2, 1);
  const mesAnterior = `${anteriorD.getFullYear()}-${String(anteriorD.getMonth() + 1).padStart(2, '0')}`;
  const trechoAnterior = logs.filter(
    l => l.date.startsWith(mesAnterior) && Number(l.date.slice(8)) <= diaDoMes
  ).length;

  return {
    sequencia,
    esteMes,
    deltaMes: trechoAnterior === 0 ? null : ((esteMes - trechoAnterior) / trechoAnterior) * 100,
    diasAtivos: registrados.size,
  };
}

// ══════════════════════════════════════════════════════════════════════
// 5. Corrida do mês
// ══════════════════════════════════════════════════════════════════════

export interface Corrida {
  /** Acumulado dia a dia do mês corrente, até hoje. */
  atual: number[];
  /** Acumulado dia a dia do mês anterior, inteiro. */
  anterior: number[];
  /** Dias no mês anterior — define a largura do traço pontilhado. */
  diasNoAnterior: number;
  nomeAtual: string;
  nomeAnterior: string;
  /** Diferença percentual no mesmo dia. `null` sem base. */
  vantagem: number | null;
}

export function corridaDoMes(logs: HabitLog[], hoje: string): Corrida | null {
  const mes = hoje.slice(0, 7);
  const diaDoMes = Number(hoje.slice(8));
  const [ano, m] = mes.split('-').map(Number);

  const anteriorD = new Date(ano, m - 2, 1);
  const mesAnterior = `${anteriorD.getFullYear()}-${String(anteriorD.getMonth() + 1).padStart(2, '0')}`;
  const diasNoAnterior = new Date(anteriorD.getFullYear(), anteriorD.getMonth() + 1, 0).getDate();

  const somar = (prefixo: string, ate: number) => {
    const porDia = new Array(ate).fill(0);
    logs.forEach(l => {
      if (!l.date.startsWith(prefixo)) return;
      const d = Number(l.date.slice(8));
      if (d <= ate) porDia[d - 1] += 1;
    });
    let s = 0;
    return porDia.map(v => (s += v));
  };

  const atual = somar(mes, diaDoMes);
  const anterior = somar(mesAnterior, diasNoAnterior);

  // Sem nada no mês passado não há corrida — uma curva sozinha contra o
  // vazio não compara nada.
  if (anterior[anterior.length - 1] === 0) return null;

  const noMesmoDia = anterior[Math.min(diaDoMes, diasNoAnterior) - 1] ?? 0;
  return {
    atual,
    anterior,
    diasNoAnterior,
    nomeAtual: MESES_CURTOS[m - 1],
    nomeAnterior: MESES_CURTOS[anteriorD.getMonth()],
    vantagem: noMesmoDia === 0 ? null : ((atual[atual.length - 1] - noMesmoDia) / noMesmoDia) * 100,
  };
}

// ══════════════════════════════════════════════════════════════════════
// 6. Trajetória de cada hábito
// ══════════════════════════════════════════════════════════════════════

export type Tendencia = 'subindo' | 'firme' | 'caindo';

export interface TrajetoriaDeHabito {
  habit: Habit;
  /** 12 semanas, em 0–100 contra a meta do próprio hábito. */
  pontos: number[];
  tendencia: Tendencia;
}

const SEMANAS_DA_TRAJETORIA = 12;

/**
 * Cada hábito medido contra a META DELE, não contra os outros.
 *
 * Um hábito de 3×/semana em 100% e um de 7×/semana em 60% não se comparam
 * em volume, mas se comparam em cumprimento — e é cumprimento que diz se a
 * pessoa está honrando o que combinou consigo mesma.
 */
export function trajetorias(habits: Habit[], logs: HabitLog[], hoje: string): TrajetoriaDeHabito[] {
  const dow = diaDaSemanaDe(hoje);
  const segunda = somarDias(hoje, -((dow + 6) % 7));

  return habits
    .map(h => {
      const meta = Math.max(1, h.frequency);
      const pontos = Array.from({ length: SEMANAS_DA_TRAJETORIA }, (_, i) => {
        const ini = somarDias(segunda, -7 * (SEMANAS_DA_TRAJETORIA - 1 - i));
        const fim = somarDias(ini, 6);
        const n = logs.filter(l => l.habitId === h.id && l.date >= ini && l.date <= fim).length;
        return Math.min(100, (n / meta) * 100);
      });

      // Metades comparadas, não inclinação de regressão: a leitura é
      // "melhorou ou piorou", e isso não precisa de estatística.
      const meio = Math.floor(pontos.length / 2);
      const antes = pontos.slice(0, meio).reduce((a, b) => a + b, 0) / meio;
      const depois = pontos.slice(meio).reduce((a, b) => a + b, 0) / (pontos.length - meio);
      const delta = depois - antes;

      return {
        habit: h,
        pontos,
        tendencia: (delta > 8 ? 'subindo' : delta < -8 ? 'caindo' : 'firme') as Tendencia,
      };
    })
    // Sem nenhum registro em 12 semanas, o hábito não tem trajetória —
    // uma linha reta no zero não é informação, é ruído.
    .filter(t => t.pontos.some(p => p > 0));
}

// ══════════════════════════════════════════════════════════════════════
// 8. Suas marcas
// ══════════════════════════════════════════════════════════════════════

export interface Marca {
  id: string;
  rotulo: string;
  valor: string;
  unidade: string;
  contexto: string;
}

/**
 * Recordes pessoais — comparação, não medalha.
 *
 * A diferença importa: medalha é premiar um limiar arbitrário (100
 * conclusões!), o que é gamificação e o projeto recusa. Marca é o melhor
 * que a própria pessoa já fez, e existe para ser batida.
 */
export function marcas(habits: Habit[], logs: HabitLog[], hoje: string): Marca[] {
  const lista: Marca[] = [];
  if (logs.length === 0) return lista;

  const registrados = new Set(logs.map(l => l.date));
  const dias = diasComRegistro(logs);

  // Melhor semana: mais dias ativos numa janela de segunda a domingo.
  const dow = diaDaSemanaDe(hoje);
  const segundaAtual = somarDias(hoje, -((dow + 6) % 7));
  let melhorSemana = { n: 0, ini: '' };
  for (let s = 0; s < 104; s++) {
    const ini = somarDias(segundaAtual, -7 * s);
    if (ini < somarDias(dias[0], -6)) break;
    let n = 0;
    for (let i = 0; i < 7; i++) if (registrados.has(somarDias(ini, i))) n++;
    if (n > melhorSemana.n) melhorSemana = { n, ini };
  }
  if (melhorSemana.n > 0) {
    lista.push({
      id: 'semana',
      rotulo: 'Melhor semana',
      valor: String(melhorSemana.n),
      unidade: '/7 dias',
      contexto: `semana de ${formatarData(melhorSemana.ini, "d 'de' MMMM")}`,
    });
  }

  // Melhor mês: mais conclusões.
  const porMes = new Map<string, number>();
  logs.forEach(l => {
    const m = l.date.slice(0, 7);
    porMes.set(m, (porMes.get(m) ?? 0) + 1);
  });
  let melhorMes = { n: 0, mes: '' };
  porMes.forEach((n, mes) => { if (n > melhorMes.n) melhorMes = { n, mes }; });
  if (melhorMes.n > 0) {
    lista.push({
      id: 'mes',
      rotulo: 'Melhor mês',
      valor: String(melhorMes.n),
      unidade: ' conclusões',
      contexto: formatarData(`${melhorMes.mes}-01`, "MMMM 'de' yyyy"),
    });
  }

  // Maior sequência de dias consecutivos.
  let maior = { n: 0, fim: '' };
  let corrida = 0;
  dias.forEach((d, i) => {
    corrida = i > 0 && diferencaEmDias(dias[i - 1], d) === 1 ? corrida + 1 : 1;
    if (corrida > maior.n) maior = { n: corrida, fim: d };
  });
  if (maior.n > 1) {
    lista.push({
      id: 'sequencia',
      rotulo: 'Maior sequência',
      valor: String(maior.n),
      unidade: ' dias',
      contexto: `terminou em ${formatarData(maior.fim, "d 'de' MMMM")}`,
    });
  }

  // Hábito mantido há mais tempo, entre os ainda vivos.
  let antigo: { nome: string; dias: number; desde: string } | null = null;
  habits.forEach(h => {
    const dele = logs.filter(l => l.habitId === h.id).map(l => l.date).sort();
    if (dele.length < 2) return;
    const ultimo = dele[dele.length - 1];
    if (diferencaEmDias(ultimo, hoje) > 14) return; // parou: não está mantendo
    const desde = dele[0];
    const quantos = diferencaEmDias(desde, hoje) + 1;
    if (!antigo || quantos > antigo.dias) antigo = { nome: h.name, dias: quantos, desde };
  });
  if (antigo) {
    const a = antigo as { nome: string; dias: number; desde: string };
    lista.push({
      id: 'antigo',
      rotulo: 'Mantendo há mais tempo',
      valor: String(a.dias),
      unidade: ' dias',
      contexto: `${a.nome}, desde ${formatarData(a.desde, "d 'de' MMMM")}`,
    });
  }

  return lista;
}

/** Caminho SVG de uma série, normalizada na altura da caixa. */
export function caminho(
  valores: number[], largura: number, altura: number, topo = 0, maximo?: number
): string {
  if (valores.length === 0) return '';
  const pico = Math.max(1, maximo ?? Math.max(...valores));
  const passo = valores.length > 1 ? largura / (valores.length - 1) : 0;
  return valores
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * passo).toFixed(1)},${(topo + altura - (v / pico) * altura).toFixed(1)}`)
    .join(' ');
}

/** Data do primeiro registro, para o rodapé do bloco de acúmulo. */
export function primeiroDia(logs: HabitLog[]): string | null {
  if (logs.length === 0) return null;
  return diasComRegistro(logs)[0];
}

/** Converte `paraData` sem estourar quando a data é inválida. */
export function diasDesde(iso: string, hoje: string): number {
  const d = paraData(iso);
  if (!d) return 0;
  return Math.max(1, diferencaEmDias(iso, hoje) + 1);
}
