import { supabase } from './supabase';
import { mesclar } from './mesclar';

/**
 * Sincronização entre aparelhos.
 *
 * O app grava tudo no `localStorage` e continua funcionando offline; esta
 * camada leva cada documento para o servidor e traz de volta o que outro
 * aparelho mudou. O `localStorage` segue sendo a fonte que a interface lê —
 * nada aqui deixa a tela esperando rede.
 *
 * ── A regra de mesclagem, que é o ponto inteiro ──
 *
 * "O mais recente vence" aplicado ao documento INTEIRO perde dado: se você
 * marcar um hábito no celular e outro no PC, um dos dois some por completo.
 * Por isso a mescla é POR REGISTRO, usando o `id` como chave: a união dos
 * dois lados, e em caso de mesmo `id` fica o do lado mais recente.
 *
 * Assim o caso comum — registros diferentes criados em aparelhos
 * diferentes — não perde nada. Só há descarte quando os dois editaram o
 * MESMO registro, e aí não existe resposta certa sem perguntar.
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

/**
 * Ficam de fora de propósito:
 * - `evo_foco_andamento`: cronômetro rodando AGORA, preso a este aparelho.
 *   Sincronizar faria o celular achar que tem um bloco em andamento que na
 *   verdade está correndo no PC.
 * - `evo_foco_cabine`: estado de janela, não é dado do usuário.
 * - `evo_dashboard_janela`: preferência de tela, por aparelho.
 */

export { mesclar };

export type EstadoDaSincronizacao = 'ocioso' | 'enviando' | 'erro' | 'desligada';

interface Documento {
  chave: string;
  dados: unknown;
  atualizado_em: string;
}

function lerLocal(chave: string): unknown {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto === null ? null : JSON.parse(bruto);
  } catch {
    return null;
  }
}

/** Quando cada documento foi gravado aqui pela última vez. */
const CARIMBOS = 'evo_sync_carimbos';

function carimbos(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CARIMBOS) || '{}');
  } catch {
    return {};
  }
}

function marcarCarimbo(chave: string, quando: string) {
  const c = carimbos();
  c[chave] = quando;
  localStorage.setItem(CARIMBOS, JSON.stringify(c));
}

/**
 * Traz o servidor para cá, mesclando com o que já existe.
 *
 * Roda na entrada e sempre que a aba volta ao foco. Devolve as chaves que
 * mudaram, para a interface saber que precisa se redesenhar.
 */
export async function puxar(): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('documentos')
    .select('chave, dados, atualizado_em');

  if (error) throw error;

  const mudadas: string[] = [];
  const locais = carimbos();

  (data as Documento[]).forEach(doc => {
    if (!CHAVES_SINCRONIZADAS.includes(doc.chave as typeof CHAVES_SINCRONIZADAS[number])) return;

    const local = lerLocal(doc.chave);
    if (local === null) {
      localStorage.setItem(doc.chave, JSON.stringify(doc.dados));
      marcarCarimbo(doc.chave, doc.atualizado_em);
      mudadas.push(doc.chave);
      return;
    }

    const carimboLocal = locais[doc.chave];
    const remotoMaisNovo = !carimboLocal || doc.atualizado_em > carimboLocal;
    const unido = mesclar(local, doc.dados, remotoMaisNovo);

    const antes = JSON.stringify(local);
    const depois = JSON.stringify(unido);
    if (antes !== depois) {
      localStorage.setItem(doc.chave, depois);
      mudadas.push(doc.chave);
    }
    marcarCarimbo(doc.chave, doc.atualizado_em);
  });

  return mudadas;
}

/** Manda um documento para o servidor. */
export async function empurrar(chave: string): Promise<void> {
  if (!supabase) return;
  const sessao = (await supabase.auth.getSession()).data.session;
  if (!sessao) return;

  const dados = lerLocal(chave);
  if (dados === null) return;

  const { data, error } = await supabase
    .from('documentos')
    .upsert(
      { usuario_id: sessao.user.id, chave, dados },
      { onConflict: 'usuario_id,chave' }
    )
    .select('atualizado_em')
    .single();

  if (error) throw error;
  // Guarda o carimbo do BANCO, não o daqui: é ele que a próxima mescla
  // compara, e relógio de aparelho não é confiável.
  if (data?.atualizado_em) marcarCarimbo(chave, data.atualizado_em);
}

/** Manda tudo — usado no primeiro login, para semear a conta. */
export async function empurrarTudo(): Promise<void> {
  for (const chave of CHAVES_SINCRONIZADAS) {
    if (localStorage.getItem(chave) !== null) await empurrar(chave);
  }
}
