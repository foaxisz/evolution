import {
  dispor, subarvore, proximaOrdem, tamanhoDoMapa, ESPACO_X, ESPACO_Y,
} from '../src/lib/quadros.ts';

/**
 * Testes da disposição do mapa mental.
 *
 * Árvore torta e nó sobreposto são erros que a TELA ESCONDE: quem olha vê
 * "um mapa" e não percebe que dois nós estão no mesmo lugar, ou que um galho
 * inteiro desapareceu por causa de uma referência quebrada.
 *
 * Rodar com: npm run testar
 */

let falhas = 0;

function ok(nome, real, esperado) {
  const bate = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bate) falhas++;
  console.log((bate ? '  ok    ' : '  FALHA ') + nome);
  if (!bate) {
    console.log('          obtido:   ' + JSON.stringify(real));
    console.log('          esperado: ' + JSON.stringify(esperado));
  }
}

const no = (id, paiId, ordem = 0) => ({ id, paiId, ordem });
const pos = nos => Object.fromEntries(dispor(nos).map(p => [p.id, { x: p.x, y: p.y }]));

console.log('Casos mínimos:');
ok('lista vazia', dispor([]), []);
ok('um nó só fica na origem', pos([no('a')]), { a: { x: 0, y: 0 } });
ok('duas raízes empilham',
  pos([no('a', undefined, 0), no('b', undefined, 1)]),
  { a: { x: 0, y: 0 }, b: { x: 0, y: ESPACO_Y } });

console.log('\nProfundidade vira coluna:');
{
  const arvore = [no('r'), no('f', 'r'), no('n', 'f')];
  const p = dispor(arvore);
  ok('cada geração uma coluna', p.map(x => x.x), [0, ESPACO_X, ESPACO_X * 2]);
  ok('e a profundidade acompanha', p.map(x => x.profundidade), [0, 1, 2]);
}

console.log('\nO pai se centra nos filhos:');
{
  const p = pos([no('r'), no('f1', 'r', 0), no('f2', 'r', 1)]);
  ok('dois filhos empilhados', [p.f1.y, p.f2.y], [0, ESPACO_Y]);
  ok('>>> o pai fica no MEIO deles', p.r.y, ESPACO_Y / 2);
}
{
  const p = pos([no('r'), no('a', 'r', 0), no('b', 'r', 1), no('c', 'r', 2)]);
  ok('com três filhos, o pai fica no do meio', p.r.y, p.b.y);
}

console.log('\nNenhum nó sobrepõe outro:');
{
  const arvore = [
    no('r'),
    no('a', 'r', 0), no('a1', 'a', 0), no('a2', 'a', 1),
    no('b', 'r', 1), no('b1', 'b', 0),
  ];
  const p = dispor(arvore);
  const chaves = p.map(x => `${x.x},${x.y}`);
  ok('cada nó num lugar só', new Set(chaves).size, chaves.length);
  // As folhas ocupam faixas consecutivas: a1, a2, b1.
  ok('folhas em faixas consecutivas',
    ['a1', 'a2', 'b1'].map(id => p.find(x => x.id === id).y),
    [0, ESPACO_Y, ESPACO_Y * 2]);
}

console.log('\nOrdem entre irmãos:');
ok('a `ordem` manda, não a ordem da lista', (() => {
  const p = pos([no('r'), no('z', 'r', 0), no('a', 'r', 1)]);
  return p.z.y < p.a.y;
})(), true);
ok('ordem repetida não quebra (desempata pelo id)',
  dispor([no('r'), no('x', 'r', 0), no('y', 'r', 0)]).length, 3);

console.log('\n>>> Dados estragados não podem sumir com nós:');
ok('órfão (pai inexistente) vira raiz em vez de desaparecer',
  dispor([no('a'), no('orfao', 'fantasma')]).length, 2);
ok('e fica na coluna da raiz',
  pos([no('a'), no('orfao', 'fantasma')]).orfao.x, 0);
// Distingue o tratamento EXPLÍCITO de órfão da rede de segurança do ciclo:
// tratado como raiz, ele entra na ordem certa entre as raízes; só pela rede,
// cairia no fim, depois de todas elas.
ok('órfão entra na ORDEM dele entre as raízes, não no fim',
  pos([no('r1', undefined, 0), no('orfao', 'fantasma', 1), no('r2', undefined, 2)]).orfao.y,
  ESPACO_Y);
ok('CICLO não trava e os dois aparecem',
  dispor([{ id: 'a', paiId: 'b', ordem: 0 }, { id: 'b', paiId: 'a', ordem: 0 }]).length, 2);
ok('ciclo mais longo também', dispor([
  { id: 'a', paiId: 'c', ordem: 0 },
  { id: 'b', paiId: 'a', ordem: 0 },
  { id: 'c', paiId: 'b', ordem: 0 },
]).length, 3);
ok('TODO nó da entrada sai na saída, sempre', (() => {
  const bagunca = [
    no('r'), no('f', 'r'), no('orfao', 'nao-existe'),
    { id: 'c1', paiId: 'c2', ordem: 0 }, { id: 'c2', paiId: 'c1', ordem: 0 },
  ];
  return dispor(bagunca).map(p => p.id).sort();
})(), ['c1', 'c2', 'f', 'orfao', 'r']);
ok('a saída mantém a ordem da entrada', (() => {
  const arvore = [no('r'), no('f1', 'r', 0), no('f2', 'r', 1)];
  return dispor(arvore).map(p => p.id);
})(), ['r', 'f1', 'f2']);

console.log('\nSubárvore (o que apagar junto):');
{
  const arvore = [
    no('r'),
    no('a', 'r', 0), no('a1', 'a', 0), no('a11', 'a1', 0),
    no('b', 'r', 1),
  ];
  ok('folha é só ela', subarvore(arvore, 'a11'), ['a11']);
  ok('galho leva os descendentes todos', subarvore(arvore, 'a').sort(), ['a', 'a1', 'a11']);
  ok('não leva o irmão', subarvore(arvore, 'a').includes('b'), false);
  ok('a raiz leva tudo', subarvore(arvore, 'r').length, 5);
  ok('id inexistente devolve só ele', subarvore(arvore, 'zzz'), ['zzz']);
  ok('ciclo não trava a subárvore',
    subarvore([{ id: 'a', paiId: 'b', ordem: 0 }, { id: 'b', paiId: 'a', ordem: 0 }], 'a').length, 2);
}

console.log('\nPróxima ordem:');
ok('primeiro filho', proximaOrdem([], undefined), 0);
ok('depois de duas raízes', proximaOrdem([no('a', undefined, 0), no('b', undefined, 1)]), 2);
ok('conta só os irmãos do mesmo pai',
  proximaOrdem([no('a'), no('f1', 'a', 0), no('f2', 'a', 5)], 'a'), 6);
ok('pai sem filhos começa em zero', proximaOrdem([no('a')], 'a'), 0);

console.log('\nTamanho do mapa:');
ok('vazio não tem tamanho', tamanhoDoMapa([]), { largura: 0, altura: 0 });
ok('um nó já ocupa uma célula',
  tamanhoDoMapa(dispor([no('a')])), { largura: ESPACO_X, altura: ESPACO_Y });
ok('cresce com a árvore', (() => {
  const t = tamanhoDoMapa(dispor([no('r'), no('f', 'r'), no('n', 'f')]));
  return t.largura;
})(), ESPACO_X * 3);

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
