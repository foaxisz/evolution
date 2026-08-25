import {
  desmontar, diferenca, aplicar, aplicaveis, paraEnviar, faltandoNoServidor,
  canonico, EXCLUIDO_CANONICO, DOC_INTEIRO,
} from '../src/lib/registros.ts';

/**
 * Teste da sincronização.
 *
 * O projeto não tem framework de teste, e esta é a única lógica do app em
 * que um erro APAGA dado do usuário em silêncio — merece verificação de
 * verdade, não inspeção visual.
 *
 * A segunda metade é um SIMULADOR de dois aparelhos contra um servidor de
 * mentira que imita o de verdade nos pontos que importam: carimbo distinto
 * por linha (`clock_timestamp()`), ordenação total, leitura paginada e
 * cursor com margem. Sem espelhar esses quatro, o teste passaria e o app
 * continuaria perdendo dado — foi assim que os bugs de paginação e de
 * fronteira do cursor sobreviveram a três reescritas.
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

// ══════════════════════════════════════════════════════════════════════
// Unidade
// ══════════════════════════════════════════════════════════════════════

console.log('Quebrar o documento em registros:');
verificar('lista com id vira um registro por item',
  desmontar([{ id: 'a', n: 1 }]), [{ id: 'a', dados: { id: 'a', n: 1 } }]);
verificar('objeto vira registro único',
  desmontar({ tema: 'escuro' }), [{ id: DOC_INTEIRO, dados: { tema: 'escuro' } }]);
verificar('lista de ids soltos vira registro único',
  desmontar(['x', 'y']), [{ id: DOC_INTEIRO, dados: ['x', 'y'] }]);
verificar('documento inexistente não tem registro', desmontar(null), []);

console.log('\nForma canônica (o Postgres reordena as chaves do jsonb):');
verificar('ordem das chaves não importa',
  canonico({ b: 1, a: 2 }) === canonico({ a: 2, b: 1 }), true);
verificar('mas ordem de LISTA importa, porque ali é dado',
  canonico([1, 2]) === canonico([2, 1]), false);
verificar('chave reordenada não conta como mudança',
  diferenca([{ id: 'a', x: 1, y: 2 }], [{ id: 'a', y: 2, x: 1 }]), []);

console.log('\nO que mudou numa gravação:');
verificar('registro novo entra', diferenca([], [{ id: 'a' }]), ['a']);
verificar('registro editado entra',
  diferenca([{ id: 'a', n: 1 }], [{ id: 'a', n: 2 }]), ['a']);
verificar('registro intocado não entra',
  diferenca([{ id: 'a', n: 1 }], [{ id: 'a', n: 1 }, { id: 'b' }]), ['b']);
verificar('nada mudou, nada a enviar', diferenca([{ id: 'a' }], [{ id: 'a' }]), []);

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
verificar('linha igual não mexe no documento (devolve o mesmo objeto)',
  (() => { const d = [{ id: 'a' }]; return aplicar(d, [linha('a', { id: 'a' })]) === d; })(), true);
verificar('documento local vazio recebe tudo',
  aplicar(null, [linha('a', { id: 'a' })]), [{ id: 'a' }]);
verificar('exclusão é aplicada mesmo com o id pendente aqui (não há escudo)',
  aplicar([{ id: 'a' }], [linha('a', null, true)]), []);

console.log('\nAnti-ressurreição no faltandoNoServidor:');
{
  const remotos = new Map();
  remotos.set('evo_habits del1', EXCLUIDO_CANONICO);
  remotos.set('evo_habits ok1', canonico({ id: 'ok1', n: 1 }));

  verificar('excluído no servidor não é reenviado, mesmo sobrando local',
    faltandoNoServidor([{ id: 'del1', n: 1 }, { id: 'novo1', n: 1 }], remotos, 'evo_habits'),
    ['novo1']);
  verificar('idêntico ao servidor não sobe de novo',
    faltandoNoServidor([{ id: 'ok1', n: 1 }], remotos, 'evo_habits'), []);
  verificar('idêntico com chaves em outra ordem também não sobe',
    faltandoNoServidor([{ n: 1, id: 'ok1' }], remotos, 'evo_habits'), []);
}

// ══════════════════════════════════════════════════════════════════════
// Simulador: dois aparelhos contra um servidor que imita o Postgres
// ══════════════════════════════════════════════════════════════════════

const LOTE = 500;
const MARGEM = 5; // equivale ao MARGEM_MS, em ticks do relógio de mentira

/**
 * Espelha o `.order()` do cliente: uma ordem TOTAL.
 *
 * O desempate por `colecao` e `registro_id` é o que torna a paginação
 * segura. Sem ele, linhas de carimbo igual saem em ordem arbitrária, e como
 * `range()` pagina por POSIÇÃO, a página 2 pode repetir uma linha da página
 * 1 e pular outra.
 */
