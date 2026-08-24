import { supabase } from './supabase';
import {
  desmontar, diferenca, aplicar, paraEnviar, faltandoNoServidor, canonico,
  DOC_INTEIRO, type LinhaRemota,
} from './registros';

/**
 * Sincronização entre aparelhos.
 *
 * O `localStorage` continua sendo o que a tela lê: o app abre instantâneo,
 * funciona offline, e nada aqui deixa a interface esperando rede. Esta
 * camada leva o que mudou para o servidor e traz o que o outro aparelho
 * mexeu.
 *
 * ── A unidade é o REGISTRO ──
 *
 * Uma linha por hábito, não um documento por coleção. Marcar um hábito
 * escreve a linha dele e não encosta na do outro, então não existe janela
 * entre ler e escrever em que o trabalho do outro aparelho possa ser
 * apagado. Exclusão é a coluna `excluido` — estado, não ausência, porque
 * ausência de linha é indistinguível de "ainda não me contaram que criou".
 *
 * ── A ordem do ciclo, que é onde estava o bug ──
 *
 * ENVIAR e depois PUXAR. O contrário parecia mais seguro e era o oposito:
 * puxando primeiro, o que a pessoa acabou de fazer ainda não estava no
 * servidor, então era preciso um escudo para a resposta não desfazer na
 * tela o que ela tinha feito. Esse escudo ignorava as linhas dos registros
 * na fila — e um registro preso na fila ficava surdo para sempre: a
 * exclusão vinda do outro aparelho era descartada, o registro seguia vivo
 * aqui, e o envio seguinte o ressuscitava no servidor.
 *
 * Enviando primeiro, o escudo é desnecessário: quando a resposta chega, o
 * que fizemos já está lá e volta idêntico. E o que o outro aparelho fez
 * DEPOIS do nosso envio tem carimbo maior e vence — inclusive exclusão.
 *
 * ── As duas memórias ──
 *
 *  - `evo_sync_pendentes`: ids gravados aqui que ainda não subiram. Vive no
 *    localStorage, não na memória, para sobreviver a fechar o app no meio —
 *    senão uma gravação feita offline se perderia calada.
 *  - `evo_sync_desde`: carimbo da linha mais nova que já vimos. É o que
 *    torna a puxada proporcional ao que mudou, não ao tamanho do banco.
 */

/** Documentos que fazem sentido sincronizar. */
export const CHAVES_SINCRONIZADAS = [
  'evo_habits',
  'evo_habit_logs',
  'evo_challenges',
  'evo_challenge_logs',
  'evo_reviews',
  'evo_cookies',
  'evo_shopping',
  'evo_shopping_categories',
  'evo_actions',
  'evo_interacoes',
  'evo_foco_categorias',
  'evo_foco_sessoes',
  'evo_foco_metas_trimestre',
  'evo_foco_metas_semana',
  'evo_destaques',
  'evo_foco_ajustes',
] as const;

export type ChaveSincronizada = typeof CHAVES_SINCRONIZADAS[number];

/**
 * Ficam de fora de propósito:
 * - `evo_foco_andamento`: cronômetro rodando AGORA, preso a este aparelho.
 * - `evo_foco_cabine`: estado de janela, não é dado do usuário.
 * - `evo_dashboard_janela`: preferência de tela, por aparelho.
 * - `evo_excluidos`: lápides de um desenho antigo. Se sobrou, é lixo inerte.
 */

export type EstadoDaSincronizacao = 'ocioso' | 'enviando' | 'erro' | 'desligada';

export function ehSincronizada(chave: string): chave is ChaveSincronizada {
  return (CHAVES_SINCRONIZADAS as readonly string[]).includes(chave);
}

const PENDENTES = 'evo_sync_pendentes';
const DESDE = 'evo_sync_desde';
const VERSAO_LOCAL = 'evo_sync_versao';

/**
 * Versão do estado local de sincronização.
 *
 * Subir este número faz cada aparelho descartar carimbo e fila na primeira
 * abertura e refazer a carga completa. Existe porque o desenho anterior
 * deixava lixo ATIVO no `localStorage`: um id preso na fila de envio, que
 * bloqueava a exclusão vinda do outro aparelho e a ressuscitava no envio
 * seguinte. Publicar só o conserto não bastaria — os aparelhos já em uso
 * continuariam com a fila envenenada.
 *
 * Descartar isso é seguro: nada do que a pessoa tem é apagado. A carga
 * completa baixa o servidor inteiro e depois sobe o que é local e não está
 * lá; o pior caso é subir de novo algo que já estava igual.
 */
const VERSAO = '2';

/** Roda uma vez por aparelho, na primeira chamada depois de atualizar. */
function migrarEstadoLocal(): void {
  if (localStorage.getItem(VERSAO_LOCAL) === VERSAO) return;
  localStorage.removeItem(DESDE);
  localStorage.removeItem(PENDENTES);
  // Lápides do desenho de dois modelos atrás. Inertes, mas ocupam espaço.
  localStorage.removeItem('evo_excluidos');
  localStorage.removeItem('evo_sync_carimbos');
  localStorage.setItem(VERSAO_LOCAL, VERSAO);
}

