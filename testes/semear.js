/**
 * Gerador de dados mocados para testar o app manualmente ou pelo console.
 * Cole o conteúdo no console do navegador com o app aberto, ou use
 * `semear('realista')` depois de carregar este arquivo.
 *
 * Cenários:
 *   realista  — meses de histórico em todas as entidades
 *   vazio     — tudo zerado
 *   unico     — exatamente um registro de cada
 *   volume    — muitos registros, para achar problema de layout e lentidão
 *   extremo   — textos gigantes, emoji, HTML, números fora de faixa
 *   legado    — esquema antigo, sem os campos novos
 */
(function (global) {
  const CHAVES = [
    'evo_habits', 'evo_habit_logs', 'evo_challenges', 'evo_challenge_logs',
    'evo_reviews', 'evo_cookies', 'evo_shopping', 'evo_shopping_categories',
    'evo_actions', 'evo_interacoes', 'evo_destaques',
  ];

  const pad = n => String(n).padStart(2, '0');
  const dataISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const diasAtras = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const isoAtras = n => dataISO(diasAtras(n));
  const carimboAtras = n => diasAtras(n).toISOString();
  const uid = (p, i) => `${p}-${i}`;
  const escolher = (arr, i) => arr[i % arr.length];

  function limpar() {
    CHAVES.forEach(k => localStorage.removeItem(k));
  }

  function gravar(dados) {
    limpar();
    Object.entries(dados).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  }

  // ── realista ──────────────────────────────────────────────────────────
  function realista() {
    const habitos = [
      { nome: 'Academia',        freq: 5, dias: [1, 2, 3, 4, 5], cor: '#3ddc97', icone: 'dumbbell' },
      { nome: 'Ler',             freq: 7, dias: [],              cor: '#38bdf8', icone: 'book', meta: 20, unidade: 'páginas' },
      { nome: 'Beber água',      freq: 7, dias: [],              cor: '#00e5ff', icone: 'droplet', meta: 6, unidade: 'copos' },
      { nome: 'Meditar',         freq: 4, dias: [1, 3, 5, 0],    cor: '#a855f7', icone: 'brain' },
      { nome: 'Estudar inglês',  freq: 3, dias: [2, 4, 6],       cor: '#ffb000', icone: 'languages' },
      { nome: 'Dormir cedo',     freq: 6, dias: [],              cor: '#ff6b35', icone: 'moon' },
    ];

    const evo_habits = habitos.map((h, i) => ({
      id: uid('h', i),
      name: h.nome,
      description: i % 3 === 0 ? `Meta: manter ${h.freq}x por semana.` : undefined,
      icon: h.icone,
      frequency: h.freq,
      preferredDays: h.dias,
      color: h.cor,
      createdAt: carimboAtras(120),
      dailyTarget: h.meta,
      unit: h.unidade,
      order: i,
    }));

    // 120 dias de histórico, com aderência variando por hábito
    const evo_habit_logs = [];
    let n = 0;
    for (let dia = 0; dia < 120; dia++) {
      const data = isoAtras(dia);
      const dow = diasAtras(dia).getDay();
      evo_habits.forEach((h, hi) => {
        const prefere = h.preferredDays.length === 0 || h.preferredDays.includes(dow);
        if (!prefere) return;
        // aderência decrescente conforme o hábito, e melhor nas semanas recentes
        const base = 0.85 - hi * 0.09;
        const recente = dia < 21 ? 0.12 : 0;
        const sorte = ((dia * 31 + hi * 17) % 100) / 100;
        if (sorte > base + recente) return;
        if (h.dailyTarget) {
          const contagem = 1 + ((dia + hi) % h.dailyTarget);
          evo_habit_logs.push({
            id: uid('hl', n++), habitId: h.id, date: data,
            count: contagem, completed: contagem >= h.dailyTarget,
          });
        } else {
          evo_habit_logs.push({ id: uid('hl', n++), habitId: h.id, date: data, completed: true });
        }
      });
    }

    const evo_challenges = [
      { id: 'c-0', name: 'Mil Interações', description: 'Conversar com mil pessoas', target: 1000, current: 137, unit: 'interações', color: '#a855f7', createdAt: carimboAtras(90) },
      { id: 'c-1', name: 'Cem livros', description: undefined, target: 100, current: 100, unit: 'livros', color: '#38bdf8', createdAt: carimboAtras(200), completedAt: carimboAtras(5) },
      { id: 'c-2', name: '10 mil flexões', target: 10000, current: 0, unit: 'flexões', color: '#ff6b35', createdAt: carimboAtras(2) },
    ];

    const evo_challenge_logs = [];
    for (let i = 0; i < 60; i++) {
      evo_challenge_logs.push({
        id: uid('cl', i), challengeId: 'c-0', date: isoAtras(i + 1),
        increment: 1 + (i % 4), note: i % 5 === 0 ? 'Puxei assunto na fila do café' : undefined,
      });
    }

    const areas = ['Saúde', 'Trabalho', 'Relacionamentos', 'Estudos', 'Pessoal'];
    const cores = ['#a855f7', '#38bdf8', '#3ddc97', '#ffb000', '#ff4d8d', ''];
    const evo_reviews = Array.from({ length: 14 }, (_, i) => ({
      id: uid('r', i),
      date: isoAtras(i * 7 + 1),
      weekLabel: '',
      title: escolher([
        'Semana pesada mas produtiva',
        'Travei no meio da semana',
        'Melhor semana do mês',
        'Consegui manter a constância',
        'Muita coisa fora do controle',
      ], i),
      content: 'Consegui manter a academia mesmo com a semana cheia. '.repeat(1 + (i % 4)),
      area: i % 6 === 5 ? undefined : escolher(areas, i),
      color: escolher(cores, i) || undefined,
      areas: [],
      wins: '', struggles: '', insights: '',
      overallFeeling: 1 + (i % 5),
    }));

    const evo_cookies = Array.from({ length: 23 }, (_, i) => ({
      id: uid('ck', i),
      date: isoAtras(i * 5 + 2),
      description: escolher([
        'Terminei o projeto que estava travado há semanas',
        'Fui elogiado pela apresentação',
        'Consegui correr 10km sem parar',
        'Resolvi uma discussão difícil com calma',
        'Acordei cedo a semana inteira',
      ], i),
      category: i % 4 === 3 ? undefined : escolher(['Trabalho', 'Saúde', 'Pessoal'], i),
    }));

    const evo_shopping_categories = [
      { id: 'sc-0', name: 'Setup', icon: 'monitor', color: '#a855f7', createdAt: carimboAtras(60) },
      { id: 'sc-1', name: 'Academia', icon: 'dumbbell', color: '#3ddc97', createdAt: carimboAtras(50) },
      { id: 'sc-2', name: 'Casa', icon: 'home', color: '#ffb000', createdAt: carimboAtras(40) },
    ];

    const produtos = [
      ['Monitor 27" 144Hz', 1899.9, 'sc-0'], ['Teclado mecânico', 459, 'sc-0'],
      ['Cadeira ergonômica', 2350, 'sc-0'], ['Halteres ajustáveis', 890.5, 'sc-1'],
      ['Tênis de corrida', 649.99, 'sc-1'], ['Air fryer', 399, 'sc-2'],
      ['Jogo de panelas', 720, 'sc-2'], ['Fone com cancelamento', 1299, 'sc-0'],
      ['Item sem categoria', 49.9, undefined], ['Item sem preço', undefined, 'sc-2'],
    ];
    const evo_shopping = produtos.map(([nome, preco, cat], i) => ({
      id: uid('si', i),
      categoryId: cat,
      name: nome,
      price: preco,
      notes: i % 3 === 0 ? 'Esperar promoção' : undefined,
      productUrl: i % 2 === 0 ? 'https://exemplo.com/produto' : undefined,
      completed: i % 4 === 0,
      createdAt: carimboAtras(30 - i),
      completedAt: i % 4 === 0 ? carimboAtras(10 - (i % 5)) : undefined,
    }));

    const hoje = dataISO(new Date());
    const evo_actions = [
      { id: 'a-0', name: 'Marcar consulta no dentista', description: 'Convênio cobre limpeza', dueDate: isoAtras(6), completed: false, createdAt: carimboAtras(20) },
      { id: 'a-1', name: 'Pagar IPVA', dueDate: isoAtras(2), completed: false, createdAt: carimboAtras(15) },
      { id: 'a-2', name: 'Renovar CNH', dueDate: hoje, completed: false, createdAt: carimboAtras(10) },
      { id: 'a-3', name: 'Comprar presente da Ana', dueDate: dataISO(diasAtras(-3)), completed: false, createdAt: carimboAtras(5) },
      { id: 'a-4', name: 'Revisar o contrato', dueDate: dataISO(diasAtras(-20)), completed: false, createdAt: carimboAtras(3) },
      { id: 'a-5', name: 'Organizar as fotos do celular', completed: false, createdAt: carimboAtras(2) },
      { id: 'a-6', name: 'Trocar o filtro de água', completed: true, createdAt: carimboAtras(12), completedAt: carimboAtras(4) },
      { id: 'a-7', name: 'Enviar o relatório', dueDate: isoAtras(8), completed: true, createdAt: carimboAtras(18), completedAt: carimboAtras(8) },
    ];

    const evo_interacoes = Array.from({ length: 37 }, (_, i) => ({
      id: uid('in', i),
      desafioId: 'mil-interacoes',
      rating: 1 + (i % 5),
      nota: escolher(['Conversa curta mas boa', 'Travei no começo', 'Fluiu muito bem', ''], i),
      lugar: i % 3 === 0 ? escolher(['Academia', 'Café', 'Trabalho'], i) : undefined,
      tipo: i % 4 === 0 ? 'Desconhecido' : undefined,
      date: diasAtras(i * 2).toISOString(),
    }));

    return {
      evo_habits, evo_habit_logs, evo_challenges, evo_challenge_logs,
      evo_reviews, evo_cookies, evo_shopping, evo_shopping_categories,
      evo_actions, evo_interacoes,
      evo_destaques: ['h-0', 'h-1'],
    };
  }

  // ── único registro de cada ────────────────────────────────────────────
  function unico() {
    return {
      evo_habits: [{ id: 'h-0', name: 'Academia', frequency: 3, preferredDays: [1, 3, 5], color: '#3ddc97', createdAt: carimboAtras(1), order: 0 }],
      evo_habit_logs: [{ id: 'hl-0', habitId: 'h-0', date: isoAtras(0), completed: true }],
      evo_challenges: [{ id: 'c-0', name: 'Um desafio', target: 10, current: 3, unit: 'x', createdAt: carimboAtras(1) }],
      evo_challenge_logs: [{ id: 'cl-0', challengeId: 'c-0', date: isoAtras(0), increment: 3 }],
      evo_reviews: [{ id: 'r-0', date: isoAtras(0), weekLabel: '', title: 'Primeira', content: 'Texto.', areas: [], wins: '', struggles: '', insights: '', overallFeeling: 3 }],
      evo_cookies: [{ id: 'ck-0', date: isoAtras(0), description: 'Primeiro biscoito' }],
      evo_shopping: [{ id: 'si-0', name: 'Único item', completed: false, createdAt: carimboAtras(1) }],
      evo_shopping_categories: [],
      evo_actions: [{ id: 'a-0', name: 'Única ação', completed: false, createdAt: carimboAtras(1) }],
      evo_interacoes: [],
      evo_destaques: [],
    };
  }

  // ── volume ────────────────────────────────────────────────────────────
  function volume() {
    const base = realista();
    base.evo_habits = Array.from({ length: 25 }, (_, i) => ({
      id: uid('h', i), name: `Hábito número ${i + 1}`, frequency: 1 + (i % 7),
      preferredDays: i % 3 === 0 ? [1, 3, 5] : [], color: '#a855f7',
      createdAt: carimboAtras(200), order: i,
    }));
    base.evo_habit_logs = [];
    let n = 0;
    for (let dia = 0; dia < 200; dia++) {
      base.evo_habits.forEach(h => {
        if ((dia * 7 + h.order) % 3 === 0) {
          base.evo_habit_logs.push({ id: uid('hl', n++), habitId: h.id, date: isoAtras(dia), completed: true });
        }
      });
    }
    base.evo_actions = Array.from({ length: 120 }, (_, i) => ({
      id: uid('a', i), name: `Ação de teste número ${i + 1}`,
      dueDate: i % 5 === 4 ? undefined : dataISO(diasAtras(30 - i)),
      completed: i % 3 === 0, createdAt: carimboAtras(60),
      completedAt: i % 3 === 0 ? carimboAtras(5) : undefined,
    }));
    base.evo_cookies = Array.from({ length: 200 }, (_, i) => ({
      id: uid('ck', i), date: isoAtras(i * 2), description: `Conquista número ${i + 1}`,
      category: escolher(['Trabalho', 'Saúde', 'Pessoal', undefined], i),
    }));
    base.evo_shopping = Array.from({ length: 150 }, (_, i) => ({
      id: uid('si', i), name: `Produto ${i + 1}`, price: (i * 37) % 5000,
      categoryId: escolher(['sc-0', 'sc-1', 'sc-2', undefined], i),
      completed: i % 6 === 0, createdAt: carimboAtras(100),
    }));
    base.evo_reviews = Array.from({ length: 80 }, (_, i) => ({
      id: uid('r', i), date: isoAtras(i * 3), weekLabel: '',
      title: `Entrada ${i + 1}`, content: 'Texto da entrada. '.repeat(5),
      area: escolher(['Saúde', 'Trabalho', 'Estudos'], i), areas: [],
      wins: '', struggles: '', insights: '', overallFeeling: 1 + (i % 5),
    }));
    return base;
  }

  // ── extremo ───────────────────────────────────────────────────────────
  function extremo() {
    const gigante = 'Palavra '.repeat(300);
    const semEspaco = 'A'.repeat(400);
    const emoji = '🔥💪🏋️‍♂️📚✅🎯 açaí ñ ünïcödé 中文 العربية';
    const html = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    return {
      evo_habits: [
        { id: 'h-0', name: semEspaco, frequency: 7, preferredDays: [], color: '#3ddc97', createdAt: carimboAtras(10), order: 0 },
        { id: 'h-1', name: emoji, frequency: 1, preferredDays: [0], color: '#38bdf8', createdAt: carimboAtras(10), order: 1 },
        { id: 'h-2', name: html, description: gigante, frequency: 3, preferredDays: [], createdAt: carimboAtras(10), order: 2 },
        { id: 'h-3', name: 'Meta absurda', frequency: 999, preferredDays: [], dailyTarget: 100000, unit: semEspaco, createdAt: carimboAtras(10), order: 3 },
        { id: 'h-4', name: 'Frequência zero', frequency: 0, preferredDays: [], createdAt: carimboAtras(10), order: 4 },
      ],
      evo_habit_logs: [
        { id: 'hl-0', habitId: 'h-0', date: isoAtras(0), completed: true },
        { id: 'hl-1', habitId: 'h-3', date: isoAtras(0), count: 999999, completed: false },
        { id: 'hl-2', habitId: 'inexistente', date: isoAtras(0), completed: true },
        { id: 'hl-3', habitId: 'h-0', date: '2019-02-29', completed: true },
        { id: 'hl-4', habitId: 'h-0', date: 'data-invalida', completed: true },
      ],
      evo_challenges: [
        { id: 'c-0', name: gigante, target: 0, current: 50, unit: emoji, createdAt: carimboAtras(10) },
        { id: 'c-1', name: 'Negativo', target: 100, current: -30, unit: 'x', createdAt: carimboAtras(10) },
        { id: 'c-2', name: 'Estourado', target: 10, current: 999999, unit: 'x', createdAt: carimboAtras(10) },
      ],
      evo_challenge_logs: [],
      evo_reviews: [
        { id: 'r-0', date: isoAtras(0), weekLabel: '', title: semEspaco, content: gigante, area: semEspaco, color: 'não-é-cor', areas: [], wins: '', struggles: '', insights: '', overallFeeling: 99 },
        { id: 'r-1', date: 'data-invalida', weekLabel: '', title: html, content: emoji, areas: [], wins: '', struggles: '', insights: '', overallFeeling: -5 },
        { id: 'r-2', date: isoAtras(1), weekLabel: '', title: '', content: '', areas: [], wins: 'vitória antiga', struggles: 'luta antiga', insights: 'ideia antiga', overallFeeling: 3 },
      ],
      evo_cookies: [
        { id: 'ck-0', date: isoAtras(0), description: gigante, category: semEspaco },
        { id: 'ck-1', date: isoAtras(1), description: emoji },
        { id: 'ck-2', date: isoAtras(2), description: html },
      ],
      evo_shopping_categories: [
        { id: 'sc-0', name: semEspaco, color: '#a855f7', createdAt: carimboAtras(10) },
      ],
      evo_shopping: [
        { id: 'si-0', name: semEspaco, price: 999999999, categoryId: 'sc-0', completed: false, createdAt: carimboAtras(10) },
        { id: 'si-1', name: emoji, price: -50, completed: false, createdAt: carimboAtras(10) },
        { id: 'si-2', name: html, price: 0.001, notes: gigante, completed: true, createdAt: carimboAtras(10), completedAt: carimboAtras(1) },
        { id: 'si-3', name: 'Categoria fantasma', categoryId: 'nao-existe', completed: false, createdAt: carimboAtras(10) },
        { id: 'si-4', name: 'Imagem quebrada', imageUrl: 'https://exemplo.invalido/nao-existe.png', completed: false, createdAt: carimboAtras(10) },
      ],
      evo_actions: [
        { id: 'a-0', name: semEspaco, description: gigante, dueDate: isoAtras(400), completed: false, createdAt: carimboAtras(10) },
        { id: 'a-1', name: emoji, dueDate: dataISO(diasAtras(-3650)), completed: false, createdAt: carimboAtras(10) },
        { id: 'a-2', name: html, dueDate: 'data-invalida', completed: false, createdAt: carimboAtras(10) },
        { id: 'a-3', name: '', completed: false, createdAt: carimboAtras(10) },
      ],
      evo_interacoes: [],
      evo_destaques: ['h-0', 'h-1', 'h-2', 'inexistente'],
    };
  }

  // ── legado ────────────────────────────────────────────────────────────
  function legado() {
    return {
      evo_habits: [{ id: 'h-0', name: 'Hábito antigo', frequency: 3, preferredDays: [1, 3, 5], createdAt: carimboAtras(300) }],
      evo_habit_logs: [{ id: 'hl-0', habitId: 'h-0', date: isoAtras(1), completed: true }],
      evo_challenges: [],
      evo_challenge_logs: [],
      evo_reviews: [{
        id: 'r-0', date: isoAtras(3), weekLabel: 'Semana 12',
        areas: [{ name: 'Saúde', rating: 4, note: 'Boa semana' }, { name: 'Trabalho', rating: 2 }],
        wins: 'Consegui acordar cedo', struggles: 'Faltei na academia', insights: 'Preciso dormir antes',
        overallFeeling: 3,
      }],
      evo_cookies: [{ id: 'ck-0', date: isoAtras(4), description: 'Conquista antiga' }],
      evo_shopping: [{ id: 'si-0', name: 'Item antigo sem categoria', completed: false, createdAt: carimboAtras(300) }],
      evo_shopping_categories: [],
      evo_actions: [{ id: 'a-0', name: 'Ação antiga', completed: false, createdAt: carimboAtras(300) }],
      evo_interacoes: [],
      evo_destaques: [],
    };
  }

  const CENARIOS = { realista, unico, volume, extremo, legado, vazio: () => ({}) };

  global.semear = function (cenario = 'realista', recarregar = true) {
    const fn = CENARIOS[cenario];
    if (!fn) throw new Error(`Cenário desconhecido: ${cenario}. Use: ${Object.keys(CENARIOS).join(', ')}`);
    gravar(fn());
    if (recarregar) location.reload();
    return `semeado: ${cenario}`;
  };

  global.limparDados = limpar;
  global.CENARIOS_DISPONIVEIS = Object.keys(CENARIOS);
})(window);
