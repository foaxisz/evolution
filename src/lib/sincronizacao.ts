import { supabase } from './supabase';
import {
  desmontar, diferenca, aplicar, aplicaveis, paraEnviar, faltandoNoServidor,
  canonico, DOC_INTEIRO, EXCLUIDO_CANONICO, type LinhaRemota,
} from './registros';

/**
 * Sincronização entre aparelhos (v3 - Ciclo Unificado e Anti-Ressurreição).
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
 * ── Ordem do ciclo unificado: ENVIAR e depois PUXAR ──
 *
 * A ordem é SEMPRE Enviar → Puxar → Reconciliar (se primeira carga).
 * Enviando primeiro, o que fizemos já está no servidor quando a resposta
 * chega e volta idêntico. O que o outro fez tem carimbo maior e vence —
 * inclusive exclusão.
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
  // Documento inteiro (um id, ou null), não lista: entra pelo caminho do
  // DOC_INTEIRO. Esquecer esta linha faria a eleição do próximo gravar aqui
  // e nunca subir — falha silenciosa, que é a marca registrada dos bugs de
  // sincronização deste projeto.
  'evo_shopping_proximo',
  'evo_actions',
  'evo_interacoes',
  'evo_foco_categorias',
  'evo_foco_sessoes',
  'evo_foco_metas_trimestre',
  'evo_foco_metas_semana',
  'evo_destaques',
  // Sem esta linha a história grava aqui e nunca sobe — a falha
  // silenciosa clássica deste projeto.
  'evo_historias',
  'evo_foco_ajustes',
] as const;

export type ChaveSincronizada = typeof CHAVES_SINCRONIZADAS[number];

export type EstadoDaSincronizacao = 'ocioso' | 'enviando' | 'erro' | 'desligada';

export function ehSincronizada(chave: string): chave is ChaveSincronizada {
  return (CHAVES_SINCRONIZADAS as readonly string[]).includes(chave);
}

const PENDENTES = 'evo_sync_pendentes';
const DESDE = 'evo_sync_desde';
const VERSAO_LOCAL = 'evo_sync_versao';
const USUARIO = 'evo_sync_usuario';

/**
 * Versão do estado local de sincronização.
 *
 * Subir este número faz cada aparelho descartar carimbo e fila na primeira
 * abertura e refazer a carga completa. Vai a 4 porque o carimbo gravado
 * pelas versões anteriores foi produzido sem a margem de segurança e sem
 * ordenação total — pode ter passado por cima de linhas que nunca foram
 * lidas. Recomeçar a leitura é o único jeito de recuperá-las.
 */
const VERSAO = '4';

/** Roda uma vez por aparelho, na primeira chamada depois de atualizar. */
function migrarEstadoLocal(): void {
  if (localStorage.getItem(VERSAO_LOCAL) === VERSAO) return;
  localStorage.removeItem(DESDE);
  localStorage.removeItem(PENDENTES);
  localStorage.removeItem('evo_excluidos');
  localStorage.removeItem('evo_sync_carimbos');
  localStorage.setItem(VERSAO_LOCAL, VERSAO);
}

/** O que a troca de conta neste aparelho exige. */
type Procedencia = 'mesmo' | 'primeiro' | 'trocou';

/**
 * Confere de quem é o dado que está neste aparelho.
 *
 * Sem isto havia vazamento entre contas, e do pior tipo — silencioso e para
 * dentro do servidor. `sair()` limpava o carimbo e a fila, mas os
 * documentos seguiam no `localStorage`, porque o app é local primeiro e
 * funciona sem conta. Entrando outra conta no mesmo aparelho, o carimbo
 * ausente fazia a próxima sincronização ser tratada como primeira carga — e
 * a reconciliação da primeira carga sobe TUDO o que é local e não está no
 * servidor. O histórico da conta anterior ia inteiro para a conta nova.
 *
 * As três procedências e o que cada uma significa:
 *
 *  - `primeiro`: ninguém havia sincronizado aqui. O que está no
 *    `localStorage` é o histórico de quem usava o app antes de existir
 *    conta, e subir é justamente o que se quer.
 *  - `mesmo`: a conta é a de sempre. Nada a fazer.
 *  - `trocou`: o dado local é de OUTRA conta. Ele não pode subir. É apagado
 *    daqui — ele continua no servidor, sob a conta dele, e a carga limpa
 *    desta conta entra em seguida.
 */