/** Quantas linhas por requisição. Acima disso o PostgREST começa a doer. */
const LOTE = 500;

function lerLocal(chave: string): unknown {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto === null ? null : JSON.parse(bruto);
  } catch {
    return null;
  }
}

type Pendentes = Record<string, string[]>;

function pendentes(): Pendentes {
  try {
    const v = JSON.parse(localStorage.getItem(PENDENTES) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function gravarPendentes(p: Pendentes) {
  localStorage.setItem(PENDENTES, JSON.stringify(p));
}

function acrescentar(p: Pendentes, chave: string, ids: string[]) {
  if (ids.length === 0) return;
  p[chave] = [...new Set([...(p[chave] ?? []), ...ids])];
}

/**
 * Anota que estes registros mudaram aqui.
 *
 * Chamado pela gravação do store, com o valor anterior em mãos — daí sair a
 * exclusão de graça: o id que existia antes e não existe agora entra na
 * fila igual, e na hora de enviar vira uma linha com `excluido`.
 */
export function anotarGravacao(chave: string, anteriorBruto: string | null): boolean {
  if (!ehSincronizada(chave)) return false;

  let anterior: unknown = null;
  try {
    anterior = anteriorBruto === null ? null : JSON.parse(anteriorBruto);
  } catch {
    anterior = null;
  }

  const ids = diferenca(anterior, lerLocal(chave));
  if (ids.length === 0) return false;

  const p = pendentes();
  acrescentar(p, chave, ids);
  gravarPendentes(p);
  return true;
}

// ══════════════════════════════════════════════════════════════════════
// Enviar
// ══════════════════════════════════════════════════════════════════════

/**
 * Sobe o que está pendente.
 *
 * Cada linha é um registro, então isto nunca apaga o que o outro aparelho
 * gravou: o pior caso é dois aparelhos escreverem o MESMO registro, e aí
 * vence o carimbo do banco.
 *
 * A fila é relida depois do sucesso e só os ids daquele lote saem dela:
 * uma gravação que aconteça durante o envio continua pendente e sobe na
 * rodada seguinte.
 */
export async function empurrar(): Promise<void> {
  if (!supabase) return;

  const sessao = (await supabase.auth.getSession()).data.session;
  if (!sessao) return;

  const p = pendentes();
  const chaves = Object.keys(p).filter(c => ehSincronizada(c) && p[c]?.length);
  if (chaves.length === 0) return;

  const linhas = chaves.flatMap(chave =>
    paraEnviar(chave, lerLocal(chave), p[chave]).map(l => ({
      usuario_id: sessao.user.id,
      ...l,
    }))
  );

  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await supabase
      .from('registros')
      .upsert(linhas.slice(i, i + LOTE), { onConflict: 'usuario_id,colecao,registro_id' });
    if (error) throw error;
  }

  const agora = pendentes();
  for (const chave of chaves) {
    const subiram = new Set(p[chave]);
    const restam = (agora[chave] ?? []).filter(id => !subiram.has(id));
    if (restam.length > 0) agora[chave] = restam;
    else delete agora[chave];
  }
  gravarPendentes(agora);
}

// ══════════════════════════════════════════════════════════════════════
// Puxar
// ══════════════════════════════════════════════════════════════════════

/** Busca linhas do servidor, paginado. `desde` nulo traz tudo. */
async function buscar(desde: string | null): Promise<LinhaRemota[]> {
  if (!supabase) return [];
  const linhas: LinhaRemota[] = [];

  // Paginado, e não com `limit`: cortar no meio de um carimbo repetido
  // deixaria linhas para trás, porque a próxima busca começa depois dele.
  for (let pagina = 0; ; pagina++) {
    let consulta = supabase
      .from('registros')
      .select('colecao, registro_id, dados, excluido, atualizado_em')
      .order('atualizado_em', { ascending: true })
      .range(pagina * LOTE, (pagina + 1) * LOTE - 1);

    if (desde) consulta = consulta.gt('atualizado_em', desde);

    const { data, error } = await consulta;
    if (error) throw error;

    const lote = data as LinhaRemota[];
    linhas.push(...lote);
    if (lote.length < LOTE) break;
  }

  return linhas;
}

/**
 * Traz do servidor tudo o que mudou desde a última vez e aplica.
 *
 * Devolve as chaves que mudaram aqui, para a interface se redesenhar.
 *
 * O carimbo só avança DEPOIS de aplicar tudo. Se cair a rede no meio, o
 * mesmo intervalo é pedido de novo na próxima vez — aplicar duas vezes a
 * mesma linha não faz diferença, mas pular uma faria.
 */
export async function puxar(): Promise<string[]> {
  if (!supabase) return [];

  const desde = localStorage.getItem(DESDE);
  const linhas = await buscar(desde);
  if (linhas.length === 0) return [];

  const mudadas = aplicarLinhas(linhas);

  // O maior carimbo do lote — inclusive de coleção que ignoramos, senão
  // uma chave fora da lista faria a mesma linha voltar para sempre.
  const maior = linhas.reduce(
    (a, l) => (l.atualizado_em > a ? l.atualizado_em : a),
    desde ?? '',
  );
  if (maior) localStorage.setItem(DESDE, maior);

  return mudadas;
}

function aplicarLinhas(linhas: LinhaRemota[]): string[] {
  const porColecao = new Map<string, LinhaRemota[]>();
  for (const linha of linhas) {
    if (!ehSincronizada(linha.colecao)) continue;
    const lista = porColecao.get(linha.colecao);
    if (lista) lista.push(linha);
    else porColecao.set(linha.colecao, [linha]);
  }

  const mudadas: string[] = [];
  for (const [chave, doColecao] of porColecao) {
    const antes = lerLocal(chave);
    const depois = aplicar(antes, doColecao);
    if (depois === antes) continue;

    if (depois === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(depois));
    mudadas.push(chave);
  }
  return mudadas;
}

// ══════════════════════════════════════════════════════════════════════
// Primeira carga deste aparelho
// ══════════════════════════════════════════════════════════════════════

/**
 * A entrada de um aparelho que ainda não tem carimbo.
 *
 * Aqui a ordem se INVERTE de propósito: puxa o servidor inteiro e aplica
 * ANTES de decidir o que subir. É o que impede a ressurreição — o registro
 * excluído em outro aparelho já saiu do documento local quando a decisão
 * de subir é tomada, então ele não é candidato.
 *
 * Fazendo o contrário, um aparelho que ficou dias sem abrir republicaria
 * como vivo tudo o que foi excluído nesse meio-tempo.
 *
 * Depois disso, sobe só o que é local e o servidor não tem — o histórico
 * de quem já usava o app antes de existir conta entra por aqui.
 */
export async function primeiraCarga(): Promise<string[]> {
  if (!supabase) return [];

  const linhas = await buscar(null);
  const mudadas = aplicarLinhas(linhas);

  if (linhas.length > 0) {
    const maior = linhas.reduce((a, l) => (l.atualizado_em > a ? l.atualizado_em : a), '');
    if (maior) localStorage.setItem(DESDE, maior);
  }

  // Índice do que o servidor tem, em forma canônica — a comparação por
  // `JSON.stringify` cru sempre falhava, porque o Postgres reordena as
  // chaves do `jsonb`.
  const remotos = new Map<string, string>();
  for (const l of linhas) {
    remotos.set(`${l.colecao} ${l.registro_id}`, l.excluido ? ' excluido' : canonico(l.dados));
  }

  const p = pendentes();
  for (const chave of CHAVES_SINCRONIZADAS) {
    acrescentar(p, chave, faltandoNoServidor(lerLocal(chave), remotos, chave));
  }
  gravarPendentes(p);

  return mudadas;
}

/**
 * Este aparelho já sincronizou alguma vez?
 *
 * O carimbo é a prova. Sem ele, a entrada precisa da carga completa.
 */
export function jaSincronizou(): boolean {
  // A migração roda aqui porque este é o primeiro ponto que todo ciclo
  // consulta — não há como esquecer de chamá-la.
  migrarEstadoLocal();
  return localStorage.getItem(DESDE) !== null;
}

/**
 * Recomeça do zero, sem apagar nada.
 *
 * Esquece o carimbo e a fila. A próxima sincronização faz a carga completa:
 * baixa o servidor inteiro, aplica, e só então sobe o que é local e não
 * está lá. É a saída para quando os dois lados divergirem.
 */
export function recomecar(): void {
  localStorage.removeItem(DESDE);
  localStorage.removeItem(PENDENTES);
}

/** Quantos registros ainda não subiram. Só para diagnóstico. */
export function quantosPendentes(): number {
  return Object.values(pendentes()).reduce((n, ids) => n + (ids?.length ?? 0), 0);
}

// ══════════════════════════════════════════════════════════════════════
// Tempo real
// ══════════════════════════════════════════════════════════════════════

/**
 * Avisa quando o outro aparelho grava, sem esperar o próximo ciclo.
 *
 * O filtro por `usuario_id` mantém o canal privado. Também chega evento das
 * NOSSAS gravações — e tudo bem: a puxada que ele dispara pede só o que é
 * mais novo que o nosso carimbo.
 *
 * Se o Realtime não estiver ligado na tabela, a inscrição nunca dispara e a
 * vigia por tempo continua cobrindo. Por isso nada aqui lança erro: é um
 * acelerador, não a fundação.
 */
export function assinarMudancas(usuarioId: string, aoMudar: () => void): () => void {
  if (!supabase) return () => {};

  const canal = supabase
    .channel(`registros:${usuarioId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'registros',
        filter: `usuario_id=eq.${usuarioId}`,
      },
      () => aoMudar()
    )
    .subscribe();

  return () => { supabase?.removeChannel(canal); };
}

export { DOC_INTEIRO, desmontar };
