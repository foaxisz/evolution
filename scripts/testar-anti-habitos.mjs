import { diasLimpos } from '../src/lib/antiHabitos.ts';

/**
 * Testes da contagem de dias limpos.
 *
 * O erro caro aqui é silencioso: um número que zera sozinho de manhã, ou
 * que conta dias anteriores à criação, parece plausível na tela e faz a
 * pessoa desistir de uma sequência que na verdade está de pé.
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

const HOJE = '2026-09-13';
const NASCIMENTO = '2026-01-01T10:00:00.000Z';
const marca = (...dias) => dias.map(d => ({ habitId: 'a', date: d, completed: true }));
const conta = (logs, criadoEm = NASCIMENTO) => diasLimpos(logs, 'a', criadoEm, HOJE);

console.log('O básico:');
ok('nunca marcado', conta([]), 0);
ok('só hoje', conta(marca('2026-09-13')), 1);
ok('hoje e ontem', conta(marca('2026-09-13', '2026-09-12')), 2);
ok('cinco dias seguidos até hoje',
  conta(marca('2026-09-13', '2026-09-12', '2026-09-11', '2026-09-10', '2026-09-09')), 5);

console.log('\nHoje em branco NÃO zera — o dia não acabou:');
ok('ontem marcado, hoje ainda não', conta(marca('2026-09-12')), 1);
ok('três dias até ontem, hoje ainda não',
  conta(marca('2026-09-12', '2026-09-11', '2026-09-10')), 3);

console.log('\nBuraco para a conta:');
ok('caiu anteontem', conta(marca('2026-09-13', '2026-09-12', '2026-09-10')), 2);
ok('caiu ontem, marcou hoje', conta(marca('2026-09-13', '2026-09-11')), 1);
ok('caiu ontem e hoje em branco', conta(marca('2026-09-11', '2026-09-10')), 0);

console.log('\nNão conta antes de existir:');
ok('criado há 3 dias, marcado desde antes',
  conta(marca('2026-09-13', '2026-09-12', '2026-09-11', '2026-09-10', '2026-09-09'),
    '2026-09-11T08:00:00.000Z'),
  3);
ok('criado hoje e marcado hoje', conta(marca('2026-09-13'), '2026-09-13T08:00:00.000Z'), 1);

console.log('\nDetalhes que mordem:');
ok('marca de outro hábito não conta',
  diasLimpos([{ habitId: 'outro', date: '2026-09-13', completed: true }], 'a', NASCIMENTO, HOJE), 0);
ok('registro não completo não conta',
  diasLimpos([{ habitId: 'a', date: '2026-09-13', completed: false }], 'a', NASCIMENTO, HOJE), 0);
ok('dia futuro não entra na conta',
  conta(marca('2026-09-14', '2026-09-12')), 1);
ok('atravessa a virada do mês',
  conta([...marca('2026-09-13'), ...marca('2026-09-12'), ...marca('2026-09-11')].concat(
    marca('2026-09-10', '2026-09-09', '2026-09-08', '2026-09-07', '2026-09-06',
      '2026-09-05', '2026-09-04', '2026-09-03', '2026-09-02', '2026-09-01',
      '2026-08-31', '2026-08-30'))),
  15);

console.log('\nConsertar um dia esquecido restaura a sequência:');
{
  const comBuraco = marca('2026-09-13', '2026-09-12', '2026-09-10', '2026-09-09');
  ok('antes de consertar', conta(comBuraco), 2);
  ok('depois de marcar o dia 11', conta([...comBuraco, ...marca('2026-09-11')]), 5);
}

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