function comparar(a, b) {
  return a.atualizado_em - b.atualizado_em
    || a.colecao.localeCompare(b.colecao)
    || a.registro_id.localeCompare(b.registro_id);
}

/**
 * @param carimboPorTransacao  `true` imita o gatilho antigo, com `now()`:
 *   todas as linhas do mesmo lote recebem o MESMO carimbo. É o cenário em
 *   que a ordenação instável perde dado, e ele precisa ser testado porque o
 *   cliente tem de sobreviver a um banco que ainda não recebeu a migração.
 */
function servidor({ carimboPorTransacao = false } = {}) {
  const linhas = new Map();
  let relogio = 0;

  const por = (usuario, l, carimbo) => {
    linhas.set(`${usuario} ${l.colecao} ${l.registro_id}`, {
      usuario, colecao: l.colecao, registro_id: l.registro_id,
      dados: l.dados, excluido: l.excluido, atualizado_em: carimbo,
    });
  };

  return {
    /** Um lote — uma "transação". */
    gravarLote(usuario, lote) {
      if (carimboPorTransacao) {
        const t = ++relogio;                     // now(): um carimbo só
        for (const l of lote) por(usuario, l, t);
      } else {
        for (const l of lote) por(usuario, l, ++relogio); // clock_timestamp()
      }
    },

    /**
     * Linha que confirma FORA da ordem do carimbo.
     *
     * Transação longa que começou antes e só confirmou agora: a linha nasce
     * com carimbo antigo, mas aparece no banco depois de o leitor já ter
     * avançado o cursor além dela. É a janela que a margem fecha.
     */
    gravarAtrasado(usuario, l, atrasoEmTiques) {
      por(usuario, l, Math.max(1, relogio - atrasoEmTiques));
    },

    /**
     * Espelha buscar(): `.gt`, ordenação e paginação por posição.
     *
     * Cada página é uma CONSULTA NOVA, e por isso a ordenação é refeita a
     * cada uma — como no Postgres. Era isto que o simulador anterior não
     * fazia: ele ordenava uma vez e cortava o mesmo array, então nenhuma
     * instabilidade de ordem podia aparecer.
     */
    buscar(usuario, desde) {
      const out = [];
      for (let p = 0; ; p++) {
        const todas = [...linhas.values()]
          .filter(l => l.usuario === usuario)
          .filter(l => desde === null || l.atualizado_em > desde)
          .sort(comparar);

        const pagina = todas.slice(p * LOTE, (p + 1) * LOTE);
        out.push(...pagina);
        if (pagina.length < LOTE) break;
      }
      return out;
    },
    contar: () => linhas.size,
    tique: () => relogio,
  };
}

function aparelho(usuario) {
  return { usuario, docs: new Map(), desde: null, fila: new Map(), dono: null };
}

const ler = (ap, chave) => (ap.docs.has(chave) ? ap.docs.get(chave) : null);

/** Espelha anotarGravacao: a fila sai da diferença contra o valor anterior. */
function gravarLocal(ap, chave, novo) {
  const ids = diferenca(ler(ap, chave), novo);
  if (ids.length) {
    ap.fila.set(chave, [...new Set([...(ap.fila.get(chave) ?? []), ...ids])]);
  }
  ap.docs.set(chave, novo);
}

/** Espelha empurrar(): envia a fila e só então a limpa. */
function empurrar(ap, srv) {
  const snapshot = [...ap.fila.entries()];
  const lote = snapshot.flatMap(([chave, ids]) => paraEnviar(chave, ler(ap, chave), ids));
  if (lote.length) srv.gravarLote(ap.usuario, lote);
  for (const [chave, ids] of snapshot) {
    const restam = (ap.fila.get(chave) ?? []).filter(id => !ids.includes(id));
    if (restam.length) ap.fila.set(chave, restam);
    else ap.fila.delete(chave);
  }
}

