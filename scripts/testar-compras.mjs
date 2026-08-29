import {
  faixaDePreco, totalDaLista, faixaExata, progressoGuardado, faltaGuardar,
  porMes, recordes,
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

console.log('\nConquistas mês a mês:');
{
  const HOJE = '2026-08-15';
  const item = (name, mes, price, completed = true) =>
    ({ name, price, completed, completedAt: mes ? mes + 'T12:00:00.000Z' : undefined, createdAt: '2026-01-01T12:00:00.000Z' });

  const linha = porMes([
    item('a', '2026-08-02', 100),
    item('b', '2026-08-20', 200),
    item('c', '2026-06-10', 300),
    item('pendente', null, 999, false),
  ], HOJE, 4);

  ok('devolve exatamente a janela pedida', linha.length, 4);
  ok('termina no mês de hoje', linha[linha.length-1].mes, '2026-08');
  ok('começa no mês certo', linha[0].mes, '2026-05');
  ok('meses VAZIOS aparecem — pular faria as barras mentirem sobre o ritmo',
    linha.map(m => m.mes), ['2026-05','2026-06','2026-07','2026-08']);
  ok('agrupa por mês', linha.map(m => m.quantidade), [0, 1, 0, 2]);
  ok('soma o valor de cada mês', linha.map(m => m.valor), [0, 300, 0, 300]);
  ok('pendente não conta', porMes([item('p', null, 500, false)], HOJE, 3)
    .reduce((n,m)=>n+m.quantidade,0), 0);
  ok('conquista fora da janela fica de fora',
    porMes([item('velho', '2020-01-05', 100)], HOJE, 3).reduce((n,m)=>n+m.quantidade,0), 0);
  ok('sem data nenhuma não inventa mês',
    porMes([{ name:'x', price:10, completed:true }], HOJE, 3).reduce((n,m)=>n+m.quantidade,0), 0);
  ok('vira o ano para trás', porMes([], '2026-02-10', 4).map(m=>m.mes),
    ['2025-11','2025-12','2026-01','2026-02']);
  ok('lista vazia devolve a janela zerada',
    porMes([], HOJE, 3).map(m=>m.quantidade), [0,0,0]);
}

console.log('\nRecordes:');
{
  const HOJE = '2026-08-15';
  const itens = [
    { name:'Câmera', price:2300, completed:true, completedAt:'2026-07-01T12:00:00.000Z', createdAt:'2026-01-01T12:00:00.000Z' },
    { name:'Fone', price:300, completed:true, completedAt:'2026-07-20T12:00:00.000Z', createdAt:'2026-01-01T12:00:00.000Z' },
    { name:'Teclado', price:450, completed:true, completedAt:'2026-05-02T12:00:00.000Z', createdAt:'2026-01-01T12:00:00.000Z' },
    { name:'Cadeira', price:1200, completed:false, createdAt:'2026-06-16T12:00:00.000Z' },
    { name:'Tênis', price:450, completed:false, createdAt:'2026-08-10T12:00:00.000Z' },
  ];
  const r = recordes(itens, HOJE);
  ok('o mais caro CONQUISTADO', r.maisCaro, { nome:'Câmera', valor:2300 });
  ok('pendente caro não conta como recorde',
    recordes([{ name:'caro', price:9999, completed:false, createdAt:'2026-01-01T12:00:00.000Z' }], HOJE).maisCaro, null);
  ok('o mês de mais conquistas', r.melhorMes, { mes:'2026-07', quantidade:2 });
  ok('quem espera há mais tempo', r.esperaMaisLonga, { nome:'Cadeira', dias:60 });

  const vazio = recordes([], HOJE);
  ok('lista vazia não inventa recorde',
    [vazio.maisCaro, vazio.melhorMes, vazio.esperaMaisLonga], [null, null, null]);
  ok('conquistado sem preço não vira "mais caro"',
    recordes([{ name:'x', completed:true, completedAt:'2026-07-01T12:00:00.000Z' }], HOJE).maisCaro, null);
  ok('mas ainda conta para o mês',
    recordes([{ name:'x', completed:true, completedAt:'2026-07-01T12:00:00.000Z' }], HOJE).melhorMes,
    { mes:'2026-07', quantidade:1 });
  ok('item criado hoje espera zero dias',
    recordes([{ name:'novo', completed:false, createdAt:'2026-08-15T12:00:00.000Z' }], HOJE).esperaMaisLonga,
    { nome:'novo', dias:0 });
  ok('data futura não vira espera negativa',
    recordes([{ name:'futuro', completed:false, createdAt:'2027-01-01T12:00:00.000Z' }], HOJE).esperaMaisLonga,
    { nome:'futuro', dias:0 });
}

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
