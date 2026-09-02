/**
 * A tradução entre os dois formatos da sincronização.
 *
 * A tela lê documentos inteiros do `localStorage` ("todos os hábitos") e
 * isso não muda — é o que faz o app abrir instantâneo e funcionar sem
 * internet. O servidor guarda um REGISTRO por linha, que é o que impede um
 * aparelho de apagar o que o outro gravou.
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
 * soltos: não há registro dentro deles para separar. Vão inteiros, como um
 * registro só, e aí a disputa entre aparelhos é pelo documento todo — que
 * para esses casos é o certo, porque editar "os ajustes" é uma coisa só.
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

/**
 * Texto canônico de um valor, com as chaves em ordem estável.
 *
 * `JSON.stringify` preserva a ordem de inserção das chaves, e o Postgres
 * NORMALIZA essa ordem ao guardar `jsonb` — sorteia por tamanho e depois
 * alfabeticamente. Então o mesmo registro, comparado antes e depois de
 * passar pelo banco, dava strings diferentes.
 *
 * Isso não era um detalhe estético: a comparação era o que decidia o que
 * subir, e com ela sempre falsa TODO registro era marcado como pendente a
 * cada abertura do app. Um registro excluído em outro aparelho, ainda
 * presente aqui, era reenviado VIVO — e ressuscitava.
 */
export function canonico(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(canonico).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).sort()
    .map(k => JSON.stringify(k) + ':' + canonico(o[k]))
    .join(',') + '}';
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
  const deAntes = new Map(desmontar(antes).map(r => [r.id, canonico(r.dados)]));
  const deDepois = new Map(desmontar(depois).map(r => [r.id, canonico(r.dados)]));

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
 * SEM escudo. A versão anterior ignorava as linhas de registros que ainda
 * estavam na fila de envio, com o argumento de que o local era mais novo.
 * O efeito real era outro: um registro preso na fila ficava PERMANENTEMENTE
 * surdo — a exclusão vinda do outro aparelho era descartada, o registro
 * seguia vivo aqui, e o envio seguinte o ressuscitava no servidor. O
 * escudo não protegia o dado, ele o ressuscitava.
 *
 * A ordem do ciclo é que resolve o problema que o escudo tentava resolver:
 * enviando ANTES de puxar, o que a pessoa acabou de fazer já está no
 * servidor quando a resposta chega, e a resposta devolve o mesmo valor.
 *
 * Devolve o MESMO valor quando nada muda, para quem chama distinguir
 * "apliquei" de "não havia o que aplicar" sem comparar JSON.
 */
/**
 * Filtra as linhas que a puxada pode aplicar por cima do que está local.
 *
 * Regra única: se o id ainda está na fila de envio, a versão local é mais
 * nova que a resposta do servidor. `empurrar` só tira da fila os ids que ele
 * mesmo subiu, então o que sobra foi gravado DEPOIS do envio — durante a ida
 * e volta da rede. Aplicar a resposta ali apaga a gravação mais recente.
 *
 * Era o bug de contar água: cada clique agenda um ciclo, o clique seguinte
 * caía dentro da janela de rede do anterior, e a puxada devolvia o valor
 * velho e o gravava por cima. Dois cliques terminavam em um.
 *
 * O id FICA na fila — o ciclo seguinte manda o valor local e a convergência
 * acontece um ciclo depois. É o que separa isto do "escudo" antigo, que
 * tirava o id da fila e perdia a alteração de vez.
 *
 * Exclusão passa mesmo protegida. Sem carimbo não há como ordenar minha
 * edição contra a exclusão do outro aparelho, e entre ressuscitar um
 * registro apagado e perder uma edição, ressuscitar é o erro pior.
 */
export function aplicaveis(
  linhas: LinhaRemota[],
  pendentes: Record<string, string[] | undefined>,
): LinhaRemota[] {
  const protegidos = new Map<string, Set<string>>();
  for (const colecao of Object.keys(pendentes)) {
    const ids = pendentes[colecao];
    if (ids && ids.length > 0) protegidos.set(colecao, new Set(ids));
  }
  if (protegidos.size === 0) return linhas;

  return linhas.filter(
    l => l.excluido || !protegidos.get(l.colecao)?.has(l.registro_id)
  );
}

export function aplicar(documento: unknown, linhas: LinhaRemota[]): unknown {
  if (linhas.length === 0) return documento;

  /*
   * Documento inteiro: a linha É o documento. Excluído aqui significa que
   * o documento foi zerado do outro lado.
   *
   * Devolve o documento QUE JÁ ESTAVA AQUI quando o conteúdo é o mesmo, e
   * não a cópia que veio do servidor. Quem chama decide "mudou?" comparando
   * referência (`depois === antes`), e uma cópia recém-desserializada nunca
   * é a mesma referência — mesmo idêntica byte a byte.
   *
   * Sem isto, todo ciclo que trazia um documento inteiro de volta era
   * contado como mudança, e o app remontava a página inteira: quem estava
   * dentro de um quadro era jogado para a lista de frentes a cada poucos
   * segundos. Um registro que o próprio aparelho acabou de subir voltando
   * igual não é novidade nenhuma.
   */
  const inteiro = linhas.find(l => l.registro_id === DOC_INTEIRO);
  if (inteiro) {
    if (inteiro.excluido) return null;
    return canonico(inteiro.dados) === canonico(documento) ? documento : inteiro.dados;
  }

  const atuais = ehListaComId(documento) ? documento : [];
  const porId = new Map<string, { id: string }>(atuais.map(r => [r.id, r]));

  let mudou = false;
  for (const linha of linhas) {
    if (linha.excluido) {
      if (porId.delete(linha.registro_id)) mudou = true;
      continue;
    }
    const corpo = linha.dados as { id: string } | null;
    if (corpo === null || typeof corpo !== 'object') continue;
    if (canonico(porId.get(linha.registro_id)) !== canonico(corpo)) {
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
 * e é por isso que não existe código de exclusão em lugar nenhum: apagar é
 * só gravar uma linha com `excluido`.
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

export const EXCLUIDO_CANONICO = '__EXCLUIDO__';

/**
 * Registros locais que o servidor não tem, ou tem diferentes.
 *
 * Usada só na primeira sincronização de um aparelho, e SEMPRE depois de
 * aplicar o que veio do servidor. A ordem importa: quem foi excluído em
 * outro aparelho já saiu do documento local quando esta função roda, então
 * ele não é candidato a subir. Era o inverso disso que ressuscitava dado.
 */
export function faltandoNoServidor(
  documento: unknown,
  remotos: Map<string, string>,
  colecao: string,
): string[] {
  return desmontar(documento)
    .filter(r => {
      const val = remotos.get(`${colecao} ${r.id}`);
      if (val === EXCLUIDO_CANONICO) return false;
      return val !== canonico(r.dados);
    })
    .map(r => r.id);
}

