/**
 * A disposição do mapa mental.
 *
 * Sem imports, como os outros `lib` deste projeto: roda no `node` direto e
 * dá para testar sem bundler. Árvore torta e nó sobreposto são erros que a
 * tela esconde — quem olha vê "um mapa" e não percebe que dois nós estão no
 * mesmo lugar ou que um galho sumiu.
 */

export interface NoBasico {
  id: string;
  /** Ausente = raiz. */
  paiId?: string;
  /** Posição entre irmãos. */
  ordem: number;
}

export interface PosicaoDeNo {
  id: string;
  x: number;
  y: number;
  profundidade: number;
}

/** Largura de um nó mais o vão até o filho. */
export const ESPACO_X = 210;
/** Altura de uma faixa — o passo vertical entre folhas. */
export const ESPACO_Y = 54;

/** Filhos de cada pai, já ordenados. */
function filhosPorPai(nos: readonly NoBasico[]): Map<string, NoBasico[]> {
  const porId = new Set(nos.map(n => n.id));
  const mapa = new Map<string, NoBasico[]>();

  for (const n of nos) {
    // Pai que não existe = órfão, e órfão é tratado como raiz. Sumir com ele
    // seria perder texto que a pessoa escreveu por causa de uma referência
    // quebrada.
    const chave = n.paiId && porId.has(n.paiId) ? n.paiId : '__raiz__';
    const lista = mapa.get(chave);
    if (lista) lista.push(n);
    else mapa.set(chave, [n]);
  }

  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
  }
  return mapa;
}

/**
 * Onde cada nó fica.
 *
 * Raiz à esquerda, filhos à direita, irmãos empilhados. O `y` de um pai é a
 * MÉDIA dos filhos — é isso que faz a árvore parecer organizada em vez de uma
 * lista indentada: o pai aponta para o meio do próprio galho.
 *
 * Garante que TODO nó aparece na saída, mesmo com ciclo nos dados (a é pai de
 * b, b é pai de a). Um ciclo deixaria os dois inalcançáveis a partir das
 * raízes, e eles simplesmente desapareceriam da tela sem erro nenhum.
 */
export function dispor(nos: readonly NoBasico[]): PosicaoDeNo[] {
  if (nos.length === 0) return [];

  const filhos = filhosPorPai(nos);
  const visitados = new Set<string>();
  const saida: PosicaoDeNo[] = [];
  let proximaFaixa = 0;

  /** Devolve o `y` do nó, para o pai poder se centrar. */
  function descer(no: NoBasico, profundidade: number): number {
    // Ciclo: para aqui. Sem esta guarda a recursão não termina.
    if (visitados.has(no.id)) return proximaFaixa * ESPACO_Y;
    visitados.add(no.id);

    const meus = filhos.get(no.id) ?? [];
    let y: number;

    if (meus.length === 0) {
      y = proximaFaixa * ESPACO_Y;
      proximaFaixa++;
    } else {
      const ys = meus.map(f => descer(f, profundidade + 1));
      y = (Math.min(...ys) + Math.max(...ys)) / 2;
    }

    saida.push({ id: no.id, x: profundidade * ESPACO_X, y, profundidade });
    return y;
  }

  for (const raiz of filhos.get('__raiz__') ?? []) descer(raiz, 0);

  // Sobrou alguém? Só acontece com ciclo. Entra como raiz para não desaparecer.
  for (const n of nos) {
    if (!visitados.has(n.id)) descer(n, 0);
  }

  // Na ordem dos dados, não na de visita: quem desenha espera estabilidade.
  const porId = new Map(saida.map(p => [p.id, p]));
  return nos.map(n => porId.get(n.id)!).filter(Boolean);
}

/**
 * O nó e tudo que pende dele.
 *
 * Apagar um nó apaga o galho: deixar os filhos órfãos os jogaria para a raiz,
 * e um galho inteiro reaparecendo solto no topo do mapa é pior que perdê-lo.
 */
export function subarvore(nos: readonly NoBasico[], id: string): string[] {
  const filhos = filhosPorPai(nos);
  const fora: string[] = [];
  const fila = [id];
  const vistos = new Set<string>();

  while (fila.length > 0) {
    const atual = fila.shift()!;
    if (vistos.has(atual)) continue;
    vistos.add(atual);
    fora.push(atual);
    for (const f of filhos.get(atual) ?? []) fila.push(f.id);
  }
  return fora;
}

/** A próxima `ordem` livre entre os filhos de um pai. */
export function proximaOrdem(nos: readonly NoBasico[], paiId?: string): number {
  const irmaos = nos.filter(n => (n.paiId ?? undefined) === (paiId ?? undefined));
  return irmaos.length === 0 ? 0 : Math.max(...irmaos.map(n => n.ordem)) + 1;
}

/** Tamanho da área desenhada, para o contêiner saber quanto rolar. */
export function tamanhoDoMapa(pos: readonly PosicaoDeNo[]): { largura: number; altura: number } {
  if (pos.length === 0) return { largura: 0, altura: 0 };
  return {
    largura: Math.max(...pos.map(p => p.x)) + ESPACO_X,
    altura: Math.max(...pos.map(p => p.y)) + ESPACO_Y,
  };
}
