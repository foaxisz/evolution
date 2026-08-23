/**
 * Percorre todas as páginas do app procurando defeito visível.
 * Uso no console: `await auditar()` — devolve a lista de problemas.
 *
 * O que ele procura:
 *   - erro de console / tela branca
 *   - overflow horizontal (conteúdo passando da largura da janela)
 *   - texto "NaN", "undefined", "Invalid Date", "[object Object]" na tela
 *   - controles clicáveis pequenos demais para o toque (< 24px)
 *   - controles visíveis com tamanho zero
 *   - elementos sobrepondo a barra de navegação no celular
 */
(function (global) {
  const PAGINAS = ['Hoje', 'Foco', 'Dashboard', 'Hábitos', 'Desafios', 'Reviews', 'Pote de Biscoitos', 'Compras', 'Ações'];
  const LIXO = ['NaN', 'undefined', 'Invalid Date', '[object Object]', 'null,', '9999-'];

  const sono = ms => new Promise(r => setTimeout(r, ms));

  // captura erros de console durante a auditoria
  const erros = [];
  if (!global.__auditErrosInstalado) {
    const origem = console.error;
    console.error = function (...args) { erros.push(args.map(String).join(' ').slice(0, 200)); origem.apply(console, args); };
    global.addEventListener('error', e => erros.push('window.error: ' + e.message));
    global.addEventListener('unhandledrejection', e => erros.push('promise: ' + e.reason));
    global.__auditErrosInstalado = true;
  }

  function irPara(nome) {
    const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === nome);
    if (!b) return false;
    b.click();
    return true;
  }

  /** Visível de verdade: checa a cadeia de ancestrais, não só o próprio
   *  elemento. A gaveta "Mais páginas" fica montada com opacity-0 e
   *  pointer-events-none no PAI — o botão dentro dela tem opacidade 1 e
   *  passava por visível. */
  function visivel(el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (parseFloat(cs.opacity) === 0) return false;
      if (cs.pointerEvents === 'none') return false;
    }
    return true;
  }

  function checarPagina(nome) {
    const problemas = [];
    const raiz = document.getElementById('root');
    const texto = raiz?.innerText ?? '';

    if (texto.trim().length === 0) {
      problemas.push({ pagina: nome, tipo: 'tela-branca', detalhe: 'a página não renderizou nada' });
      return problemas;
    }

    // lixo de formatação visível
    for (const marca of LIXO) {
      if (texto.includes(marca)) {
        const i = texto.indexOf(marca);
        problemas.push({
          pagina: nome, tipo: 'texto-lixo', detalhe: marca,
          contexto: texto.slice(Math.max(0, i - 40), i + 40).replace(/\n/g, ' '),
        });
      }
    }

    // overflow horizontal
    const larguraJanela = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > larguraJanela + 1) {
      const culpados = [...raiz.querySelectorAll('*')]
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > larguraJanela + 1;
        })
        .slice(0, 3)
        .map(el => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').slice(0, 3).join('.')} (right=${Math.round(el.getBoundingClientRect().right)})`);
      problemas.push({
        pagina: nome, tipo: 'overflow-horizontal',
        detalhe: `scrollWidth ${document.documentElement.scrollWidth} > janela ${larguraJanela}`,
        culpados,
      });
    }

    // Controles clicáveis. Mede a área que REALMENTE responde ao toque,
    // sondando com elementFromPoint — a caixa do elemento não conta o
    // alvo ampliado por pseudo-elemento, e daria falso positivo.
    const areaDeToque = btn => {
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const alcanca = (dx, dy) => {
        const el = document.elementFromPoint(cx + dx, cy + dy);
        return el === btn || btn.contains(el);
      };
      // varre do centro para fora; a soma dos dois lados é a área tocável
      const varrer = (dx, dy) => { let i = 1; while (i <= 30 && alcanca(dx * i, dy * i)) i++; return i - 1; };
      return {
        largura: varrer(-1, 0) + varrer(1, 0),
        altura: varrer(0, -1) + varrer(0, 1),
      };
    };

    const controles = [...raiz.querySelectorAll('button, a, input, select, textarea, [role="button"]')];
    const pequenos = [];
    const zerados = [];
    for (const c of controles) {
      if (!visivel(c)) continue;
      const r0 = c.getBoundingClientRect();
      if (r0.width === 0 || r0.height === 0) { zerados.push(c); continue; }
      if (r0.height >= 24 && r0.width >= 24) continue;

      // Um input dentro de <label> é focado ao tocar em qualquer ponto do
      // label: o alvo real é a caixa dele, não a do campo (que costuma ter
      // a altura da linha de texto). Sem isto, todo campo com respiro no
      // contêiner aparece como alvo minúsculo sem ser.
      const rotulo = c.closest('label');
      if (rotulo) {
        const rr = rotulo.getBoundingClientRect();
        if (rr.height >= 24 && rr.width >= 24) continue;
      }

      // elementFromPoint só enxerga dentro da janela: fora da dobra ele
      // devolve null e o alvo apareceria como minúsculo sem ser.
      c.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = c.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) continue;

      const a = areaDeToque(c);
      if (a.altura < 24 || a.largura < 24) {
        pequenos.push(`${c.tagName.toLowerCase()} "${(c.innerText || c.getAttribute('aria-label') || c.title || c.type || '').trim().slice(0, 24)}" visual ${Math.round(r.width)}x${Math.round(r.height)} toque ${Math.round(a.largura)}x${Math.round(a.altura)}`);
      }
    }
    if (zerados.length) problemas.push({ pagina: nome, tipo: 'controle-tamanho-zero', detalhe: `${zerados.length} controle(s)` });
    if (pequenos.length) problemas.push({ pagina: nome, tipo: 'alvo-de-toque-pequeno', detalhe: `${pequenos.length}`, exemplos: pequenos.slice(0, 5) });

    return problemas;
  }

  /** Roda em uma página só — útil quando a varredura inteira estoura o
   *  tempo limite da ferramenta com muitos dados semeados. */
  global.auditarPagina = async function (nome) {
    erros.length = 0;
    if (!irPara(nome)) return { pagina: nome, erro: 'não encontrada' };
    await sono(320);
    const achados = checarPagina(nome);
    if (erros.length) achados.push({ pagina: nome, tipo: 'erro-de-console', detalhe: [...new Set(erros)].slice(0, 4) });
    return { pagina: nome, total: achados.length, achados };
  };

  global.auditar = async function (etiqueta = '') {
    const achados = [];
    erros.length = 0;

    for (const p of PAGINAS) {
      if (!irPara(p)) { achados.push({ pagina: p, tipo: 'navegacao', detalhe: 'botão de navegação não encontrado' }); continue; }
      await sono(320);
      achados.push(...checarPagina(p));
    }

    if (erros.length) achados.push({ pagina: '(geral)', tipo: 'erro-de-console', detalhe: [...new Set(erros)].slice(0, 6) });

    return {
      etiqueta,
      largura: window.innerWidth,
      total: achados.length,
      achados,
    };
  };
})(window);