/** Espelha avancarCarimbo(): margem para trás, e nunca retrocede. */
function avancarCarimbo(ap, linhas) {
  if (!linhas.length) return;
  const maior = Math.max(...linhas.map(l => l.atualizado_em));
  const comMargem = maior - MARGEM;
  ap.desde = ap.desde !== null && ap.desde > comMargem ? ap.desde : comMargem;
}

/** Espelha aplicarLinhas(): agrupa por coleção e grava. */
function aplicarLinhas(ap, linhas) {
  const porColecao = new Map();
  for (const l of linhas) {
    if (!porColecao.has(l.colecao)) porColecao.set(l.colecao, []);
    porColecao.get(l.colecao).push(l);
  }
  const mudadas = [];
  for (const [chave, doColecao] of porColecao) {
    const antes = ler(ap, chave);
    const depois = aplicar(antes, doColecao);
    if (depois === antes) continue;
    ap.docs.set(chave, depois);
    mudadas.push(chave);
  }
  return mudadas;
}

/** Espelha conferirDono(): troca de conta apaga o local de outro dono. */
function conferirDono(ap, chaves) {
  if (ap.dono === ap.usuario) return 'mesmo';
  if (ap.dono === null) { ap.dono = ap.usuario; return 'primeiro'; }
  for (const c of chaves) ap.docs.delete(c);
  ap.desde = null;
  ap.fila.clear();
  ap.dono = ap.usuario;
  return 'trocou';
}

/** Espelha executarCiclo() na ordem exata: dono → enviar → puxar → reconciliar. */
function ciclo(ap, srv, chaves = ['evo_habits']) {
  const procedencia = conferirDono(ap, chaves);

  empurrar(ap, srv);

  const desde = ap.desde;
  const ePrimeira = desde === null;
  const linhas = srv.buscar(ap.usuario, desde);

  let mudadas = [];
  if (linhas.length) {
    mudadas = aplicarLinhas(ap, linhas);
    avancarCarimbo(ap, linhas);
  } else if (ePrimeira) {
    ap.desde = 0;
  }

  if (ePrimeira && procedencia !== 'trocou') {
    const remotos = new Map();
    for (const l of linhas) {
      remotos.set(`${l.colecao} ${l.registro_id}`,
        l.excluido ? EXCLUIDO_CANONICO : canonico(l.dados));
    }
    let novos = false;
    for (const chave of chaves) {
      const faltam = faltandoNoServidor(ler(ap, chave), remotos, chave);
      if (faltam.length) {
        ap.fila.set(chave, [...new Set([...(ap.fila.get(chave) ?? []), ...faltam])]);
        novos = true;
      }
    }
    if (novos) empurrar(ap, srv);
  }
  return mudadas;
}

const ids = (ap, chave = 'evo_habits') => (ler(ap, chave) ?? []).map(r => r.id).sort();

// ── Os cenários ───────────────────────────────────────────────────────

console.log('\n── Cenários reais entre PC e celular ──');

{ // 1 e 2: criar num aparelho, ver no outro
  const srv = servidor();
  const pc = aparelho('u1'), cel = aparelho('u1');

  gravarLocal(pc, 'evo_habits', [{ id: 'h1', nome: 'ler' }]);
  ciclo(pc, srv); ciclo(cel, srv);
  verificar('1. criado no PC aparece no celular', ids(cel), ['h1']);

  gravarLocal(cel, 'evo_habits', [...ler(cel, 'evo_habits'), { id: 'h2', nome: 'correr' }]);
  ciclo(cel, srv); ciclo(pc, srv);
  verificar('2. criado no celular aparece no PC', ids(pc), ['h1', 'h2']);
}

{ // 3 e 4: editar
  const srv = servidor();
  const pc = aparelho('u1'), cel = aparelho('u1');
  gravarLocal(pc, 'evo_habits', [{ id: 'h1', nome: 'ler' }]);
  ciclo(pc, srv); ciclo(cel, srv);

  gravarLocal(pc, 'evo_habits', [{ id: 'h1', nome: 'ler 30min' }]);
  ciclo(pc, srv); ciclo(cel, srv);
  verificar('3. edição do PC chega ao celular',
    ler(cel, 'evo_habits')[0].nome, 'ler 30min');

  gravarLocal(cel, 'evo_habits', [{ id: 'h1', nome: 'ler 1h' }]);
  ciclo(cel, srv); ciclo(pc, srv);
  verificar('4. edição do celular chega ao PC',
    ler(pc, 'evo_habits')[0].nome, 'ler 1h');
}

