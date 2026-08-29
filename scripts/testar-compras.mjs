import {
  faixaDePreco, totalDaLista, faixaExata, progressoGuardado, faltaGuardar,
} from '../src/lib/compras.ts';

/**
 * Testes das contas de dinheiro da aba Compras.
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

console.log('Faixa de preço:');
ok('sem tolerância, a faixa é o próprio preço',
  faixaDePreco(1200), { min: 1200, max: 1200 });
ok('com tolerância, abre para os dois lados',
  faixaDePreco(1200, 200), { min: 1000, max: 1400 });
ok('sem preço não há faixa (não é grátis, é desconhecido)',
  faixaDePreco(undefined, 200), null);
ok('preço zero também não', faixaDePreco(0), null);
ok('preço negativo não', faixaDePreco(-50), null);
ok('tolerância maior que o preço trava o mínimo em zero',
  faixaDePreco(100, 300), { min: 0, max: 400 });
ok('tolerância negativa vale pelo módulo',
  faixaDePreco(1200, -200), { min: 1000, max: 1400 });
ok('NaN no preço não vira faixa', faixaDePreco(NaN, 100), null);
ok('NaN na tolerância é ignorado',
  faixaDePreco(1200, NaN), { min: 1200, max: 1200 });

console.log('\nFaixa exata:');
ok('sem tolerância é exata', faixaExata(faixaDePreco(500)), true);
ok('com tolerância não é', faixaExata(faixaDePreco(500, 50)), false);

console.log('\nTotal da lista:');
{
  const itens = [
    { price: 1200, tolerancia: 200 },
    { price: 450, tolerancia: 50 },
    { price: 300 },
    { name: 'sem preço' },
  ];
  // min: 1000 + 400 + 300 · max: 1400 + 500 + 300
  ok('soma as faixas e ignora quem não tem preço',
    totalDaLista(itens), { min: 1700, max: 2200 });
  ok('lista vazia dá zero a zero', totalDaLista([]), { min: 0, max: 0 });
  ok('só itens sem preço dá zero a zero',
    totalDaLista([{}, { price: 0 }]), { min: 0, max: 0 });
  ok('sem nenhuma tolerância, o total é exato',
    faixaExata(totalDaLista([{ price: 10 }, { price: 20 }])), true);
}

console.log('\nProgresso do que foi guardado:');
ok('nada guardado', progressoGuardado(0, 1200), 0);
ok('metade', progressoGuardado(600, 1200), 0.5);
ok('completo', progressoGuardado(1200, 1200), 1);
ok('guardar a mais não passa de 1', progressoGuardado(5000, 1200), 1);
ok('sem preço devolve 0, não 1 — é falta de informação, não item pago',
  progressoGuardado(500, undefined), 0);
ok('preço zero não divide por zero', progressoGuardado(500, 0), 0);
ok('guardado negativo trava em 0', progressoGuardado(-100, 1200), 0);
ok('NaN não contamina', progressoGuardado(NaN, 1200), 0);

console.log('\nQuanto falta juntar:');
ok('do zero, falta tudo', faltaGuardar(0, 1200), 1200);
ok('parcial', faltaGuardar(456, 1200), 744);
ok('completo não falta nada', faltaGuardar(1200, 1200), 0);
ok('guardar a mais não vira crédito', faltaGuardar(2000, 1200), 0);
ok('sem preço não falta nada a juntar', faltaGuardar(100, undefined), 0);

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
