import { supabase } from './supabase';
import { mesclar, podar } from './mesclar';
import { planejar, type Cabecalho } from './planejar';

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
  // As lápides. Precisa sincronizar como qualquer outro documento — é ela
  // que carrega a informação "isto foi excluído" para o outro aparelho.
  'evo_excluidos',
] as const;

/** Documento das lápides — o único com tratamento especial na puxada. */
const EXCLUIDOS = 'evo_excluidos';

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

export interface ResultadoDaPuxada {
  /** Documentos que mudaram AQUI — a interface precisa se redesenhar. */
  mudadas: string[];
  /**
   * Documentos que precisam subir: ou o servidor não os tem, ou a mescla
   * produziu algo diferente do que está lá.
   *
   * Existe para não reenviar às cegas tudo o que já está igual no
   * servidor. Cada envio sobrescreve o documento inteiro, então quanto
   * menos envio desnecessário, menor a janela em que o outro aparelho
   * pode gravar entre a nossa leitura e a nossa escrita.
   */
  aEnviar: string[];
}

/**
 * Aplica as lápides a todos os documentos guardados aqui.
 *
 * Devolve as chaves que perderam algum registro — precisam ser
 * redesenhadas e reenviadas, senão o servidor continua com o registro
 * excluído e o outro aparelho o traz de volta na próxima puxada.
 */
function podarTudo(): string[] {
  const excluidos = new Set(
    ((lerLocal(EXCLUIDOS) as { id: string }[] | null) ?? [])
      .filter(l => l && typeof l.id === 'string')
      .map(l => l.id)
  );
  if (excluidos.size === 0) return [];

  const podadas: string[] = [];
  for (const chave of CHAVES_SINCRONIZADAS) {
    if (chave === EXCLUIDOS) continue;
    const local = lerLocal(chave);
    const depois = podar(local, excluidos);
    if (depois !== local) {
      localStorage.setItem(chave, JSON.stringify(depois));
      podadas.push(chave);
    }
  }
  return podadas;
}

/** Mescla um documento do servidor no local. Devolve o que aconteceu. */
function absorver(doc: Documento, locais: Record<string, string>) {
  const local = lerLocal(doc.chave);

  if (local === null) {
    localStorage.setItem(doc.chave, JSON.stringify(doc.dados));
    marcarCarimbo(doc.chave, doc.atualizado_em);
    return { mudou: true, precisaEnviar: false };
  }

  const carimboLocal = locais[doc.chave];
  const remotoMaisNovo = !carimboLocal || doc.atualizado_em > carimboLocal;
  const unido = mesclar(local, doc.dados, remotoMaisNovo);

  const antes = JSON.stringify(local);
  const depois = JSON.stringify(unido);
  if (antes !== depois) localStorage.setItem(doc.chave, depois);
  marcarCarimbo(doc.chave, doc.atualizado_em);

  return {
    mudou: antes !== depois,
    // A mescla é uma união: se o resultado difere do que veio de lá, é
    // porque este aparelho tem algo que o servidor não tem.
    precisaEnviar: depois !== JSON.stringify(doc.dados),
  };
}

/**
 * Traz o servidor para cá, mesclando com o que já existe.
 *
 * Duas velocidades, e a diferença importa porque isto roda a cada poucos
 * segundos:
 *
 *  - `completo` (na entrada): baixa todos os documentos e compara
 *    conteúdo. É a varredura que conserta qualquer desencontro deixado por
 *    um envio que falhou numa sessão anterior.
 *  - padrão (vigia e foco): baixa só `chave, atualizado_em` — poucas
 *    centenas de bytes — e só busca o `dados` de quem está mais novo lá do
 *    que o carimbo daqui. Sem isso, vigiar de 10 em 10 segundos baixaria o
 *    banco inteiro o tempo todo, no 4G da pessoa.
 */
