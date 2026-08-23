/**
 * Fuzz de interação: procura o que quebra quando o usuário é mais rápido
 * que a animação. Uso no console: `await fuzz()`.
 *
 * Cada teste devolve `{ nome, ok, detalhe }`.
 */
(function (global) {
  const sono = ms => new Promise(r => setTimeout(r, ms));
  const erros = [];

  if (!global.__fuzzErrosInstalado) {
    const orig = console.error;
    console.error = function (...a) { erros.push(a.map(String).join(' ').slice(0, 180)); orig.apply(console, a); };
    global.addEventListener('error', e => erros.push('window.error: ' + e.message));
    global.addEventListener('unhandledrejection', e => erros.push('promise: ' + e.reason));
    global.__fuzzErrosInstalado = true;
  }

  const irPara = async (nome, ms = 400) => {
    [...document.querySelectorAll('button')].find(x => x.innerText.trim() === nome)?.click();
    await sono(ms);
  };
  const raiz = () => document.getElementById('root');
  const texto = () => (raiz()?.innerText ?? '');
  const acoes = () => JSON.parse(localStorage.getItem('evo_actions') || '[]');
  const quebrou = () => texto().trim().length === 0;

  /** Repõe os dados e força a página a reler o store. Sem isto um teste
   *  herda o estado do anterior (o de rajada conclui tudo) e o seguinte
   *  falha sem ter nada a ver com o app. */
  const resemear = async () => {
    if (typeof global.semear !== 'function') return;
    global.semear('realista', false);
    await irPara('Hoje', 250);
    await irPara('Ações', 400);
  };

  const testes = [];
  const teste = (nome, fn) => testes.push({ nome, fn });

  // ── 1. clique repetido no mesmo checkbox, mais rápido que a animação ──
  teste('clique repetido no concluir (10x em 300ms)', async () => {
    await resemear();
    const antes = acoes().filter(a => a.completed).length;
    const chk = document.querySelector('button[aria-label^="Marcar como"]');
    if (!chk) return { ok: false, detalhe: 'nenhuma ação pendente para testar' };
    for (let i = 0; i < 10; i++) { chk.click(); await sono(30); }
    await sono(1200);
    const depois = acoes().filter(a => a.completed).length;
    return {
      ok: !quebrou() && depois === antes + 1,
      detalhe: `concluídas antes=${antes} depois=${depois} (esperado ${antes + 1}: o clique repetido não pode alternar várias vezes)`,
    };
  });

  // ── 2. sair da página com a animação de saída em andamento ──
  teste('trocar de página no meio da saída', async () => {
    await resemear();
    const chk = document.querySelector('button[aria-label^="Marcar como"]');
    if (!chk) return { ok: false, detalhe: 'sem ação pendente' };
    const antes = acoes().filter(a => a.completed).length;
    chk.click();
    await sono(80);              // no meio dos 380ms
    await irPara('Hoje', 200);
    await sono(1200);            // o timer dispara com a página desmontada
    const depois = acoes().filter(a => a.completed).length;
    return {
      ok: !quebrou() && depois === antes + 1,
      detalhe: `gravou mesmo saindo da tela? antes=${antes} depois=${depois}`,
    };
  });

  // ── 3. concluir tudo em rajada ──
  teste('concluir todas as pendentes em rajada', async () => {
    await resemear();
    let voltas = 0;
    while (voltas++ < 30) {
      const c = document.querySelector('button[aria-label="Marcar como concluída"]');
      if (!c) break;
      c.click();
      await sono(60);
    }
    await sono(1500);
    const pend = acoes().filter(a => !a.completed).length;
    return { ok: !quebrou(), detalhe: `restaram ${pend} pendentes; tela viva=${!quebrou()}` };
  });

  // ── 4. desfazer no meio da animação ──
  teste('desfazer logo após concluir', async () => {
    await resemear();
    const chk = document.querySelector('button[aria-label="Marcar como concluída"]');
    if (!chk) return { ok: false, detalhe: 'sem ação pendente' };
    const id = acoes().find(a => !a.completed)?.id;
    chk.click();
    await sono(700);
    // `textContent` e busca no `body`: a barra é um portal para fora do
    // #root, e `innerText` volta vazio quando a animação de entrada não
    // avançou (ela nasce em opacidade 0).
    const desfazer = [...document.body.querySelectorAll('button')]
      .find(b => b.textContent.trim() === 'Desfazer');
    if (!desfazer) return { ok: false, detalhe: 'barra de desfazer não apareceu' };
    desfazer.click();
    await sono(600);
    const voltou = acoes().find(a => a.id === id)?.completed === false;
    return { ok: !quebrou() && voltou, detalhe: `ação voltou a pendente? ${voltou}` };
  });

  // ── 5. abrir e fechar o modal em sequência ──
  teste('abrir e fechar modal 8x seguidas', async () => {
    await irPara('Ações');
    for (let i = 0; i < 8; i++) {
      [...document.querySelectorAll('button')].find(b => b.innerText.includes('Nova ação'))?.click();
      await sono(90);
      const cancelar = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Cancelar');
      cancelar?.click();
      await sono(90);
    }
    await sono(400);
    const sobrou = [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Cancelar' && b.getBoundingClientRect().width > 0);
    return { ok: !quebrou() && !sobrou, detalhe: `modal preso na tela? ${sobrou}` };
  });

  // ── 6. salvar com nome só de espaços ──
  teste('salvar ação com nome vazio', async () => {
    await irPara('Ações');
    const antes = acoes().length;
    [...document.querySelectorAll('button')].find(b => b.innerText.includes('Nova ação'))?.click();
    await sono(250);
    const input = document.querySelector('input[type="text"]');
    if (!input) return { ok: false, detalhe: 'campo não encontrado' };
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '     ');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sono(120);
    const criar = [...document.querySelectorAll('button')].find(b => ['Criar', 'Salvar'].includes(b.innerText.trim()));
    const bloqueado = criar?.disabled === true;
    criar?.click();
    await sono(300);
    const depois = acoes().length;
    [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Cancelar')?.click();
    await sono(200);
    return { ok: depois === antes, detalhe: `botão desabilitado=${bloqueado}, ações antes=${antes} depois=${depois}` };
  });

  // ── 7. navegação em rajada por todas as páginas ──
  teste('trocar de página 24x sem respirar', async () => {
    const paginas = ['Hoje', 'Dashboard', 'Hábitos', 'Desafios', 'Reviews', 'Pote de Biscoitos', 'Compras', 'Ações'];
    for (let i = 0; i < 24; i++) {
      [...document.querySelectorAll('button')].find(x => x.innerText.trim() === paginas[i % 8])?.click();
      await sono(35);
    }
    await sono(700);
    return { ok: !quebrou(), detalhe: `tela viva=${!quebrou()}; nós=${raiz().querySelectorAll('*').length}` };
  });

  // ── 8. marcar hábito repetidamente ──
  teste('marcar e desmarcar hábito 12x', async () => {
    await irPara('Hoje');
    const antes = JSON.parse(localStorage.getItem('evo_habit_logs') || '[]').length;
    const botoes = [...raiz().querySelectorAll('button')].filter(b => /feito|concluí|marcar/i.test(b.getAttribute('aria-label') || b.title || b.innerText));
    if (!botoes.length) return { ok: false, detalhe: 'nenhum controle de hábito encontrado' };
    for (let i = 0; i < 12; i++) { botoes[0].click(); await sono(50); }
    await sono(700);
    const depois = JSON.parse(localStorage.getItem('evo_habit_logs') || '[]').length;
    return { ok: !quebrou(), detalhe: `logs antes=${antes} depois=${depois}, diferença=${depois - antes}` };
  });

  // ── 9. chips: filtrar e esvaziar o grupo filtrado ──
  teste('filtrar por grupo e esvaziá-lo', async () => {
    await resemear();
    const chips = [...raiz().querySelectorAll('button')].filter(b => /^(Atrasadas|Hoje|Esta semana|Depois|Sem data)/.test(b.innerText.trim()));
    if (!chips.length) return { ok: true, detalhe: 'sem grupo para filtrar (aceitável)' };
    chips[0].click();
    await sono(400);
    let voltas = 0;
    while (voltas++ < 20) {
      const c = document.querySelector('button[aria-label="Marcar como concluída"]');
      if (!c) break;
      c.click();
      await sono(500);
    }
    await sono(900);
    const vazioSemSaida = texto().includes('Nada aqui') &&
      ![...raiz().querySelectorAll('button')].some(b => b.innerText.trim().startsWith('Todas'));
    return { ok: !quebrou() && !vazioSemSaida, detalhe: `preso em "Nada aqui" sem chip para sair? ${vazioSemSaida}` };
  });

  global.fuzz = async function () {
    erros.length = 0;
    const resultados = [];
    for (const t of testes) {
      try {
        const r = await t.fn();
        resultados.push({ nome: t.nome, ...r });
      } catch (e) {
        resultados.push({ nome: t.nome, ok: false, detalhe: 'exceção: ' + e.message });
      }
    }
    return {
      falhas: resultados.filter(r => !r.ok),
      passou: resultados.filter(r => r.ok).length,
      total: resultados.length,
      errosDeConsole: [...new Set(erros)].slice(0, 8),
      resultados,
    };
  };
})(window);
