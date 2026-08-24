/**
 * Mesclagem de documentos entre aparelhos.
 *
 * Vive num módulo próprio, sem nenhum import, por dois motivos: é a única
 * lógica do app em que um erro APAGA dado do usuário em silêncio, e sem
 * dependências ela pode ser testada rodando `node` direto no arquivo, sem
 * bundler nem framework de teste.
 *
 * ── A regra ──
 *
 * "O mais recente vence" aplicado ao documento INTEIRO perde dado: marcar
 * um hábito no celular e outro no PC faria um dos dois sumir por completo.
 * Por isso a mescla é POR REGISTRO, com o `id` como chave — a união dos
 * dois lados, e em caso de mesmo `id` fica o do lado mais recente.
 *
 * O caso comum (registros diferentes em aparelhos diferentes) não perde
 * nada. Só há descarte quando os dois editaram o MESMO registro, e aí não
 * existe resposta certa sem perguntar.
 */

/** Lista de registros com `id` — o que a mescla por registro trata. */
function ehListaComId(v: unknown): v is { id: string }[] {
  return (
    Array.isArray(v) &&
    v.every(x => x !== null && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string')
  );
}

/**
 * Une dois documentos.
 *
 * `remotoMaisNovo` decide o empate de `id`, e decide sozinho quando o
 * documento não é lista com id (um objeto de ajustes, por exemplo) — aí
 * não há o que unir e volta a valer o documento inteiro.
 */
export function mesclar(local: unknown, remoto: unknown, remotoMaisNovo: boolean): unknown {
  if (ehListaComId(local) && ehListaComId(remoto)) {
    const porId = new Map<string, { id: string }>();
    // Primeiro o perdedor, depois o vencedor: o segundo sobrescreve o
    // primeiro nos ids repetidos, e os ids exclusivos dos dois sobrevivem.
    const [primeiro, segundo] = remotoMaisNovo ? [local, remoto] : [remoto, local];
    primeiro.forEach(r => porId.set(r.id, r));
    segundo.forEach(r => porId.set(r.id, r));
    return [...porId.values()];
  }

  // `evo_destaques` é uma lista de ids soltos: união sem duplicar.
  if (
    Array.isArray(local) && Array.isArray(remoto) &&
    local.every(x => typeof x === 'string') && remoto.every(x => typeof x === 'string')
  ) {
    return [...new Set([...(remoto as string[]), ...(local as string[])])];
  }

  return remotoMaisNovo ? remoto : local;
}

/**
 * Tira da lista os registros que foram excluídos.
 *
 * A união do `mesclar` não sabe apagar: ela só soma os dois lados. Sem
 * esta poda, o hábito excluído no PC volta da cópia do celular na
 * primeira sincronização — e volta em definitivo, porque logo em seguida
 * é reenviado ao servidor como se fosse novidade.
 *
 * Devolve o MESMO valor quando nada sai, para quem chama conseguir
 * distinguir "podei" de "não havia o que podar" sem comparar JSON.
 */
export function podar(dados: unknown, excluidos: Set<string>): unknown {
  if (excluidos.size === 0 || !ehListaComId(dados)) return dados;
  const ficam = dados.filter(r => !excluidos.has(r.id));
  return ficam.length === dados.length ? dados : ficam;
}
