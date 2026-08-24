/**
 * A tradução entre os dois formatos da sincronização.
 *
 * A tela lê documentos inteiros do `localStorage` ("todos os hábitos") e
 * isso não muda — é o que faz o app abrir instantâneo e funcionar sem
 * internet. O servidor, por outro lado, guarda um REGISTRO por linha, que
 * é o que impede um aparelho de apagar o que o outro gravou.
 *
 * Este módulo é a fronteira entre os dois, e vive sem nenhum import pelo
 * mesmo motivo do resto da sincronização: é a lógica em que um erro APAGA
 * dado do usuário em silêncio, e sem dependências ela roda no `node`
 * direto, sem bundler nem framework de teste.
 */

/**
 * Id do registro único de um documento que não é lista.
 *
 * `evo_foco_ajustes` é um objeto, `evo_destaques` é uma lista de ids
 * soltos: não há registro dentro deles para separar. Vão inteiros, como
 * um registro só, e aí a disputa entre aparelhos é pelo documento todo —
 * que para esses casos é o comportamento certo, porque editar "os
 * ajustes" é uma coisa só.
 */
export const DOC_INTEIRO = '__doc__';

export interface Registro {
  id: string;
  dados: unknown;
}

/** Linha como o servidor a devolve. */
export interface LinhaRemota {
  colecao: string;
  registro_id: string;
  dados: unknown;
  excluido: boolean;
  atualizado_em: string;
}

/** Lista de registros com `id` — o que pode ser quebrado linha a linha. */
function ehListaComId(v: unknown): v is { id: string }[] {
  return (
    Array.isArray(v) &&
    v.every(x => x !== null && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string')
  );
}

/**
 * Quebra um documento nos registros que o servidor guarda.
 *
 * O que não é lista com `id` vira um registro só, com `DOC_INTEIRO`.
 */
export function desmontar(documento: unknown): Registro[] {
  if (documento === null || documento === undefined) return [];
  if (!ehListaComId(documento)) return [{ id: DOC_INTEIRO, dados: documento }];
  return documento.map(r => ({ id: r.id, dados: r }));
}

/**
 * O que mudou de uma versão do documento para outra.
 *
 * É chamada na gravação, com o valor que estava lá antes — por isso a
 * exclusão é detectada com exatidão, sem lápide nem varredura: o registro
 * que existia antes e não existe agora foi excluído, ponto.
 */
export function diferenca(antes: unknown, depois: unknown): string[] {
  const deAntes = new Map(desmontar(antes).map(r => [r.id, JSON.stringify(r.dados)]));
  const deDepois = new Map(desmontar(depois).map(r => [r.id, JSON.stringify(r.dados)]));

  const mexidos: string[] = [];

  for (const [id, corpo] of deDepois) {
    if (deAntes.get(id) !== corpo) mexidos.push(id);
  }
  // Estava antes e sumiu: foi excluído.
  for (const id of deAntes.keys()) {
    if (!deDepois.has(id)) mexidos.push(id);
  }

  return mexidos;
}

/**
 * Aplica linhas do servidor sobre o documento local.
 *
 * `pendentes` são os ids cuja mudança local ainda não subiu. Eles são
 * ignorados de propósito: a nossa versão é mais nova que a do servidor
 * (ela ainda nem chegou lá), e sobrescrever agora desfaria na tela algo
 * que a pessoa acabou de fazer, para logo depois reenviar — piscando o
 * valor antigo no meio.
 *
 * Devolve o MESMO valor quando nada muda, para quem chama distinguir
 * "apliquei" de "não havia o que aplicar" sem comparar JSON.
 */
export function aplicar(
  documento: unknown,
  linhas: LinhaRemota[],
  pendentes: Set<string> = new Set(),
): unknown {
  const uteis = linhas.filter(l => !pendentes.has(l.registro_id));
  if (uteis.length === 0) return documento;

  // Documento inteiro: a linha É o documento. Excluído aqui significa que
  // o documento foi zerado do outro lado.
  const inteiro = uteis.find(l => l.registro_id === DOC_INTEIRO);
  if (inteiro) return inteiro.excluido ? null : inteiro.dados;

  const atuais = ehListaComId(documento) ? documento : [];
  const porId = new Map<string, { id: string }>(atuais.map(r => [r.id, r]));

  let mudou = false;
  for (const linha of uteis) {
    if (linha.excluido) {
      if (porId.delete(linha.registro_id)) mudou = true;
      continue;
    }
    const corpo = linha.dados as { id: string } | null;
    if (corpo === null || typeof corpo !== 'object') continue;
    if (JSON.stringify(porId.get(linha.registro_id)) !== JSON.stringify(corpo)) {
      porId.set(linha.registro_id, corpo);
      mudou = true;
    }
  }

  return mudou ? [...porId.values()] : documento;
}

/**
 * As linhas a enviar, a partir dos ids que mudaram aqui.
 *
 * O id que não está mais no documento virou exclusão — é o mesmo caminho,
 * e é por isso que não existe código de exclusão em lugar nenhum: apagar
 * é só gravar uma linha com `excluido`.
 */
export function paraEnviar(
  colecao: string,
  documento: unknown,
  ids: string[],
): { colecao: string; registro_id: string; dados: unknown; excluido: boolean }[] {
  const vivos = new Map(desmontar(documento).map(r => [r.id, r.dados]));

  return ids.map(id => {
    const existe = vivos.has(id);
    return {
      colecao,
      registro_id: id,
      dados: existe ? vivos.get(id) : null,
      excluido: !existe,
    };
  });
}