export async function puxar(completo = false): Promise<ResultadoDaPuxada> {
  if (!supabase) return { mudadas: [], aEnviar: [] };

  const locais = carimbos();
  const mudadas: string[] = [];
  const aEnviar: string[] = [];

  const { data: cabecalhos, error: erroCabecalhos } = await supabase
    .from('documentos')
    .select('chave, atualizado_em');
  if (erroCabecalhos) throw erroCabecalhos;

  const { baixar, subir } = planejar(
    cabecalhos as Cabecalho[],
    locais,
    chave => lerLocal(chave) !== null,
    CHAVES_SINCRONIZADAS,
    completo,
  );

  // Documento que só existe aqui ainda não subiu nenhuma vez.
  aEnviar.push(...subir);

  if (baixar.length > 0) {
    const { data, error } = await supabase
      .from('documentos')
      .select('chave, dados, atualizado_em')
      .in('chave', baixar);
    if (error) throw error;

    const docs = data as Documento[];

    // As lápides primeiro, sempre. Elas são o que decide se um registro
    // que chegou no mesmo lote deve entrar ou ser podado — absorvê-las
    // depois deixaria o registro excluído aparecer por um ciclo.
    const ordenados = [
      ...docs.filter(d => d.chave === EXCLUIDOS),
      ...docs.filter(d => d.chave !== EXCLUIDOS),
    ];

    ordenados.forEach(doc => {
      const r = absorver(doc, locais);
      if (r.mudou) mudadas.push(doc.chave);
      if (r.precisaEnviar) aEnviar.push(doc.chave);
    });
  }

  // Poda no fim, sobre TUDO o que está gravado aqui — e não só sobre o que
  // veio agora: a lápide pode ter chegado numa puxada anterior e o
  // registro ressuscitado estar parado no localStorage desde então.
  //
  // Só quando algo desceu, porém. Ressuscitar é coisa que só a mescla faz,
  // então puxada que não trouxe nada não tem o que podar — e varrer os
  // dezesseis documentos de dez em dez segundos à toa custaria bateria.
  // Qualquer sobra é pega pela varredura completa da entrada no app.
  for (const chave of baixar.length > 0 ? podarTudo() : []) {
    if (!mudadas.includes(chave)) mudadas.push(chave);
    if (!aEnviar.includes(chave)) aEnviar.push(chave);
  }

  return { mudadas, aEnviar };
}

/**
 * Avisa quando o outro aparelho grava, sem esperar o próximo ciclo.
 *
 * O filtro por `usuario_id` é o que mantém o canal privado: sem ele o
 * servidor mandaria evento de linha alheia. Também chega evento das
 * NOSSAS próprias gravações — e tudo bem: a puxada que ele dispara é a
 * versão barata, e nada lá é mais novo que o nosso carimbo, então não faz
 * trabalho nenhum.
 *
 * Se o Realtime não estiver ligado na tabela, a inscrição simplesmente
 * nunca dispara e a vigia por tempo continua cobrindo. Por isso nada aqui
 * lança erro: é um acelerador, não a fundação.
 */
export function assinarMudancas(usuarioId: string, aoMudar: () => void): () => void {
  if (!supabase) return () => {};

  const canal = supabase
    .channel(`documentos:${usuarioId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'documentos',
        filter: `usuario_id=eq.${usuarioId}`,
      },
      () => aoMudar()
    )
    .subscribe();

  return () => { supabase?.removeChannel(canal); };
}

/**
 * Manda documentos para o servidor, num envio só.
 *
 * Cada linha substitui o documento INTEIRO do lado de lá — por isso nada
 * deve chamar isto antes de ter puxado e mesclado; quem envia primeiro
 * apaga o que o outro aparelho gravou.
 */
export async function empurrarMuitas(chaves: string[]): Promise<void> {
  if (!supabase || chaves.length === 0) return;
  const sessao = (await supabase.auth.getSession()).data.session;
  if (!sessao) return;

  const linhas: { usuario_id: string; chave: string; dados: unknown }[] = [];
  for (const chave of chaves) {
    const dados = lerLocal(chave);
    if (dados !== null) {
      linhas.push({ usuario_id: sessao.user.id, chave, dados });
    }
  }

  if (linhas.length === 0) return;

  const { data, error } = await supabase
    .from('documentos')
    .upsert(linhas, { onConflict: 'usuario_id,chave' })
    .select('chave, atualizado_em');

  if (error) throw error;

  if (data) {
    (data as { chave: string; atualizado_em: string }[]).forEach(item => {
      if (item.atualizado_em) marcarCarimbo(item.chave, item.atualizado_em);
    });
  }
}