{ // 5 e 15: exclusão que não ressuscita
  const srv = servidor();
  const pc = aparelho('u1'), cel = aparelho('u1');
  gravarLocal(pc, 'evo_habits', [{ id: 'h1' }, { id: 'h2' }]);
  ciclo(pc, srv); ciclo(cel, srv);

  gravarLocal(pc, 'evo_habits', [{ id: 'h2' }]);
  ciclo(pc, srv); ciclo(cel, srv);
  verificar('5. exclusão no PC apaga no celular', ids(cel), ['h2']);

  for (let i = 0; i < 5; i++) { ciclo(pc, srv); ciclo(cel, srv); }
  verificar('15. e não ressuscita em 5 voltas seguintes', ids(pc), ['h2']);
  verificar('15b. nem no celular', ids(cel), ['h2']);
}

{ // 6 e 14: rajada de alterações
  const srv = servidor();
  const pc = aparelho('u1'), cel = aparelho('u1');
  let doc = [];
  for (let i = 0; i < 50; i++) {
    doc = [...doc, { id: 'r' + i, n: i }];
    gravarLocal(pc, 'evo_habits', doc);
  }
  ciclo(pc, srv); ciclo(cel, srv);
  verificar('6/14. 50 registros criados em rajada chegam inteiros',
    ids(cel).length, 50);
  verificar('14b. sem duplicar', new Set(ids(cel)).size, 50);
}

{ // 8: offline e reconexão
  const srv = servidor();
  const pc = aparelho('u1'), cel = aparelho('u1');
  gravarLocal(pc, 'evo_habits', [{ id: 'h1' }]);
  ciclo(pc, srv); ciclo(cel, srv);

  // Celular offline: grava, mas nenhum ciclo roda.
  gravarLocal(cel, 'evo_habits', [...ler(cel, 'evo_habits'), { id: 'off1' }]);
  gravarLocal(cel, 'evo_habits', [...ler(cel, 'evo_habits'), { id: 'off2' }]);
  // Enquanto isso o PC segue trabalhando.
  gravarLocal(pc, 'evo_habits', [...ler(pc, 'evo_habits'), { id: 'pc1' }]);
  ciclo(pc, srv);

  // Reconectou.
  ciclo(cel, srv); ciclo(pc, srv);
  verificar('8. offline e reconexão: nada se perde dos dois lados',
    ids(pc), ['h1', 'off1', 'off2', 'pc1']);
  verificar('8b. e os dois terminam iguais', ids(cel), ids(pc));
}

{ // 10: alterações diferentes e simultâneas
  const srv = servidor();
  const pc = aparelho('u1'), cel = aparelho('u1');
  gravarLocal(pc, 'evo_habits', [{ id: 'base' }]);
  ciclo(pc, srv); ciclo(cel, srv);

  gravarLocal(pc, 'evo_habits', [...ler(pc, 'evo_habits'), { id: 'doPc' }]);
  gravarLocal(cel, 'evo_habits', [...ler(cel, 'evo_habits'), { id: 'doCel' }]);
  ciclo(pc, srv); ciclo(cel, srv); ciclo(pc, srv);
  verificar('10. registros diferentes e simultâneos convivem',
    ids(pc), ['base', 'doCel', 'doPc']);
  verificar('10b. e convergem', ids(cel), ids(pc));
}

{ // 11: app fechado no meio da sincronização
  const srv = servidor();
  const pc = aparelho('u1'), cel = aparelho('u1');
  gravarLocal(pc, 'evo_habits', [{ id: 'h1' }]);
  // Fecha logo depois de enviar, sem chegar a puxar nem limpar o carimbo.
  empurrar(pc, srv);
  verificar('11. fila esvaziada só depois do envio bem-sucedido',
    pc.fila.size, 0);
  ciclo(cel, srv);
  verificar('11b. o que subiu antes do fechamento chega ao outro', ids(cel), ['h1']);
}

{ // 12: logout e login com OUTRA conta no mesmo aparelho
  const srv = servidor();
  const compartilhado = aparelho('uA');
  gravarLocal(compartilhado, 'evo_habits', [{ id: 'segredoDoA' }]);
  ciclo(compartilhado, srv);
  const linhasDeA = srv.contar();

  // Entra a conta B no mesmo aparelho.
  compartilhado.usuario = 'uB';
  ciclo(compartilhado, srv);
  verificar('12. dado da conta A não vaza para a conta B',
    ids(compartilhado), []);
  verificar('12b. e nada de A foi enviado para B no servidor',
    srv.contar(), linhasDeA);

  // E ao voltar para A, o dado dela continua no servidor.
  compartilhado.usuario = 'uA';
  ciclo(compartilhado, srv);
  verificar('12c. voltando para A, o dado dela é recuperado do servidor',
    ids(compartilhado), ['segredoDoA']);
}

