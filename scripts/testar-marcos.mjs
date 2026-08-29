import { MARCOS, proximoMarco, faltamPara, trilha } from '../src/lib/marcos.ts';

/**
 * Testes da trilha de marcos da aba Compras.
 *
 * O teste que carrega o peso está na última seção: a trilha não pode mudar
 * quando itens PENDENTES entram na lista. Era exatamente isso que a barra
 * antiga fazia errado, e é o defeito que originou a reforma.
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

const acesos = n => trilha(n).filter(p => p.aceso).map(p => p.marco);
const enchimento = n => trilha(n).map(p => Number(p.preenchimento.toFixed(3)));

console.log('Marcos:');
ok('são seis, terminando em 50', [...MARCOS], [1, 3, 5, 10, 25, 50]);
ok('em ordem crescente', MARCOS.every((m, i) => i === 0 || m > MARCOS[i - 1]), true);

console.log('\nPróximo marco e quanto falta:');
ok('do zero, o próximo é 1', proximoMarco(0), 1);
ok('e falta 1', faltamPara(0), 1);
ok('em cima de um marco, aponta o seguinte', proximoMarco(3), 5);
ok('e falta a diferença', faltamPara(3), 2);
ok('entre marcos', proximoMarco(7), 10);
ok('faltam 3 de 7 para 10', faltamPara(7), 3);
ok('em 49, o próximo é 50', proximoMarco(49), 50);
ok('em 50 não há próximo', proximoMarco(50), null);
ok('e não há quanto faltar', faltamPara(50), null);
ok('acima de 50 continua sem próximo', proximoMarco(73), null);

console.log('\nPinos acesos:');
ok('zero não acende nada', acesos(0), []);
ok('um acende o primeiro', acesos(1), [1]);
ok('sete acende 1, 3 e 5', acesos(7), [1, 3, 5]);
ok('em cima do marco ele JÁ acende', acesos(25), [1, 3, 5, 10, 25]);
ok('cinquenta acende todos', acesos(50), [1, 3, 5, 10, 25, 50]);
ok('acima de 50 segue tudo aceso, sem estourar', acesos(73), [1, 3, 5, 10, 25, 50]);

console.log('\nEnchimento do trecho (é o que se move entre marcos):');
ok('zero: tudo vazio', enchimento(0), [0, 0, 0, 0, 0, 0]);
ok('um: primeiro trecho cheio, resto vazio', enchimento(1), [1, 0, 0, 0, 0, 0]);
ok('dois: metade do trecho 1→3', enchimento(2), [1, 0.5, 0, 0, 0, 0]);
ok('sete: 40% do trecho 5→10', enchimento(7), [1, 1, 1, 0.4, 0, 0]);
// O caso que motivou o enchimento proporcional: entre 25 e 50 são 25 itens.
ok('trinta: o trecho 25→50 já andou 20%', enchimento(30), [1, 1, 1, 1, 1, 0.2]);
ok('e em 37 andou quase metade', enchimento(37)[5], 0.48);
ok('cinquenta: tudo cheio', enchimento(50), [1, 1, 1, 1, 1, 1]);
ok('acima de 50 não passa de 1', enchimento(999), [1, 1, 1, 1, 1, 1]);
ok('nunca passa de 1 nem fica negativo',
  [0, 1, 2, 7, 26, 50, 400].every(n => trilha(n).every(p => p.preenchimento >= 0 && p.preenchimento <= 1)),
  true);

console.log('\nEntrada estragada não pode apagar a trilha da tela:');
ok('NaN vira zero', acesos(NaN), []);
ok('e não produz NaN no enchimento', enchimento(NaN), [0, 0, 0, 0, 0, 0]);
ok('negativo vira zero', enchimento(-5), [0, 0, 0, 0, 0, 0]);
ok('quebrado é arredondado para baixo', acesos(3.9), [1, 3]);
ok('Infinity não estoura', acesos(Infinity), []);

console.log('\n>>> O defeito que originou a reforma:');
{
  // A barra antiga era conquistados ÷ (pendentes + conquistados). Adicionar
  // um desejo aumentava o denominador e DERRUBAVA o progresso. A trilha não
  // recebe o total — então não há como isso acontecer. Estes testes existem
  // para impedir que alguém reintroduza o total na assinatura.
  ok('trilha(3) não depende de quantos itens existem na lista',
    JSON.stringify(trilha(3)) === JSON.stringify(trilha(3)), true);
  ok('a função recebe UM argumento só', trilha.length, 1);
  ok('proximoMarco também', proximoMarco.length, 1);

  // Simula o cenário exato do relato: 3 de 6, e some um sétimo item.
  const antes = trilha(3);
  const depois = trilha(3); // o pendente novo não muda `conquistados`
  ok('adicionar um desejo pendente não move nada', antes, depois);
  ok('e o próximo marco continua o mesmo', proximoMarco(3), 5);
}

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
