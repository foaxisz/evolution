import { supabase } from './supabase';
import {
  desmontar, diferenca, aplicar, paraEnviar, DOC_INTEIRO,
  type LinhaRemota,
} from './registros';

/**
 * Sincronização entre aparelhos.
 *
 * O `localStorage` continua sendo o que a tela lê: o app abre instantâneo
 * e funciona offline, e nada aqui deixa a interface esperando rede. Esta
 * camada leva o que mudou para o servidor e traz o que o outro aparelho
 * mexeu.
 *
 * ── O que mudou em relação ao desenho anterior ──
 *
 * Antes, o servidor guardava o documento inteiro numa linha e gravar
 * significava SUBSTITUIR esse documento. Isso torna a perda de dado
 * estrutural: entre ler e escrever existe uma janela, e o que o outro
 * aparelho gravou dentro dela é apagado por quem chegar depois. O cliente
 * remendava com uma união dos dois lados; união não sabe apagar, então
 * exclusão virou lápide, e lápide virou poda. O furo era o modelo.
 *
 * Agora a unidade é o REGISTRO, uma linha por hábito, e por registro não
 * existe janela: marcar um hábito escreve a linha dele e não encosta na
 * do outro. Sem mescla, sem lápide, sem poda. Duas coisas só disputam
 * quando são o MESMO registro, e aí vence o carimbo mais novo do banco.
 *
 * ── As três memórias ──
 *
 *  - `evo_sync_pendentes`: ids gravados aqui que ainda não subiram. Vive
 *    no localStorage, e não na memória, para sobreviver a fechar o app no
 *    meio — senão uma gravação feita offline se perderia calada.
 *  - `evo_sync_desde`: carimbo da linha mais nova que já vimos. É o que
 *    torna a puxada proporcional ao que mudou, e não ao tamanho do banco.
 *  - o próprio `localStorage` do app, que é a verdade da tela.
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
 *   Sincronizar faria o celular achar que tem um bloco em andamento que na
 *   verdade está correndo no PC.
 * - `evo_foco_cabine`: estado de janela, não é dado do usuário.
 * - `evo_dashboard_janela`: preferência de tela, por aparelho.
 * - `evo_excluidos`: as lápides do desenho anterior. Não existem mais —
 *   exclusão agora é a coluna `excluido` da linha. Se sobrou no aparelho,
 *   é lixo inofensivo.
 */

export type EstadoDaSincronizacao = 'ocioso' | 'enviando' | 'erro' | 'desligada';

export function ehSincronizada(chave: string): chave is ChaveSincronizada {
  return (CHAVES_SINCRONIZADAS as readonly string[]).includes(chave);
}

// ══════════════════════════════════════════════════════════════════════
// O que está guardado aqui
// ══════════════════════════════════════════════════════════════════════

const PENDENTES = 'evo_sync_pendentes';
const DESDE = 'evo_sync_desde';

/** Quantas linhas por requisição. Acima disso o Postgrest começa a doer. */
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

/**
 * Anota que estes registros mudaram aqui.
 *
 * Chamado pela gravação do store, com o valor anterior em mãos — daí sair
 * a exclusão de graça: o id que existia antes e não existe agora entra na
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
  p[chave] = [...new Set([...(p[chave] ?? []), ...ids])];
  gravarPendentes(p);
  return true;
}

/** Marca o documento inteiro como pendente — usado na primeira carga. */
function anotarTudo(chave: string) {
  const ids = desmontar(lerLocal(chave)).map(r => r.id);
  if (ids.length === 0) return;
  const p = pendentes();
  p[chave] = [...new Set([...(p[chave] ?? []), ...ids])];
  gravarPendentes(p);
}

function idsPendentes(chave: string): Set<string> {
  return new Set(pendentes()[chave] ?? []);
}

// ══════════════════════════════════════════════════════════════════════
// Puxar
// ══════════════════════════════════════════════════════════════════════

/**
 * Traz do servidor tudo o que mudou desde a última vez.
 *
 * Devolve as chaves que mudaram aqui, para a interface se redesenhar.
 *
 * O carimbo só avança DEPOIS de aplicar tudo. Se cair a rede no meio, na
 * próxima vez o mesmo intervalo é pedido de novo — aplicar duas vezes a
 * mesma linha não faz diferença, mas pular uma faria.
 */