{ // 13: recarregar a aplicação (perde memória, mantém localStorage)
  const srv = servidor();
  const pc = aparelho('u1');
  gravarLocal(pc, 'evo_habits', [{ id: 'h1' }]);
  ciclo(pc, srv);
  const antes = srv.tique();
  // Recarrega: carimbo e documentos sobrevivem, a fila está vazia.
  ciclo(pc, srv); ciclo(pc, srv);
  verificar('13. recarregar não reescreve nada no servidor', srv.tique(), antes);
  verificar('13b. e o documento continua íntegro', ids(pc), ['h1']);
}

{ // 16 e 17: paginação além do lote, que era a perda silenciosa
  const srv = servidor();
  const pc = aparelho('u1'), cel = aparelho('u1');
  const grande = [];
  for (let i = 0; i < LOTE * 2 + 37; i++) grande.push({ id: 'r' + String(i).padStart(5, '0'), n: i });
  gravarLocal(pc, 'evo_habits', grande);
  ciclo(pc, srv);
  ciclo(cel, srv);
  verificar(`16. ${grande.length} registros (acima do lote de ${LOTE}) chegam TODOS`,
    ids(cel).length, grande.length);
  verificar('17. sem duplicar nenhum', new Set(ids(cel)).size, grande.length);
  verificar('17b. e nenhum desaparece em silêncio',
    ids(cel).join() === grande.map(r => r.id).sort().join(), true);
}

{ // Fronteira do cursor: linha com carimbo igual ao do cursor
  const srv = servidor();
  const pc = aparelho('u1'), cel = aparelho('u1');
  gravarLocal(pc, 'evo_habits', [{ id: 'h1' }]);
  ciclo(pc, srv); ciclo(cel, srv);

  // Grava várias linhas de uma vez e confere que a margem as recupera.
  gravarLocal(pc, 'evo_habits', [...ler(pc, 'evo_habits'),
    { id: 'a' }, { id: 'b' }, { id: 'c' }]);
  ciclo(pc, srv); ciclo(cel, srv);
  verificar('fronteira do cursor: nenhuma linha do lote é pulada',
    ids(cel), ['a', 'b', 'c', 'h1']);
}

{ // Paginação com carimbos IGUAIS — o banco ainda em now()
  //
  // Este é o cenário que a ordenação total protege. O gatilho antigo dava o
  // mesmo carimbo a todas as linhas do lote; com mais linhas que o lote de
  // leitura, a paginação por posição precisa de desempate para não repetir
  // uma linha e pular outra. O cliente tem de aguentar isso mesmo se o
  // banco ainda não recebeu a migração v4.
  const srv = servidor({ carimboPorTransacao: true });
  const pc = aparelho('u1'), cel = aparelho('u1');

  const grande = [];
  for (let i = 0; i < LOTE * 2 + 37; i++) {
    grande.push({ id: 'r' + String(i).padStart(5, '0'), n: i });
  }
  gravarLocal(pc, 'evo_habits', grande);
  ciclo(pc, srv);
  ciclo(cel, srv);

  verificar(`carimbos iguais: ${grande.length} linhas num só carimbo chegam todas`,
    ids(cel).length, grande.length);
  verificar('carimbos iguais: sem duplicar', new Set(ids(cel)).size, grande.length);
}

{ // Commit fora da ordem do carimbo — o que a margem do cursor cobre
  //
  // Uma transação longa começou antes, recebeu carimbo antigo, e só
  // confirmou depois de o leitor já ter passado do ponto. Com `.gt` puro e
  // cursor no carimbo mais novo, essa linha nunca mais seria lida.
  const srv = servidor();
  const pc = aparelho('u1'), cel = aparelho('u1');

  gravarLocal(pc, 'evo_habits', [{ id: 'h1' }]);
  ciclo(pc, srv);
  ciclo(cel, srv);

  // Avança o relógio do servidor com atividade de outro aparelho...
  gravarLocal(pc, 'evo_habits', [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }]);
  ciclo(pc, srv);
  ciclo(cel, srv);

  // ...e só agora a transação atrasada confirma, com carimbo para trás.
  srv.gravarAtrasado('u1', {
    colecao: 'evo_habits', registro_id: 'atrasado', dados: { id: 'atrasado' }, excluido: false,
  }, 2);

  ciclo(cel, srv);
  verificar('commit fora de ordem: a linha atrasada não é perdida',
    ids(cel).includes('atrasado'), true);
}