export function conferirDono(usuarioId: string): Procedencia {
  const anterior = localStorage.getItem(USUARIO);

  if (anterior === usuarioId) return 'mesmo';

  if (anterior === null) {
    localStorage.setItem(USUARIO, usuarioId);
    return 'primeiro';
  }

  for (const chave of CHAVES_SINCRONIZADAS) localStorage.removeItem(chave);
  localStorage.removeItem(DESDE);
  localStorage.removeItem(PENDENTES);
  localStorage.setItem(USUARIO, usuarioId);
  return 'trocou';
}

/** Quantas linhas por requisição. */
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

/** Anota que estes registros mudaram aqui. */
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

/**
 * Margem de segurança do carimbo, em milissegundos.
 *
 * O carimbo guardado fica de propósito ATRÁS da linha mais nova que vimos.
 * O motivo é que carimbo e ordem de commit não são a mesma coisa: uma
 * transação que começou antes pode confirmar depois, e aí uma linha com
 * carimbo MENOR aparece no banco DEPOIS de já termos avançado o carimbo
 * além dela. Com `.gt` puro essa linha nunca mais seria lida — dado perdido
 * em silêncio, sem erro em lugar nenhum.
 *
 * Reler os últimos segundos a cada ciclo fecha essa janela. Custa pouco
 * (são poucas linhas) e é inofensivo, porque aplicar a mesma linha duas
 * vezes não muda nada: `aplicar` devolve o mesmo objeto e a tela não
 * redesenha.
 */
const MARGEM_MS = 5_000;

/**
 * Busca linhas do servidor, paginado. `desde` nulo traz tudo.
 *
 * A ordenação inclui `colecao` e `registro_id` além do carimbo, e isso não
 * é enfeite: `range()` pagina por posição, então a ordem precisa ser TOTAL.
 * Ordenando só por carimbo, linhas de carimbo igual ficavam em ordem
 * arbitrária entre uma página e a outra — a página 2 podia repetir uma
 * linha da página 1 e PULAR outra. Com a primeira carga gravando tudo numa
 * transação só (e portanto com carimbos iguais, antes do
 * `clock_timestamp()`), isso era perda garantida acima de 500 registros.
 */
