import {
  rotuloDeVencimento, somarDias, diferencaEmDias, paraISO, gradeDeSeisSemanas,
  somarMeses, ordenarTarefas, reordenar, mudaramDeOrdem, corDaPrioridade, PRIORIDADES,
} from '../src/lib/tarefas.ts';

/**
 * Testes de vencimento, prioridade e ordem.
 *
 * Aritmética de data e reordenação erram por um dia ou por uma posição —
 * invisível na tela, óbvio aqui.
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

const HOJE = '2026-08-25'; // uma terça-feira

console.log('Rótulo do selo de vencimento:');
ok('hoje', rotuloDeVencimento('2026-08-25', HOJE), { texto: 'Hoje', atrasado: false });
ok('amanhã', rotuloDeVencimento('2026-08-26', HOJE), { texto: 'Amanhã', atrasado: false });
ok('ontem é atrasado', rotuloDeVencimento('2026-08-24', HOJE), { texto: 'Ontem', atrasado: true });
ok('daqui a 2 dias vira dia da semana',
  rotuloDeVencimento('2026-08-27', HOJE), { texto: 'qui', atrasado: false });
ok('daqui a 6 dias ainda é dia da semana',
  rotuloDeVencimento('2026-08-31', HOJE), { texto: 'seg', atrasado: false });
ok('daqui a 7 dias vira data',
  rotuloDeVencimento('2026-09-01', HOJE), { texto: '1 set', atrasado: false });
ok('semana que vem (o atalho do menu, +7)',
  rotuloDeVencimento(somarDias(HOJE, 7), HOJE), { texto: '1 set', atrasado: false });
ok('atrasado há muito mostra a data, em vermelho',
  rotuloDeVencimento('2026-07-10', HOJE), { texto: '10 jul', atrasado: true });
ok('ano diferente leva o ano, senão pareceria atrasado',
  rotuloDeVencimento('2027-02-03', HOJE), { texto: '3 fev 2027', atrasado: false });

console.log('\nAritmética de data (o bug clássico é o fuso):');
ok('somar dias atravessa o mês', somarDias('2026-08-31', 1), '2026-09-01');
ok('somar dias atravessa o ano', somarDias('2026-12-31', 1), '2027-01-01');
ok('ano bissexto existe', somarDias('2028-02-28', 1), '2028-02-29');
ok('e 2026 não é bissexto', somarDias('2026-02-28', 1), '2026-03-01');
ok('diferença simétrica', diferencaEmDias('2026-08-25', '2026-09-01'), 7);
ok('diferença negativa quando passou', diferencaEmDias('2026-08-25', '2026-08-20'), -5);
ok('horário de verão não muda a contagem',
  diferencaEmDias('2026-10-15', '2026-11-15'), 31);
ok('paraISO não escorrega de dia', paraISO(new Date(2026, 7, 25)), '2026-08-25');

console.log('\nGrade do calendário:');
{
  const g = gradeDeSeisSemanas('2026-08');
  ok('sempre 42 casas', g.length, 42);
  ok('começa no domingo anterior ao dia 1', g[0], '2026-07-26');
  ok('contém o dia 1', g.includes('2026-08-01'), true);
  ok('contém o último dia do mês', g.includes('2026-08-31'), true);
  ok('sem casa repetida', new Set(g).size, 42);
  ok('dias em sequência', g.every((d, i) => i === 0 || somarDias(g[i - 1], 1) === d), true);

  // Fevereiro de 28 dias começando no domingo: o mês cabe em 4 linhas, e a
  // grade tem de continuar com 42 casas para a caixa não mudar de altura.
  ok('mês curto também dá 42', gradeDeSeisSemanas('2026-02').length, 42);
  ok('virar o mês para trás', somarMeses('2026-01', -1), '2025-12');
  ok('virar o mês para frente', somarMeses('2026-12', 1), '2027-01');
}

console.log('\nOrdenação:');
{
  const t = (id, ordem, createdAt) => ({ id, ordem, createdAt });
  ok('ordem manda',
    ordenarTarefas([t('c', 2, '1'), t('a', 0, '2'), t('b', 1, '3')]).map(x => x.id),
    ['a', 'b', 'c']);
  ok('sem ordem, vale createdAt',
    ordenarTarefas([t('b', undefined, '2026-02'), t('a', undefined, '2026-01')]).map(x => x.id),
    ['a', 'b']);
  ok('quem não tem ordem afunda (tarefa nova nasce no fim)',
    ordenarTarefas([t('nova', undefined, '2026-09'), t('velha', 5, '2026-01')]).map(x => x.id),
    ['velha', 'nova']);
  ok('não muda o array recebido', (() => {
    const orig = [t('b', 1, '1'), t('a', 0, '2')];
    ordenarTarefas(orig);
    return orig.map(x => x.id);
  })(), ['b', 'a']);
}

console.log('\nReordenar por arrasto:');
{
  const lista = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, ordem: i, createdAt: '2026-01' }));

  ok('arrastar o primeiro para o fim',
    reordenar(lista, 'a', 'd').map(x => x.id), ['b', 'c', 'd', 'a']);
  ok('arrastar o último para o começo',
    reordenar(lista, 'd', 'a').map(x => x.id), ['d', 'a', 'b', 'c']);
  ok('arrastar para o vizinho de baixo',
    reordenar(lista, 'b', 'c').map(x => x.id), ['a', 'c', 'b', 'd']);
  ok('a ordem renumerada é 0..n-1',
    reordenar(lista, 'a', 'd').map(x => x.ordem), [0, 1, 2, 3]);

  ok('soltar em si mesma devolve o MESMO array',
    reordenar(lista, 'b', 'b') === lista, true);
  ok('id inexistente devolve o MESMO array',
    reordenar(lista, 'zzz', 'a') === lista, true);

  // 'c' vai para o lugar de 'd', então a lista fica a,b,d,c: as duas
  // trocaram de posição, e vêm na ordem NOVA.
  ok('só as que mudaram de posição precisam gravar',
    mudaramDeOrdem(lista, reordenar(lista, 'c', 'd')).map(x => x.id), ['d', 'c']);
  ok('arrastar o primeiro para o fim mexe em todas',
    mudaramDeOrdem(lista, reordenar(lista, 'a', 'd')).length, 4);

  // Lista que nunca foi reordenada: ninguém tem `ordem` ainda.
  const virgem = ['x', 'y', 'z'].map((id, i) => ({ id, createdAt: `2026-0${i + 1}` }));
  const depois = reordenar(ordenarTarefas(virgem), 'z', 'x');
  ok('primeira reordenação atribui ordem a todas',
    depois.map(t => t.ordem), [0, 1, 2]);
  ok('e na ordem certa', depois.map(t => t.id), ['z', 'x', 'y']);
}

console.log('\nPrioridade:');
ok('três níveis, nunca quatro', PRIORIDADES.length, 3);
ok('cinza é a ausência, não um nível', corDaPrioridade(undefined), null);
ok('alta é a cor de perigo do app', corDaPrioridade(3), 'var(--color-danger)');
ok('todas as cores vêm de variáveis já existentes',
  PRIORIDADES.every(p => p.cor.startsWith('var(--color-')), true);

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
