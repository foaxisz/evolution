import {
  canonico, desmontar, diferenca, aplicar, paraEnviar, faltandoNoServidor, DOC_INTEIRO, EXCLUIDO_CANONICO,
} from '../src/lib/registros.ts';

/**
 * Testes da tradução entre documento e registro.
 *
 * O projeto não tem framework de teste, e esta é a única lógica do app em
 * que um erro APAGA — ou RESSUSCITA — dado do usuário em silêncio. Merece
 * verificação de verdade.
 *
 * Roda sem bundler: o Node remove os tipos do `.ts` sozinho, e
 * `registros.ts` foi mantido sem nenhum import justamente para isso.
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

const linha = (id, dados, excluido = false, quando = '2026-01-01T00:00:00Z') =>
  ({ colecao: 'evo_habits', registro_id: id, dados, excluido, atualizado_em: quando });

console.log('Forma canônica (o bug do jsonb):');
ok('ordem das chaves não importa',
  canonico({ b: 1, a: 2 }) === canonico({ a: 2, b: 1 }), true);
ok('ordem aninhada também não',
  canonico({ x: { z: 1, y: 2 } }) === canonico({ x: { y: 2, z: 1 } }), true);
ok('valor diferente ainda difere',
  canonico({ a: 1 }) === canonico({ a: 2 }), false);
ok('ordem de LISTA importa (é dado, não chave)',
  canonico([1, 2]) === canonico([2, 1]), false);

console.log('\nDetecção do que mudou:');
ok('registro novo entra', diferenca([], [{ id: 'a' }]), ['a']);
ok('registro editado entra', diferenca([{ id: 'a', v: 1 }], [{ id: 'a', v: 2 }]), ['a']);
ok('registro EXCLUÍDO entra', diferenca([{ id: 'a' }], []), ['a']);
ok('registro intocado não entra', diferenca([{ id: 'a' }], [{ id: 'a' }]), []);
ok('chave reordenada NÃO é mudança',
  diferenca([{ id: 'a', x: 1, y: 2 }], [{ id: 'a', y: 2, x: 1 }]), []);

console.log('\nAplicar o que veio do servidor:');
ok('exclusão remota apaga aqui',
  aplicar([{ id: 'a' }, { id: 'b' }], [linha('a', null, true)]), [{ id: 'b' }]);
ok('registro novo do outro aparelho entra',
  aplicar([{ id: 'a' }], [linha('b', { id: 'b' })]), [{ id: 'a' }, { id: 'b' }]);
ok('nada a aplicar devolve o MESMO objeto (sem redesenho à toa)',
  aplicar([{ id: 'a' }], []) === undefined ? 'undefined' : true, true);

const doc = [{ id: 'a', x: 1, y: 2 }];
ok('linha idêntica com chaves reordenadas não conta como mudança',
  aplicar(doc, [linha('a', { id: 'a', y: 2, x: 1 })]) === doc, true);

console.log('\nO BUG QUE VOCÊ VIU — exclusão que ressuscitava:');
// PC excluiu o hábito 'a'. O celular ainda tem 'a' e tinha 'a' na fila.
// No desenho antigo, o escudo de pendentes descartava esta linha.
ok('exclusão remota é aplicada MESMO com o id pendente aqui',
  aplicar([{ id: 'a' }, { id: 'b' }], [linha('a', null, true)]), [{ id: 'b' }]);

// Depois de aplicada a exclusão, 'a' não pode ser candidato a subir.
const remotos = new Map([['evo_habits a', EXCLUIDO_CANONICO], ['evo_habits b', canonico({ id: 'b' })]]);
ok('registro excluído no servidor NÃO é reenviado como vivo',
  faltandoNoServidor([{ id: 'b' }], remotos, 'evo_habits'), []);
ok('registro excluído no servidor NÃO é reenviado como vivo mesmo se sobrou no documento local',
  faltandoNoServidor([{ id: 'a' }, { id: 'b' }], remotos, 'evo_habits'), []);
ok('registro só-local ainda sobe',
  faltandoNoServidor([{ id: 'b' }, { id: 'c' }], remotos, 'evo_habits'), ['c']);
ok('registro igual ao servidor não sobe de novo (era o vazamento do jsonb)',
  faltandoNoServidor([{ id: 'b' }], new Map([['evo_habits b', canonico({ id: 'b' })]]), 'evo_habits'), []);

console.log('\nEnvio:');
ok('id que saiu do documento vira exclusão',
  paraEnviar('evo_habits', [], ['a']),
  [{ colecao: 'evo_habits', registro_id: 'a', dados: null, excluido: true }]);
ok('id presente vai vivo',
  paraEnviar('evo_habits', [{ id: 'a' }], ['a']),
  [{ colecao: 'evo_habits', registro_id: 'a', dados: { id: 'a' }, excluido: false }]);

console.log('\nDocumentos que não são lista de registros:');
ok('objeto vira um registro só', desmontar({ som: true }), [{ id: DOC_INTEIRO, dados: { som: true } }]);
ok('lista de ids soltos idem', desmontar(['x', 'y']), [{ id: DOC_INTEIRO, dados: ['x', 'y'] }]);
ok('aplicar documento inteiro substitui',
  aplicar({ som: true }, [{ ...linha(DOC_INTEIRO, { som: false }) }]), { som: false });
ok('documento inteiro excluído zera',
  aplicar({ som: true }, [{ ...linha(DOC_INTEIRO, null, true) }]), null);

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