async function buscar(desde: string | null): Promise<LinhaRemota[]> {
  if (!supabase) return [];
  const linhas: LinhaRemota[] = [];

  for (let pagina = 0; ; pagina++) {
    let consulta = supabase
      .from('registros')
      .select('colecao, registro_id, dados, excluido, atualizado_em')
      .order('atualizado_em', { ascending: true })
      .order('colecao', { ascending: true })
      .order('registro_id', { ascending: true })
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
 * Avança o carimbo, com a margem, e sem nunca andar para trás.
 *
 * O `Math.max` contra o valor anterior existe porque a margem poderia
 * fazer o carimbo retroceder num ciclo em que só chegaram linhas antigas —
 * e carimbo que anda para trás vira releitura crescente a cada ciclo.
 */
function avancarCarimbo(linhas: LinhaRemota[], anterior: string | null): void {
  if (linhas.length === 0) return;

  let maior = '';
  for (const l of linhas) if (l.atualizado_em > maior) maior = l.atualizado_em;
  if (!maior) return;

  const comMargem = new Date(Date.parse(maior) - MARGEM_MS).toISOString();
  const novo = anterior && anterior > comMargem ? anterior : comMargem;
  localStorage.setItem(DESDE, novo);
}

export async function puxar(): Promise<string[]> {
  if (!supabase) return [];
  const desde = localStorage.getItem(DESDE);
  const linhas = await buscar(desde);
  if (linhas.length === 0) return [];

  // Aplicar ANTES de avançar o carimbo. Se a gravação local falhar — disco
  // cheio dá `QuotaExceededError` — a exceção sobe com o carimbo intacto e
  // o mesmo intervalo é pedido de novo no ciclo seguinte. Avançando antes,
  // o intervalo seria considerado lido e o dado sumiria.
  const mudadas = aplicarLinhas(linhas);
  avancarCarimbo(linhas, desde);

  return mudadas;
}

/**
 * Grava as linhas que chegaram sobre os documentos locais.
 *
 * Não mexe mais na fila de envio. A versão anterior removia da fila o id de
 * todo registro que chegasse excluído, para "resolver o conflito" — mas
 * como o ciclo envia ANTES de puxar, um id na fila na hora da puxada é
 * necessariamente uma gravação feita DEPOIS do nosso envio, ou seja, a mais
 * nova que existe. Descartá-la era jogar fora a alteração mais recente do
 * usuário, calada.
 *
 * Sem o descarte, a convergência acontece sozinha: a puxada aplica a
 * exclusão, o id segue na fila, e no ciclo seguinte `paraEnviar` vê que ele
 * não está mais no documento e manda a exclusão adiante. Um ciclo a mais,
 * nenhuma perda.
 */
function aplicarLinhas(linhas: LinhaRemota[]): string[] {
  /*
   * O que está na fila AGORA é mais novo que o que o servidor devolveu.
   *
   * `empurrar` limpa da fila só os ids que ele mesmo subiu, então o que
   * sobra aqui foi gravado DEPOIS do envio — durante a ida e volta da rede.
   * Aplicar a resposta em cima disso apaga a gravação mais recente.
   *
   * Era o bug de contar água: cada clique agenda um ciclo, e o clique
   * seguinte caía dentro da janela de rede do ciclo anterior. Enviava 1,
   * clicava para 2, a puxada respondia 1 e gravava 1 por cima — dois
   * cliques terminavam em um, e às vezes parecia que o clique REMOVEU.
   *
   * O id fica na fila: o ciclo seguinte manda o valor local adiante, e a
   * convergência acontece um ciclo depois. Isto NÃO é o "escudo" antigo, que
   * tirava o id da fila e com isso perdia a alteração de vez.
   *
   * A exclusão passa mesmo assim, de propósito. Sem carimbo não há como
   * ordenar a minha edição contra a exclusão do outro aparelho, e entre
   * ressuscitar um registro apagado e perder uma edição, ressuscitar é o
   * erro pior — foi exatamente o bug que a exclusão com lápide veio
   * consertar.
   */
  const porColecao = new Map<string, LinhaRemota[]>();
  for (const linha of aplicaveis(linhas, pendentes())) {
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
// Ciclo Unificado (v3)
// ══════════════════════════════════════════════════════════════════════

/**
 * Executa o ciclo de sincronização de forma unificada e determinística:
 * 1. ENVIAR (empurra pendentes locais ao Supabase)
 * 2. PUXAR (busca alterações remotas desde o último carimbo)
 * 3. RECONCILIAR (em primeira carga/reset, descobre dados locais pré-existentes que faltam no servidor)
 */
/**
 * O ciclo, e a ordem é o que o torna correto.
 *
 *   0. Conferir de quem é o dado local (troca de conta)
 *   1. ENVIAR o que está pendente
 *   2. PUXAR o que mudou desde o carimbo
 *   3. RECONCILIAR, só na primeira carga deste aparelho
 *
 * Enviar antes de puxar é o que dispensa qualquer escudo: quando a resposta
 * chega, o que a pessoa acabou de fazer já está no servidor e volta
 * idêntico. O que o outro aparelho fez depois tem carimbo maior e vence,
 * inclusive exclusão.
 *
 * A reconciliação existe só para o aparelho que ainda não tem carimbo, e
 * roda DEPOIS da puxada de propósito: o registro excluído em outro aparelho
 * já saiu do documento local quando a decisão de subir é tomada, então ele
 * não é candidato. Era o inverso disso que ressuscitava dado apagado.
 */
export async function executarCiclo(): Promise<string[]> {
  if (!supabase) return [];
  migrarEstadoLocal();

  const sessao = (await supabase.auth.getSession()).data.session;
  if (!sessao) return [];

  // 0. De quem é o dado que está aqui? Pode exigir limpeza antes de tudo.
  const procedencia = conferirDono(sessao.user.id);

  // 1. Sobe o que está pendente.
  await empurrar();

  // 2. Puxa. `desde` é lido depois do envio porque `conferirDono` pode
  //    tê-lo apagado.
  const desde = localStorage.getItem(DESDE);
  const ePrimeiraCarga = desde === null;
  const linhas = await buscar(desde);

  let mudadas: string[] = [];
  if (linhas.length > 0) {
    mudadas = aplicarLinhas(linhas);
    avancarCarimbo(linhas, desde);
  } else if (ePrimeiraCarga) {
    // Servidor vazio na primeira carga. Marca o carimbo para não repetir a
    // varredura completa a cada ciclo, mas com uma data antiga: qualquer
    // linha que exista passa pelo `.gt` na próxima vez.
    localStorage.setItem(DESDE, '1970-01-01T00:00:00.000Z');
  }

  // 3. Reconciliação. Só na primeira carga, e nunca depois de troca de
  //    conta: ali o local foi apagado justamente porque era de outro dono.
  if (ePrimeiraCarga && procedencia !== 'trocou') {
    const remotos = new Map<string, string>();
    for (const l of linhas) {
      remotos.set(
        `${l.colecao} ${l.registro_id}`,
        l.excluido ? EXCLUIDO_CANONICO : canonico(l.dados),
      );
    }

    const p = pendentes();
    let novos = false;
    for (const chave of CHAVES_SINCRONIZADAS) {
      const faltam = faltandoNoServidor(lerLocal(chave), remotos, chave);
      if (faltam.length > 0) {
        acrescentar(p, chave, faltam);
        novos = true;
      }
    }
    if (novos) {
      gravarPendentes(p);
      await empurrar();
    }
  }

  return mudadas;
}

/** Compatibilidade: alias para a primeira carga usando o ciclo unificado. */
export async function primeiraCarga(): Promise<string[]> {
  return executarCiclo();
}

/** Este aparelho já sincronizou alguma vez? */
export function jaSincronizou(): boolean {
  migrarEstadoLocal();
  return localStorage.getItem(DESDE) !== null;
}

/** Recomeça do zero, sem apagar nada. */
export function recomecar(): void {
  localStorage.removeItem(DESDE);
  localStorage.removeItem(PENDENTES);
}

/** Quantos registros ainda não subiram. Só para diagnóstico. */
export function quantosPendentes(): number {
  return Object.values(pendentes()).reduce((n, ids) => n + (ids?.length ?? 0), 0);
}

/**
 * Traduz a falha do ciclo para uma frase que diz o que fazer.
 *
 * Isto não é polimento: a tela mostrava só "Sem sincronizar" para qualquer
 * falha, e por isso a tabela que faltava no banco passou por três
 * reescrituras da lógica sem ninguém saber que a causa era um 404. Um erro
 * que não se identifica manda consertar o lugar errado.
 */
export function diagnosticar(e: unknown): string {
  const erro = e as { code?: string; name?: string; message?: string; status?: number } | null;
  const codigo = erro?.code ?? '';
  // `name` junto de `message`: `DOMException` guarda "QuotaExceededError" em
  // `name`, e só olhar a mensagem deixava passar justamente o caso de disco
  // cheio — que é o mais provável de acontecer no aparelho de quem usa.
  const msg = `${erro?.name ?? ''} ${erro?.message ?? String(e ?? '')}`.toLowerCase();

  // PGRST205: a tabela não existe no banco. Foi exatamente este o caso.
  if (codigo === 'PGRST205' || msg.includes('could not find the table')) {
    return 'A tabela `registros` não existe no banco. Rode a migração v4 no SQL Editor do Supabase.';
  }
  // 42501 / PGRST301: RLS barrou, ou a sessão expirou.
  if (codigo === '42501' || codigo === 'PGRST301' || erro?.status === 401 || erro?.status === 403) {
    return 'O banco recusou a operação (permissão ou sessão expirada). Saia e entre de novo.';
  }
  if (codigo === '23503') {
    return 'Usuário não encontrado no banco. A conta pode ter sido removida.';
  }
  if (msg.includes('quotaexceeded') || msg.includes('quota')) {
    return 'Armazenamento do navegador cheio. Libere espaço no disco.';
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
    return 'Sem conexão com o servidor.';
  }
  return erro?.message ? `Falha na sincronização: ${erro.message}` : 'Falha na sincronização.';
}

// ══════════════════════════════════════════════════════════════════════
// Tempo real
// ══════════════════════════════════════════════════════════════════════

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
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        console.warn('[evo sync] Canal Realtime fechado ou com erro. A vigia por tempo continuará cobrindo.');
      }
    });

  return () => {
    supabase?.removeChannel(canal);
  };
}

export { DOC_INTEIRO, desmontar };