export async function puxar(): Promise<string[]> {
  if (!supabase) return [];

  const desde = localStorage.getItem(DESDE);
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

    linhas.push(...(data as LinhaRemota[]));
    if ((data as LinhaRemota[]).length < LOTE) break;
  }

  if (linhas.length === 0) return [];

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
    const depois = aplicar(antes, doColecao, idsPendentes(chave));
    if (depois === antes) continue;

    if (depois === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(depois));
    mudadas.push(chave);
  }

  // O maior carimbo do lote — inclusive de coleção que ignoramos, senão
  // uma chave fora da lista faria a mesma linha voltar para sempre.
  const maior = linhas.reduce(
    (a, l) => (l.atualizado_em > a ? l.atualizado_em : a),
    desde ?? '',
  );
  if (maior) localStorage.setItem(DESDE, maior);

  return mudadas;
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
 * A fila só é limpa depois do sucesso do lote, e só dos ids daquele lote:
 * uma gravação que aconteça no meio do envio continua pendente e sobe na
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

  // Relê: o que entrou na fila durante o envio precisa continuar lá.
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
// Primeira carga
// ══════════════════════════════════════════════════════════════════════

/**
 * A entrada no app, e a única parte que precisa de cuidado especial.
 *
 * Puxa tudo primeiro e só então decide o que subir, comparando registro a
 * registro com o que veio. Sem essa comparação, o aparelho reenviaria o
 * banco inteiro a cada abertura, e cada reenvio faria o outro aparelho
 * baixar tudo de novo — dois aparelhos se acordando em looping.
 *
 * O que é local e não está lá sobe; o que é igual não sobe. O histórico
 * de quem já usava o app antes da conta entra por aqui, sem nada apagar.
 */
export async function primeiraCarga(): Promise<string[]> {
  const mudadas = await puxar();

  if (!supabase) return mudadas;

  const remotos = new Map<string, string>();
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await supabase
      .from('registros')
      .select('colecao, registro_id, dados, excluido')
      .range(pagina * LOTE, (pagina + 1) * LOTE - 1);
    if (error) throw error;

    for (const l of data as LinhaRemota[]) {
      remotos.set(`${l.colecao} ${l.registro_id}`, l.excluido ? ' excluido' : JSON.stringify(l.dados));
    }
    if ((data as LinhaRemota[]).length < LOTE) break;
  }

  const p = pendentes();
  for (const chave of CHAVES_SINCRONIZADAS) {
    const faltando = desmontar(lerLocal(chave))
      .filter(r => remotos.get(`${chave} ${r.id}`) !== JSON.stringify(r.dados))
      .map(r => r.id);

    if (faltando.length > 0) {
      p[chave] = [...new Set([...(p[chave] ?? []), ...faltando])];
    }
  }
  gravarPendentes(p);

  return mudadas;
}

/**
 * Recomeça do zero, sem apagar nada.
 *
 * Esquece o carimbo e marca tudo o que está aqui para subir. É a saída
 * para quando os dois lados divergirem por qualquer motivo — a próxima
 * sincronização baixa o servidor inteiro e sobe o aparelho inteiro, e a
 * união dos dois é o resultado, porque nada aqui apaga por omissão.
 */
export function recomecar(): void {
  localStorage.removeItem(DESDE);
  for (const chave of CHAVES_SINCRONIZADAS) anotarTudo(chave);
}

/** Quantos registros ainda não subiram. Só para o diagnóstico da tela. */
export function quantosPendentes(): number {
  return Object.values(pendentes()).reduce((n, ids) => n + (ids?.length ?? 0), 0);
}

// ══════════════════════════════════════════════════════════════════════
// Tempo real
// ══════════════════════════════════════════════════════════════════════

/**
 * Avisa quando o outro aparelho grava, sem esperar o próximo ciclo.
 *
 * O filtro por `usuario_id` é o que mantém o canal privado. Também chega
 * evento das NOSSAS gravações — e tudo bem: a puxada que ele dispara pede
 * só o que é mais novo que o nosso carimbo, e o que acabamos de escrever
 * já está aqui.
 *
 * Se o Realtime não estiver ligado na tabela, a inscrição nunca dispara e
 * a vigia por tempo continua cobrindo. Por isso nada aqui lança erro: é
 * um acelerador, não a fundação.
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

export { DOC_INTEIRO };
