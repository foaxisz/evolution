import { sequencia, agruparPorDia, somarDias, temNoDia } from '../src/lib/historias.ts';

/**
 * Testes da aba Histórias.
 *
 * A sequência de dias seguidos é o tipo de conta que erra por UM dia em
 * virada de mês, ano bissexto e fuso — e um dia a mais ou a menos na tela
 * ninguém nota.
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

const h = (...datas) => datas.map((data, i) => ({ id: 'h' + i, data, texto: 'x' }));
const HOJE = '2026-08-30';

console.log('Aritmética de data:');
ok('soma atravessa o mês', somarDias('2026-08-31', 1), '2026-09-01');
ok('recua atravessa o mês', somarDias('2026-09-01', -1), '2026-08-31');
ok('recua atravessa o ano', somarDias('2027-01-01', -1), '2026-12-31');
ok('ano bissexto existe', somarDias('2028-03-01', -1), '2028-02-29');
ok('e 2026 não é bissexto', somarDias('2026-03-01', -1), '2026-02-28');

console.log('\nSequência de dias seguidos:');
ok('sem nenhuma história', sequencia([], HOJE), 0);
ok('só hoje', sequencia(h(HOJE), HOJE), 1);
ok('hoje e ontem', sequencia(h(HOJE, '2026-08-29'), HOJE), 2);
ok('três seguidos', sequencia(h(HOJE, '2026-08-29', '2026-08-28'), HOJE), 3);
ok('buraco no meio corta a contagem',
  sequencia(h(HOJE, '2026-08-29', '2026-08-27'), HOJE), 2);
ok('duas no MESMO dia contam um dia só',
  sequencia(h(HOJE, HOJE, HOJE), HOJE), 1);
ok('a ordem da lista não importa',
  sequencia(h('2026-08-28', HOJE, '2026-08-29'), HOJE), 3);

console.log('\n>>> A regra do "ainda não escrevi hoje":');
ok('sem hoje, conta a partir de ONTEM — a prática é de escrever à noite',
  sequencia(h('2026-08-29', '2026-08-28'), HOJE), 2);
ok('só ontem já é sequência de 1', sequencia(h('2026-08-29'), HOJE), 1);
ok('nem hoje nem ontem: a sequência quebrou mesmo',
  sequencia(h('2026-08-28', '2026-08-27'), HOJE), 0);
ok('escrever hoje continua a sequência de ontem, não recomeça',
  sequencia(h(HOJE, '2026-08-29', '2026-08-28'), HOJE), 3);
ok('história do futuro não inventa sequência',
  sequencia(h('2026-09-05'), HOJE), 0);

console.log('\nSequência atravessando fronteiras:');
ok('virada de mês', sequencia(h('2026-09-01', '2026-08-31', '2026-08-30'), '2026-09-01'), 3);
ok('virada de ano', sequencia(h('2027-01-01', '2026-12-31', '2026-12-30'), '2027-01-01'), 3);
ok('29 de fevereiro bissexto',
  sequencia(h('2028-03-01', '2028-02-29', '2028-02-28'), '2028-03-01'), 3);

console.log('\nAgrupamento por dia:');
{
  const lista = [
    { id: 'a', data: '2026-08-28', texto: 'primeira do dia 28' },
    { id: 'b', data: '2026-08-30', texto: 'do dia 30' },
    { id: 'c', data: '2026-08-28', texto: 'segunda do dia 28' },
  ];
  const g = agruparPorDia(lista);
  ok('um grupo por dia', g.length, 2);
  ok('mais novo primeiro', g.map(x => x.dia), ['2026-08-30', '2026-08-28']);
  ok('junta as do mesmo dia', g[1].itens.length, 2);
  ok('dentro do dia, mantém a ordem de chegada',
    g[1].itens.map(i => i.id), ['a', 'c']);
  ok('lista vazia não vira grupo', agruparPorDia([]), []);
}

console.log('\nTem entrada no dia:');
ok('hoje ainda vazio', temNoDia(h('2026-08-29'), HOJE), false);
ok('hoje preenchido', temNoDia(h(HOJE), HOJE), true);

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