{ // Documento que não é lista de registros
  const srv = servidor();
  const pc = aparelho('u1'), cel = aparelho('u1');
  const chaves = ['evo_foco_ajustes'];
  gravarLocal(pc, 'evo_foco_ajustes', { som: true, duracao: 25 });
  ciclo(pc, srv, chaves); ciclo(cel, srv, chaves);
  verificar('documento inteiro (objeto de ajustes) sincroniza',
    ler(cel, 'evo_foco_ajustes'), { som: true, duracao: 25 });

  gravarLocal(cel, 'evo_foco_ajustes', { som: false, duracao: 50 });
  ciclo(cel, srv, chaves); ciclo(pc, srv, chaves);
  verificar('e a edição dele volta pelo outro lado',
    ler(pc, 'evo_foco_ajustes'), { som: false, duracao: 50 });
}

{ // Idempotência: ciclo sem novidade não escreve nada
  const srv = servidor();
  const pc = aparelho('u1'), cel = aparelho('u1');
  gravarLocal(pc, 'evo_habits', [{ id: 'h1' }, { id: 'h2' }]);
  ciclo(pc, srv); ciclo(cel, srv); ciclo(pc, srv);
  const antes = srv.tique();
  for (let i = 0; i < 10; i++) { ciclo(pc, srv); ciclo(cel, srv); }
  verificar('10 ciclos ociosos não escrevem nada no servidor', srv.tique(), antes);
  verificar('e os dois seguem iguais', ids(cel), ids(pc));
}


// ══════════════════════════════════════════════════════════════════════
// Gravação DURANTE o ciclo (o bug de contar água)
// ══════════════════════════════════════════════════════════════════════

console.log('\nGravação feita durante a janela de rede do ciclo:');
{
  const linha = (id, valor, excluido = false) => ({
    colecao: 'evo_habit_logs', registro_id: id,
    dados: excluido ? null : { id, count: valor },
    excluido, atualizado_em: '2026-08-25T10:00:00.000Z',
  });

  // O cenário exato: enviei count=1, cliquei para 2 antes da resposta, e o
  // servidor devolveu o 1 que eu mesmo mandei.
  const local = [{ id: 'log1', count: 2 }];
  const doServidor = [linha('log1', 1)];
  const naFila = { evo_habit_logs: ['log1'] };

  verificar('a resposta velha do servidor é descartada',
    aplicaveis(doServidor, naFila), []);
  verificar('e o valor local sobrevive',
    aplicar(local, aplicaveis(doServidor, naFila)), local);

  // Sem nada na fila, a linha aplica normalmente — senão a sincronização
  // simplesmente pararia de funcionar.
  verificar('sem pendência, aplica',
    aplicaveis(doServidor, {}).length, 1);
  verificar('e o valor do servidor entra',
    aplicar(local, aplicaveis(doServidor, {})), [{ id: 'log1', count: 1 }]);

  // Id diferente na fila não protege o que não é dele.
  verificar('a proteção é por id, não por coleção',
    aplicaveis(doServidor, { evo_habit_logs: ['outro'] }).length, 1);

  // Coleção diferente também não.
  verificar('e por coleção também',
    aplicaveis(doServidor, { evo_habits: ['log1'] }).length, 1);

  // Exclusão passa mesmo protegida: ressuscitar registro apagado é o erro
  // pior, e foi o bug que a lápide veio consertar.
  verificar('exclusão atravessa a proteção',
    aplicaveis([linha('log1', null, true)], naFila).length, 1);
  verificar('e apaga de verdade',
    aplicar(local, aplicaveis([linha('log1', null, true)], naFila)), []);

  // Fila vazia gravada como array vazio não deve proteger nada.
  verificar('array vazio na fila não protege',
    aplicaveis(doServidor, { evo_habit_logs: [] }).length, 1);

  // Vários cliques seguidos: dois ids protegidos, um terceiro livre.
  const tres = [linha('a', 1), linha('b', 1), linha('c', 1)];
  verificar('protege só os que estão na fila',
    aplicaveis(tres, { evo_habit_logs: ['a', 'c'] }).map(l => l.registro_id), ['b']);
}

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
