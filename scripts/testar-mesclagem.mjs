import { mesclar, podar } from '../src/lib/mesclar.ts';
import { planejar } from '../src/lib/planejar.ts';

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

console.log('\nO que baixar do servidor:');
const CHAVES = ['evo_habits', 'evo_reviews'];
const temTudo = () => true;

verificar('carimbo mais velho que o servidor: baixa',
  planejar([{ chave: 'evo_habits', atualizado_em: '2026-08-24T10:00:00Z' }],
    { evo_habits: '2026-08-24T09:00:00Z' }, temTudo, CHAVES, false).baixar,
  ['evo_habits']);
verificar('carimbo igual: não baixa de novo',
  planejar([{ chave: 'evo_habits', atualizado_em: '2026-08-24T10:00:00Z' }],
    { evo_habits: '2026-08-24T10:00:00Z' }, temTudo, CHAVES, false).baixar,
  []);
verificar('nunca sincronizado aqui: baixa',
  planejar([{ chave: 'evo_habits', atualizado_em: '2026-08-24T10:00:00Z' }],
    {}, temTudo, CHAVES, false).baixar,
  ['evo_habits']);
verificar('sem cópia local: baixa mesmo com carimbo igual',
  planejar([{ chave: 'evo_habits', atualizado_em: '2026-08-24T10:00:00Z' }],
    { evo_habits: '2026-08-24T10:00:00Z' }, () => false, CHAVES, false).baixar,
  ['evo_habits']);
verificar('entrada no app baixa tudo, carimbo à parte',
  planejar([{ chave: 'evo_habits', atualizado_em: '2026-08-24T10:00:00Z' }],
    { evo_habits: '2026-08-24T10:00:00Z' }, temTudo, CHAVES, true).baixar,
  ['evo_habits']);
verificar('chave de fora da lista é ignorada',
  planejar([{ chave: 'evo_foco_andamento', atualizado_em: '2026-08-24T10:00:00Z' }],
    {}, temTudo, CHAVES, false).baixar,
  []);
verificar('documento que só existe aqui precisa subir',
  planejar([], {}, c => c === 'evo_reviews', CHAVES, false).subir,
  ['evo_reviews']);

console.log('\nExclusão (as lápides):');
verificar('registro excluído sai da lista',
  podar([{ id: 'a' }, { id: 'b' }], new Set(['a'])), [{ id: 'b' }]);
verificar('sem lápide nada muda',
  podar([{ id: 'a' }], new Set()), [{ id: 'a' }]);
verificar('lápide de id que não está aqui não atrapalha',
  podar([{ id: 'a' }], new Set(['z'])), [{ id: 'a' }]);
verificar('documento que não é lista com id passa intacto',
  podar({ a: 1 }, new Set(['a'])), { a: 1 });
verificar('a união ressuscita, e a poda desfaz',
  podar(mesclar([], [{ id: 'a' }], true), new Set(['a'])), []);

console.log('\nO hábito que ficava voltando:');
{
  // Duas listas: os hábitos e as lápides. Ambas sincronizam pelo mesmo
  // caminho — é o que faz "isto foi excluído" atravessar os aparelhos.
  const servidor = { habits: [{ id: 'h1' }], excluidos: [] };
  const sincronizar = ap => {
    ap.excluidos = mesclar(ap.excluidos, servidor.excluidos, true);
    const ids = new Set(ap.excluidos.map(l => l.id));
    ap.habits = podar(mesclar(ap.habits, servidor.habits, true), ids);
    servidor.excluidos = ap.excluidos;
    servidor.habits = podar(servidor.habits, ids);
  };

  const pc = { habits: [], excluidos: [] };
  const cel = { habits: [], excluidos: [] };

  sincronizar(pc);
  sincronizar(cel);
  verificar('os dois têm o hábito antes de excluir',
    [pc.habits.length, cel.habits.length], [1, 1]);

  // PC exclui: some da lista E deixa a lápide.
  pc.habits = [];
  pc.excluidos = [{ id: 'h1', em: '2026-08-24' }];
  sincronizar(pc);
  verificar('sai do servidor', servidor.habits, []);

  // O celular ainda tem a cópia dele — é exatamente aqui que voltava.
  sincronizar(cel);
  verificar('NÃO volta no celular', cel.habits, []);

  sincronizar(pc);
  verificar('NÃO volta no PC no ciclo seguinte', pc.habits, []);
}

console.log('\nDuas voltas entre celular e PC (a ordem que estava errada):');
{
  // Servidor de mentira, com o mesmo contrato do real: cada chave guarda
  // documento inteiro e um carimbo que só o servidor escreve.
  let relogio = 0;
  const servidor = new Map();
  const gravar = (chave, dados) => servidor.set(chave, { dados, em: String(++relogio).padStart(4, '0') });

  // Um aparelho: guarda local + carimbos, e sincroniza na ORDEM do app —
  // puxa, mescla, e só então sobe o resultado da mescla.
  const aparelho = (local = []) => ({ local, carimbo: null });
  const sincronizar = ap => {
    const doServidor = servidor.get('evo_habits');
    if (doServidor) {
      const remotoMaisNovo = !ap.carimbo || doServidor.em > ap.carimbo;
      ap.local = mesclar(ap.local, doServidor.dados, remotoMaisNovo);
      ap.carimbo = doServidor.em;
      if (JSON.stringify(ap.local) === JSON.stringify(doServidor.dados)) return;
    }
    gravar('evo_habits', ap.local);
    ap.carimbo = servidor.get('evo_habits').em;
  };

  const pc = aparelho([{ id: 'h1' }]);
  const cel = aparelho([{ id: 'h2' }]);

  sincronizar(pc);
  sincronizar(cel);
  verificar('celular recebe o hábito criado no PC', cel.local.map(h => h.id).sort(), ['h1', 'h2']);

  sincronizar(pc);
  verificar('PC recebe o hábito criado no celular', pc.local.map(h => h.id).sort(), ['h1', 'h2']);

  cel.local = [...cel.local, { id: 'h3' }];
  sincronizar(cel);
  sincronizar(pc);
  verificar('mudança posterior no celular chega ao PC', pc.local.map(h => h.id).sort(), ['h1', 'h2', 'h3']);

  pc.local = [...pc.local, { id: 'h4' }];
  sincronizar(pc);
  sincronizar(cel);
  verificar('e a do PC chega ao celular', cel.local.map(h => h.id).sort(), ['h1', 'h2', 'h3', 'h4']);
}

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
