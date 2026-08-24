/**
 * Que documentos baixar e quais subir.
 *
 * Vive num módulo sem nenhum import, pelo mesmo motivo do `mesclar.ts`:
 * decidir errado aqui faz o app deixar de ver o que o outro aparelho
 * gravou — em silêncio, sem erro na tela — e sem dependências isto pode
 * ser testado rodando `node` direto no arquivo.
 *
 * A sincronização pergunta ao servidor de 10 em 10 segundos. Baixar todos
 * os documentos a cada pergunta gastaria o 4G da pessoa à toa, então a
 * pergunta barata é só `chave, atualizado_em` e este módulo decide, a
 * partir dela, o que vale a pena buscar de verdade.
 */

export interface Cabecalho {
  chave: string;
  atualizado_em: string;
}

export interface Plano {
  /** Documentos cujo conteúdo precisa ser baixado. */
  baixar: string[];
  /** Documentos que existem só aqui — nunca subiram. */
  subir: string[];
}

/**
 * @param cabecalhos   o que o servidor tem, sem o conteúdo
 * @param carimbos     quando cada documento foi sincronizado aqui
 * @param existeLocal  se a chave tem algo gravado neste aparelho
 * @param sincronizadas as chaves que fazem sentido sincronizar
 * @param completo     baixar tudo, ignorando carimbo (usado na entrada)
 */
export function planejar(
  cabecalhos: Cabecalho[],
  carimbos: Record<string, string>,
  existeLocal: (chave: string) => boolean,
  sincronizadas: readonly string[],
  completo: boolean,
): Plano {
  const baixar: string[] = [];
  const noServidor = new Set<string>();

  for (const c of cabecalhos) {
    if (!sincronizadas.includes(c.chave)) continue;
    noServidor.add(c.chave);

    const carimbo = carimbos[c.chave];
    // Sem carimbo: nunca sincronizamos este documento aqui.
    // Carimbo mais velho: alguém gravou lá depois de nós.
    // Sem cópia local: não há o que mesclar, é só trazer.
    const novidade = !carimbo || c.atualizado_em > carimbo || !existeLocal(c.chave);

    if (completo || novidade) baixar.push(c.chave);
  }

  const subir = sincronizadas.filter(
    chave => !noServidor.has(chave) && existeLocal(chave)
  );

  return { baixar, subir };
}
