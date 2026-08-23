import { mesclar } from '../src/lib/mesclar.ts';

/**
 * Teste da mesclagem da sincronização.
 *
 * O projeto não tem framework de teste, e esta é a única lógica do app em
 * que um erro APAGA dado do usuário em silêncio — merece verificação de
 * verdade, não inspeção visual.
 *
 * Roda sem bundler: o Node 23+ remove os tipos do `.ts` sozinho, e
 * `mesclar.ts` foi mantido sem nenhum import justamente para isso.
 *
 * Rodar com: npm run testar
 */

let falhas = 0;

function verificar(nome, real, esperado) {
  const bate = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bate) falhas++;
  console.log((bate ? '  ok    ' : '  FALHA ') + nome);
  if (!bate) {
    console.log('          obtido:   ' + JSON.stringify(real));
    console.log('          esperado: ' + JSON.stringify(esperado));
  }
}

console.log('Mesclagem por registro:');
verificar('registros distintos se somam',
  mesclar([{ id: 'a' }], [{ id: 'b' }], true), [{ id: 'a' }, { id: 'b' }]);
verificar('id repetido: remoto mais novo vence',
  mesclar([{ id: 'a', v: 1 }], [{ id: 'a', v: 2 }], true), [{ id: 'a', v: 2 }]);
verificar('id repetido: local mais novo vence',
  mesclar([{ id: 'a', v: 1 }], [{ id: 'a', v: 2 }], false), [{ id: 'a', v: 1 }]);

console.log('\nO caso que motivou o desenho:');
verificar('celular e PC criaram registros diferentes — nada some',
  mesclar([{ id: 'pc' }, { id: 'comum' }], [{ id: 'cel' }, { id: 'comum' }], true).length, 3);

console.log('\nBordas perigosas:');
verificar('remoto vazio NÃO apaga o local',
  mesclar([{ id: 'a' }], [], true), [{ id: 'a' }]);
verificar('local vazio recebe o remoto',
  mesclar([], [{ id: 'a' }], true), [{ id: 'a' }]);
verificar('registro sem id não vira lista mesclada',
  mesclar([{ x: 1 }], [{ x: 2 }], true), [{ x: 2 }]);

console.log('\nDocumentos que não são lista com id:');
verificar('lista de ids soltos se une sem duplicar',
  mesclar(['x'], ['y', 'x'], true), ['y', 'x']);
verificar('objeto: remoto mais novo vence',
  mesclar({ a: 1 }, { a: 2 }, true), { a: 2 });
verificar('objeto: local mais novo vence',
  mesclar({ a: 1 }, { a: 2 }, false), { a: 1 });

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
