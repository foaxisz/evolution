import { desmontar, diferenca, aplicar, paraEnviar, DOC_INTEIRO } from '../src/lib/registros.ts';

/**
 * Teste da sincronização.
 *
 * O projeto não tem framework de teste, e esta é a única lógica do app em
 * que um erro APAGA dado do usuário em silêncio — merece verificação de
 * verdade, não inspeção visual.
 *
 * Roda sem bundler: o Node 23+ remove os tipos do `.ts` sozinho, e
 * `registros.ts` foi mantido sem nenhum import justamente para isso.
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

const linha = (id, dados, excluido = false) => ({
  colecao: 'evo_habits', registro_id: id, dados, excluido,
  atualizado_em: '2026-08-25T10:00:00Z',
});

console.log('Quebrar o documento em registros:');
verificar('lista com id vira um registro por item',
  desmontar([{ id: 'a', n: 1 }]), [{ id: 'a', dados: { id: 'a', n: 1 } }]);
verificar('objeto vira registro único',
  desmontar({ tema: 'escuro' }), [{ id: DOC_INTEIRO, dados: { tema: 'escuro' } }]);
verificar('lista de ids soltos vira registro único',
  desmontar(['x', 'y']), [{ id: DOC_INTEIRO, dados: ['x', 'y'] }]);
verificar('documento inexistente não tem registro', desmontar(null), []);

console.log('\nO que mudou numa gravação:');
verificar('registro novo entra',
  diferenca([], [{ id: 'a' }]), ['a']);
verificar('registro editado entra',
  diferenca([{ id: 'a', n: 1 }], [{ id: 'a', n: 2 }]), ['a']);
verificar('registro intocado não entra',
  diferenca([{ id: 'a', n: 1 }], [{ id: 'a', n: 1 }, { id: 'b' }]), ['b']);
verificar('nada mudou, nada a enviar',
  diferenca([{ id: 'a' }], [{ id: 'a' }]), []);

console.log('\nExclusão — sem lápide, sai da comparação:');
verificar('registro que sumiu é detectado',
  diferenca([{ id: 'a' }, { id: 'b' }], [{ id: 'a' }]), ['b']);
verificar('desmarcar hábito (o registro some) é detectado',
  diferenca([{ id: 'log1', completed: true }], []), ['log1']);
verificar('some da lista e vira linha com excluido',
  paraEnviar('evo_habits', [], ['b']),
  [{ colecao: 'evo_habits', registro_id: 'b', dados: null, excluido: true }]);
verificar('registro vivo vira linha com o corpo',
  paraEnviar('evo_habits', [{ id: 'a', n: 1 }], ['a']),
  [{ colecao: 'evo_habits', registro_id: 'a', dados: { id: 'a', n: 1 }, excluido: false }]);

console.log('\nAplicar o que veio do servidor:');
verificar('registro novo do outro aparelho entra',
  aplicar([{ id: 'a' }], [linha('b', { id: 'b' })]), [{ id: 'a' }, { id: 'b' }]);
verificar('registro excluído lá sai daqui',
  aplicar([{ id: 'a' }, { id: 'b' }], [linha('b', null, true)]), [{ id: 'a' }]);
verificar('registro editado lá é substituído',
  aplicar([{ id: 'a', n: 1 }], [linha('a', { id: 'a', n: 2 })]), [{ id: 'a', n: 2 }]);
verificar('linha igual ao que já está aqui não mexe no documento',
  aplicar([{ id: 'a' }], [linha('a', { id: 'a' })]), [{ id: 'a' }]);
verificar('documento local vazio recebe tudo',
  aplicar(null, [linha('a', { id: 'a' })]), [{ id: 'a' }]);

console.log('\nO que ainda não subiu não é sobrescrito:');
verificar('mudança local pendente ganha da versão antiga do servidor',
  aplicar([{ id: 'a', n: 99 }], [linha('a', { id: 'a', n: 1 })], new Set(['a'])),
  [{ id: 'a', n: 99 }]);
verificar('exclusão local pendente não é desfeita pelo servidor',
  aplicar([], [linha('a', { id: 'a' })], new Set(['a'])), []);

console.log('\nDuas voltas entre celular e PC:');
{
  // Servidor de mentira com o MESMO contrato do real: uma linha por
  // registro, `excluido` como coluna, carimbo escrito só por ele.
  let relogio = 0;
  const linhas = new Map();

  const gravar = (colecao, registro_id, dados, excluido) => {
    linhas.set(`${colecao} ${registro_id}`, {
      colecao, registro_id, dados, excluido,
      atualizado_em: String(++relogio).padStart(4, '0'),
    });
  };

  // Um aparelho: documento local, carimbo e fila de pendentes. O ciclo é
  // o mesmo do app — puxa o que é mais novo que o carimbo, aplica, envia
  // o que está pendente.
  const aparelho = () => ({ doc: [], desde: '', fila: [] });

  const gravarLocal = (ap, novo) => {
    ap.fila = [...new Set([...ap.fila, ...diferenca(ap.doc, novo)])];
    ap.doc = novo;
  };

  const ciclo = ap => {
    const chegando = [...linhas.values()]
      .filter(l => l.atualizado_em > ap.desde)
      .sort((a, b) => a.atualizado_em.localeCompare(b.atualizado_em));

    ap.doc = aplicar(ap.doc, chegando, new Set(ap.fila));
    for (const l of chegando) {
      if (l.atualizado_em > ap.desde) ap.desde = l.atualizado_em;
    }

    for (const l of paraEnviar('evo_habits', ap.doc, ap.fila)) {
      gravar(l.colecao, l.registro_id, l.dados, l.excluido);
    }
    ap.fila = [];
  };

  const pc = aparelho();
  const cel = aparelho();

  gravarLocal(pc, [{ id: 'h1', nome: 'ler' }]);
  gravarLocal(cel, [{ id: 'h2', nome: 'correr' }]);

  // O caso que não funcionava: os dois criaram algo antes de conversar.
  ciclo(pc);
  ciclo(cel);
  ciclo(pc);
  verificar('PC tem os dois hábitos', pc.doc.map(h => h.id).sort(), ['h1', 'h2']);
  verificar('celular tem os dois hábitos', cel.doc.map(h => h.id).sort(), ['h1', 'h2']);

  // Excluir no PC: precisa morrer no celular e NÃO voltar.
  gravarLocal(pc, pc.doc.filter(h => h.id !== 'h1'));
  ciclo(pc);
  ciclo(cel);
  verificar('exclusão do PC chega ao celular', cel.doc.map(h => h.id), ['h2']);

  ciclo(pc);
  ciclo(cel);
  ciclo(pc);
  verificar('e não ressuscita nas voltas seguintes', pc.doc.map(h => h.id), ['h2']);

  // Editar dos dois lados, registros diferentes, sem sincronizar no meio:
  // era aqui que o documento inteiro fazia um apagar o outro.
  gravarLocal(pc, [...pc.doc, { id: 'h3', nome: 'água' }]);
  gravarLocal(cel, [...cel.doc, { id: 'h4', nome: 'dormir' }]);
  ciclo(pc);
  ciclo(cel);
  ciclo(pc);
  verificar('gravação simultânea dos dois lados não perde nada',
    pc.doc.map(h => h.id).sort(), ['h2', 'h3', 'h4']);
  verificar('e os dois aparelhos terminam iguais',
    cel.doc.map(h => h.id).sort(), pc.doc.map(h => h.id).sort());

  // Ninguém mexeu: a puxada tem que vir vazia, senão os dois aparelhos
  // ficam se acordando em looping.
  const antes = relogio;
  ciclo(pc);
  ciclo(cel);
  verificar('ciclo sem novidade não escreve nada no servidor', relogio, antes);
}

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
