import { v4 as uuid } from 'uuid';
import { dataISO, hojeISO, somarDias } from '../lib/data';
import type {
  Habit, HabitLog, Challenge, ChallengeLog,
  Review, CookieJarEntry, ShoppingItem, ShoppingCategory, Action, Interacao,
  SessaoDeFoco, FocoEmAndamento, CategoriaDeFoco,
  MetasDoTrimestre, MetasDaSemana
} from '../types';

/**
 * Lê do localStorage validando a FORMA do que voltou, não só se o JSON
 * parseia. Um valor válido mas do tipo errado — `{}` onde se espera uma
 * lista — passava direto e derrubava o app inteiro no primeiro `.map`,
 * em tela branca, sem nenhuma saída para o usuário a não ser limpar o
 * navegador. Vale mais ainda com sincronização em vista: o que vem da
 * rede não é confiável.
 */
function load<T>(key: string, fallback: T): T {
  try {
    const bruto = localStorage.getItem(key);
    if (bruto === null) return fallback;

    const valor = JSON.parse(bruto);

    if (Array.isArray(fallback)) {
      if (!Array.isArray(valor)) {
        console.warn(`[evo] "${key}" não é uma lista; ignorando o conteúdo.`);
        return fallback;
      }
      // Buraco no meio da lista quebra qualquer `.filter(x => x.id ...)`.
      return valor.filter(item => item != null) as T;
    }

    if (valor === null || typeof valor !== typeof fallback) {
      console.warn(`[evo] "${key}" veio com tipo inesperado; ignorando o conteúdo.`);
      return fallback;
    }

    return valor as T;
  } catch {
    return fallback;
  }
}

/** Último erro de gravação, para a UI conseguir avisar o usuário. */
let ultimoErroDeGravacao: string | null = null;

export function getUltimoErroDeGravacao(): string | null {
  return ultimoErroDeGravacao;
}

export function limparErroDeGravacao(): void {
  ultimoErroDeGravacao = null;
}

/**
 * Grava no localStorage. Retorna false se estourar a cota — sem isto,
 * um QuotaExceededError (provável agora que fotos são salvas) quebraria
 * a gravação em silêncio.
 */
/**
 * Avisado a cada gravação bem-sucedida, para a sincronização levar ao
 * servidor o que mudou.
 *
 * Entra por injeção e não por import direto: o store é a base de tudo, e
 * fazê-lo importar a camada de rede criaria um ciclo — a sincronização
 * precisa ler o store. Assim o store continua sem saber que rede existe.
 *
 * Vai junto o conteúdo ANTERIOR, bruto. É o que permite à sincronização
 * saber exatamente quais registros mudaram, e principalmente quais
 * sumiram: o que estava lá antes e não está agora foi excluído. Sem isso,
 * exclusão precisaria de marcação própria espalhada por todo o store — e
 * qualquer `delete` que esquecesse de marcar viraria um registro que
 * ressuscita, em silêncio.
 */
let aoGravar: ((chave: string, anterior: string | null) => void) | null = null;

export function observarGravacoes(f: (chave: string, anterior: string | null) => void): void {
  aoGravar = f;
}

function save<T>(key: string, data: T): boolean {
  try {
    const anterior = localStorage.getItem(key);
    localStorage.setItem(key, JSON.stringify(data));
    ultimoErroDeGravacao = null;
    aoGravar?.(key, anterior);
    return true;
  } catch (e) {
    const cheio =
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    ultimoErroDeGravacao = cheio
      ? 'Armazenamento cheio. Remova alguns itens com foto para liberar espaço.'
      : 'Não foi possível salvar os dados.';
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════
// Exclusões
// ══════════════════════════════════════════════════════════════════════
//
// Não há nada de especial a fazer aqui, e isso é de propósito.
//
// Houve uma versão com "lápides": cada exclusão gravava `{ id, em }` num
// documento à parte, porque a sincronização de então mesclava os dois
// aparelhos pela UNIÃO dos registros — e união não sabe apagar, então o
// hábito excluído no PC voltava da cópia do celular.
//
// A sincronização agora guarda um registro por linha no servidor, com
// `excluido` como coluna, e descobre o que sumiu comparando o documento
// com o que estava gravado antes. Exclusão virou consequência automática
// da gravação. Todo `delete*` daqui só precisa tirar da lista.

/** Tira da lista quem casa com `sai`. Não grava se nada saiu. */
function excluirDe<T extends { id: string }>(
  chave: string,
  atuais: T[],
  sai: (registro: T) => boolean,
): void {
  const ficam = atuais.filter(r => !sai(r));
  if (ficam.length === atuais.length) return;
  save(chave, ficam);
}

/** Uso aproximado do localStorage em bytes e percentual do teto de ~5MB. */
export function getUsoDoArmazenamento(): { bytes: number; percentual: number } {
  let bytes = 0;
  for (const chave of Object.keys(localStorage)) {
    if (!chave.startsWith('evo_')) continue;
    bytes += (localStorage.getItem(chave)?.length ?? 0) * 2; // UTF-16
  }
  return { bytes, percentual: Math.min(100, (bytes / (5 * 1024 * 1024)) * 100) };
}

// Habits
export function getHabits(): Habit[] {
  // ordem manual primeiro; quem não tem `order` mantém a ordem de criação
  return load<Habit[]>('evo_habits', [])
    .map((h, i) => ({ ...h, order: h.order ?? i }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Ids dos hábitos em destaque na tela Hoje (máx. 2). */
export function getDestaques(): string[] {
  return load<string[]>('evo_destaques', []);
}

export function setDestaques(ids: string[]): void {
  save('evo_destaques', ids.slice(0, 2));
}

/**
 * Quantas semanas seguidas o hábito bateu a frequência.
 * A semana corrente não quebra a sequência se ainda estiver em andamento —
 * ela só soma quando a meta já foi atingida.
 */
export function semanasSeguidas(habitId: string, frequency: number): number {
  if (frequency <= 0) return 0;
  const logs = getHabitLogs().filter(l => l.habitId === habitId && l.completed);
  if (logs.length === 0) return 0;

  // `dataISO` (local), não `toISOString`: o início da semana é meia-noite
  // local, e em fuso positivo o UTC disso cai no dia anterior — a janela
  // inteira da semana andava um dia e o hábito feito no domingo não
  // entrava na conta.
  const iso = dataISO;
  const inicioDaSemana = (d: Date) => {
    const x = new Date(d);
    const dow = (x.getDay() + 6) % 7; // segunda = 0
    x.setDate(x.getDate() - dow);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  let sequencia = 0;
  const cursor = inicioDaSemana(new Date());

  for (let i = 0; i < 260; i++) {
    const ini = new Date(cursor);
    ini.setDate(ini.getDate() - i * 7);
    const fim = new Date(ini);
    fim.setDate(fim.getDate() + 6);

    const a = iso(ini);
    const b = iso(fim);
    const feitos = logs.filter(l => l.date >= a && l.date <= b).length;

    if (feitos >= frequency) {
      sequencia++;
    } else if (i === 0) {
      continue; // semana atual ainda rolando
    } else {
      break;
    }
  }

  return sequencia;
}

/** Move um hábito uma posição para cima ou para baixo na lista. */
export function moverHabito(id: string, direcao: -1 | 1): void {
  const lista = getHabits();
  const i = lista.findIndex(h => h.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  save('evo_habits', lista.map((h, idx) => ({ ...h, order: idx })));
}

export function saveHabit(habit: Omit<Habit, 'id' | 'createdAt'> & { id?: string }): Habit {
  const habits = getHabits();
  if (habit.id) {
    const idx = habits.findIndex(h => h.id === habit.id);
    if (idx >= 0) {
      habits[idx] = { ...habits[idx], ...habit } as Habit;
      save('evo_habits', habits);
      return habits[idx];
    }
  }
  const newHabit: Habit = { ...habit, id: uuid(), createdAt: new Date().toISOString() } as Habit;
  habits.push(newHabit);
  save('evo_habits', habits);
  return newHabit;
}

export function deleteHabit(id: string): void {
  excluirDe('evo_habits', getHabits(), h => h.id === id);
  // Os registros do hábito também precisam de lápide própria: sem ela
  // voltam da cópia do outro aparelho e ficam pendurados, apontando para
  // um hábito que não existe mais.
  excluirDe('evo_habit_logs', getHabitLogs(), l => l.habitId === id);
  setDestaques(getDestaques().filter(d => d !== id));
}

// Habit Logs
export function getHabitLogs(): HabitLog[] {
  return load<HabitLog[]>('evo_habit_logs', []);
}

export function toggleHabitLog(habitId: string, date: string): HabitLog[] {
  const logs = getHabitLogs();
  const existing = logs.findIndex(l => l.habitId === habitId && l.date === date);
  if (existing >= 0) {
    if (logs[existing].completed) {
      logs.splice(existing, 1);
    } else {
      logs[existing].completed = true;
    }
  } else {
    logs.push({ id: uuid(), habitId, date, completed: true });
  }
  save('evo_habit_logs', logs);
  return logs;
}

export function getHabitLogsForDate(date: string): HabitLog[] {
  return getHabitLogs().filter(l => l.date === date);
}

/** Contagem registrada de um hábito num dia (0 se não houver registro). */
export function getHabitCount(habitId: string, date: string): number {
  const log = getHabitLogs().find(l => l.habitId === habitId && l.date === date);
  if (!log) return 0;
  return log.count ?? (log.completed ? 1 : 0);
}

/**
 * Soma (ou subtrai) na contagem do dia. Usado pelos hábitos contáveis —
 * ex: +1 copo de água. Zera o registro se a contagem chegar a 0, e marca
 * como concluído sozinho quando atinge a meta diária.
 */
export function incrementHabitCount(
  habitId: string,
  date: string,
  delta: number,
  dailyTarget?: number
): HabitLog[] {
  const logs = getHabitLogs();
  const idx = logs.findIndex(l => l.habitId === habitId && l.date === date);
  const atual = idx >= 0 ? (logs[idx].count ?? (logs[idx].completed ? 1 : 0)) : 0;
  const novo = Math.max(0, atual + delta);

  if (novo === 0) {
    if (idx >= 0) logs.splice(idx, 1);
  } else {
    const completed = dailyTarget ? novo >= dailyTarget : true;
    if (idx >= 0) {
      logs[idx].count = novo;
      logs[idx].completed = completed;
    } else {
      logs.push({ id: uuid(), habitId, date, count: novo, completed });
    }
  }

  save('evo_habit_logs', logs);
  return logs;
}

export function getHabitLogsForHabit(habitId: string): HabitLog[] {
  return getHabitLogs().filter(l => l.habitId === habitId && l.completed);
}

// Challenges
export function getChallenges(): Challenge[] {
  return load<Challenge[]>('evo_challenges', []);
}

export function saveChallenge(challenge: Omit<Challenge, 'id' | 'createdAt' | 'current'> & { id?: string; current?: number }): Challenge {
  const challenges = getChallenges();
  if (challenge.id) {
    const idx = challenges.findIndex(c => c.id === challenge.id);
    if (idx >= 0) {
      challenges[idx] = { ...challenges[idx], ...challenge } as Challenge;
      save('evo_challenges', challenges);
      return challenges[idx];
    }
  }
  const newChallenge: Challenge = {
    ...challenge,
    id: uuid(),
    current: challenge.current ?? 0,
    createdAt: new Date().toISOString(),
  } as Challenge;
  challenges.push(newChallenge);
  save('evo_challenges', challenges);
  return newChallenge;
}

export function deleteChallenge(id: string): void {
  excluirDe('evo_challenges', getChallenges(), c => c.id === id);
  excluirDe('evo_challenge_logs', getChallengeLogs(), l => l.challengeId === id);
}

export function incrementChallenge(id: string, amount: number, note?: string): Challenge | null {
  const challenges = getChallenges();
  const idx = challenges.findIndex(c => c.id === id);
  if (idx < 0) return null;
  challenges[idx].current += amount;
  if (challenges[idx].current >= challenges[idx].target && !challenges[idx].completedAt) {
    challenges[idx].completedAt = new Date().toISOString();
  }
  save('evo_challenges', challenges);

  const logs = getChallengeLogs();
  logs.push({ id: uuid(), challengeId: id, date: hojeISO(), increment: amount, note });
  save('evo_challenge_logs', logs);

  return challenges[idx];
}

export function getChallengeLogs(): ChallengeLog[] {
  return load<ChallengeLog[]>('evo_challenge_logs', []);
}

// Reviews
export function getReviews(): Review[] {
  return load<Review[]>('evo_reviews', []);
}

export function saveReview(review: Omit<Review, 'id'> & { id?: string }): Review {
  const reviews = getReviews();
  if (review.id) {
    const idx = reviews.findIndex(r => r.id === review.id);
    if (idx >= 0) {
      reviews[idx] = { ...reviews[idx], ...review } as Review;
      save('evo_reviews', reviews);
      return reviews[idx];
    }
  }
  const newReview: Review = { ...review, id: uuid() } as Review;
  reviews.push(newReview);
  save('evo_reviews', reviews);
  return newReview;
}

export function deleteReview(id: string): void {
  excluirDe('evo_reviews', getReviews(), r => r.id === id);
}

// Cookie Jar
export function getCookieJarEntries(): CookieJarEntry[] {
  return load<CookieJarEntry[]>('evo_cookies', []);
}

export function addCookieJarEntry(entry: Omit<CookieJarEntry, 'id'>): CookieJarEntry {
  const entries = getCookieJarEntries();
  const newEntry: CookieJarEntry = { ...entry, id: uuid() };
  entries.push(newEntry);
  save('evo_cookies', entries);
  return newEntry;
}

export function updateCookieJarEntry(id: string, patch: Partial<Omit<CookieJarEntry, 'id'>>): void {
  const entries = getCookieJarEntries();
  const idx = entries.findIndex(e => e.id === id);
  if (idx < 0) return;
  entries[idx] = { ...entries[idx], ...patch };
  save('evo_cookies', entries);
}

export function deleteCookieJarEntry(id: string): void {
  excluirDe('evo_cookies', getCookieJarEntries(), e => e.id === id);
}

// Shopping
export function getShoppingItems(): ShoppingItem[] {
  return load<ShoppingItem[]>('evo_shopping', []);
}

// ── Interações de desafio ──
export function getInteracoes(desafioId: string): Interacao[] {
  return load<Interacao[]>('evo_interacoes', [])
    .filter(i => i.desafioId === desafioId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function addInteracao(dados: Omit<Interacao, 'id'>): Interacao {
  const todas = load<Interacao[]>('evo_interacoes', []);
  const nova: Interacao = { ...dados, id: uuid() };
  todas.push(nova);
  save('evo_interacoes', todas);
  return nova;
}

export function updateInteracao(id: string, patch: Partial<Interacao>): void {
  const todas = load<Interacao[]>('evo_interacoes', []);
  const idx = todas.findIndex(i => i.id === id);
  if (idx >= 0) {
    todas[idx] = { ...todas[idx], ...patch };
    save('evo_interacoes', todas);
  }
}

export function deleteInteracao(id: string): void {
  excluirDe('evo_interacoes', load<Interacao[]>('evo_interacoes', []), i => i.id === id);
}

/**
 * Importa o JSON exportado do site anterior. Ignora registros com data
 * repetida para não duplicar em importações sucessivas.
 */
export function importarInteracoes(
  json: unknown,
  desafioId: string
): { importadas: number; ignoradas: number } {
  const bruto = (json as { interactions?: unknown[] })?.interactions;
  if (!Array.isArray(bruto)) throw new Error('Formato não reconhecido: falta a lista "interactions".');

  const todas = load<Interacao[]>('evo_interacoes', []);
  const jaExistem = new Set(todas.filter(i => i.desafioId === desafioId).map(i => i.date));

  let importadas = 0;
  let ignoradas = 0;

  bruto.forEach(item => {
    const r = item as Record<string, unknown>;
    const date = typeof r.date === 'string' ? r.date : null;
    if (!date || jaExistem.has(date)) { ignoradas++; return; }
    todas.push({
      id: uuid(),
      desafioId,
      rating: typeof r.rating === 'number' ? r.rating : 0,
      nota: typeof r.nota === 'string' ? r.nota : '',
      lugar: typeof r.lugar === 'string' && r.lugar ? r.lugar : undefined,
      tipo: typeof r.tipo === 'string' && r.tipo ? r.tipo : undefined,
      titulo: typeof r.titulo === 'string' && r.titulo ? r.titulo : undefined,
      date,
    });
    jaExistem.add(date);
    importadas++;
  });

  save('evo_interacoes', todas);
  return { importadas, ignoradas };
}

// ── Categorias de compras ──
export function getShoppingCategories(): ShoppingCategory[] {
  return load<ShoppingCategory[]>('evo_shopping_categories', []);
}

export function saveShoppingCategory(
  cat: Omit<ShoppingCategory, 'id' | 'createdAt'> & { id?: string }
): ShoppingCategory {
  const cats = getShoppingCategories();
  if (cat.id) {
    const idx = cats.findIndex(c => c.id === cat.id);
    if (idx >= 0) {
      cats[idx] = { ...cats[idx], ...cat } as ShoppingCategory;
      save('evo_shopping_categories', cats);
      return cats[idx];
    }
  }
  const nova: ShoppingCategory = {
    ...cat,
    id: uuid(),
    createdAt: new Date().toISOString(),
  } as ShoppingCategory;
  cats.push(nova);
  save('evo_shopping_categories', cats);
  return nova;
}

/** Exclui a categoria e solta os itens dela — nunca apaga itens junto. */
export function deleteShoppingCategory(id: string): void {
  excluirDe('evo_shopping_categories', getShoppingCategories(), c => c.id === id);
  // Os itens não são excluídos, só perdem a categoria — nada de lápide.
  const items = getShoppingItems().map(i =>
    i.categoryId === id ? { ...i, categoryId: undefined } : i
  );
  save('evo_shopping', items);
}

export function saveShoppingItem(
  item: Omit<ShoppingItem, 'id' | 'createdAt' | 'completed'> & { id?: string; completed?: boolean }
): boolean {
  const items = getShoppingItems();
  if (item.id) {
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...item } as ShoppingItem;
      return save('evo_shopping', items);
    }
  }
  items.push({
    ...item,
    id: uuid(),
    completed: item.completed ?? false,
    createdAt: new Date().toISOString(),
  } as ShoppingItem);
  return save('evo_shopping', items);
}

export function addShoppingItem(name: string): ShoppingItem {
  const items = getShoppingItems();
  const item: ShoppingItem = { id: uuid(), name, completed: false, createdAt: new Date().toISOString() };
  items.push(item);
  save('evo_shopping', items);
  return item;
}

export function toggleShoppingItem(id: string): void {
  const items = getShoppingItems();
  const item = items.find(i => i.id === id);
  if (item) {
    item.completed = !item.completed;
    item.completedAt = item.completed ? new Date().toISOString() : undefined;
  }
  save('evo_shopping', items);
}

export function deleteShoppingItem(id: string): void {
  excluirDe('evo_shopping', getShoppingItems(), i => i.id === id);
}

// ── Categorias de foco ────────────────────────────────────────────────

export function getCategoriasDeFoco(): CategoriaDeFoco[] {
  return load<CategoriaDeFoco[]>('evo_foco_categorias', [])
    .map((c, i) => ({ ...c, ordem: c.ordem ?? i }))
    .sort((a, b) => a.ordem - b.ordem);
}

export function saveCategoriaDeFoco(
  cat: Omit<CategoriaDeFoco, 'id' | 'createdAt' | 'ordem'> & { id?: string; ordem?: number }
): CategoriaDeFoco {
  const cats = getCategoriasDeFoco();
  if (cat.id) {
    const i = cats.findIndex(c => c.id === cat.id);
    if (i >= 0) {
      cats[i] = { ...cats[i], ...cat } as CategoriaDeFoco;
      save('evo_foco_categorias', cats);
      return cats[i];
    }
  }
  const nova: CategoriaDeFoco = {
    ...cat,
    id: uuid(),
    createdAt: new Date().toISOString(),
    ordem: cat.ordem ?? cats.length,
  } as CategoriaDeFoco;
  cats.push(nova);
  save('evo_foco_categorias', cats);
  return nova;
}

/** Exclui a categoria e solta o que pertencia a ela — nunca apaga
 *  sessão nem ação junto: o tempo focado é histórico, não some. */
export function deleteCategoriaDeFoco(id: string): void {
  excluirDe('evo_foco_categorias', getCategoriasDeFoco(), c => c.id === id);
  save('evo_foco_sessoes', getSessoesDeFoco().map(s =>
    s.categoriaId === id ? { ...s, categoriaId: undefined } : s
  ));
  save('evo_actions', getActions().map(a =>
    a.categoriaId === id ? { ...a, categoriaId: undefined } : a
  ));
}

// ── Foco ──────────────────────────────────────────────────────────────

export function getSessoesDeFoco(): SessaoDeFoco[] {
  return load<SessaoDeFoco[]>('evo_foco_sessoes', []);
}

export function addSessaoDeFoco(sessao: Omit<SessaoDeFoco, 'id'>): SessaoDeFoco {
  const todas = getSessoesDeFoco();
  const nova: SessaoDeFoco = { ...sessao, id: uuid() };
  todas.push(nova);
  save('evo_foco_sessoes', todas);
  return nova;
}

export function deleteSessaoDeFoco(id: string): void {
  excluirDe('evo_foco_sessoes', getSessoesDeFoco(), s => s.id === id);
}

/**
 * Sessão em andamento, gravada a cada mudança de estado (começar, pausar,
 * retomar). Não é gravada a cada segundo de propósito: a contagem sai de
 * `inicioEm`, então basta guardar os marcos.
 */
export function getFocoEmAndamento(): FocoEmAndamento | null {
  const bruto = load<FocoEmAndamento | null>('evo_foco_andamento', null);
  if (!bruto || typeof bruto.inicioEm !== 'number') return null;
  return bruto;
}

export function setFocoEmAndamento(foco: FocoEmAndamento | null): void {
  if (foco === null) {
    localStorage.removeItem('evo_foco_andamento');
    return;
  }
  save('evo_foco_andamento', foco);
}

/**
 * Se a cabine em tela cheia estava aberta. Guardado à parte do bloco: ao
 * reabrir o app, a pessoa volta exatamente onde parou — em tela cheia, se
 * era ali que ela estava.
 */
export function getCabineAberta(): boolean {
  return load<boolean>('evo_foco_cabine', false) === true;
}

export function setCabineAberta(aberta: boolean): void {
  if (aberta) save('evo_foco_cabine', true);
  else localStorage.removeItem('evo_foco_cabine');
}

/** Preferências do cronômetro. */
export interface AjustesDeFoco {
  minutosFoco: number;
  minutosPausa: number;
  minutosPausaLonga: number;
  /** Blocos de foco antes da pausa longa. */
  blocosAteAPausaLonga: number;
  som: boolean;
}

const AJUSTES_PADRAO: AjustesDeFoco = {
  minutosFoco: 25,
  minutosPausa: 5,
  minutosPausaLonga: 15,
  blocosAteAPausaLonga: 4,
  som: true,
};

export function getAjustesDeFoco(): AjustesDeFoco {
  const guardado = load<Partial<AjustesDeFoco>>('evo_foco_ajustes', {});
  // Faixas fechadas aqui e não só no input: `min`/`max` do campo não
  // seguram valor digitado à mão, e um bloco de 0 min travaria o ciclo.
  const limitar = (v: unknown, padrao: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.min(max, Math.max(min, Math.round(v)))
      : padrao;

  return {
    minutosFoco: limitar(guardado.minutosFoco, AJUSTES_PADRAO.minutosFoco, 1, 180),
    minutosPausa: limitar(guardado.minutosPausa, AJUSTES_PADRAO.minutosPausa, 1, 60),
    minutosPausaLonga: limitar(guardado.minutosPausaLonga, AJUSTES_PADRAO.minutosPausaLonga, 1, 90),
    blocosAteAPausaLonga: limitar(guardado.blocosAteAPausaLonga, AJUSTES_PADRAO.blocosAteAPausaLonga, 2, 12),
    som: guardado.som !== false,
  };
}

export function setAjustesDeFoco(ajustes: AjustesDeFoco): void {
  save('evo_foco_ajustes', ajustes);
}

// Actions
export function getActions(): Action[] {
  return load<Action[]>('evo_actions', []);
}

export function saveAction(action: Omit<Action, 'id' | 'createdAt' | 'completed'> & { id?: string; completed?: boolean }): Action {
  const actions = getActions();
  if (action.id) {
    const idx = actions.findIndex(a => a.id === action.id);
    if (idx >= 0) {
      actions[idx] = { ...actions[idx], ...action } as Action;
      save('evo_actions', actions);
      return actions[idx];
    }
  }
  const newAction: Action = {
    ...action,
    id: uuid(),
    completed: action.completed ?? false,
    createdAt: new Date().toISOString(),
  } as Action;
  actions.push(newAction);
  save('evo_actions', actions);
  return newAction;
}

export function toggleAction(id: string): void {
  const actions = getActions();
  const action = actions.find(a => a.id === id);
  if (action) {
    action.completed = !action.completed;
    action.completedAt = action.completed ? new Date().toISOString() : undefined;
  }
  save('evo_actions', actions);
}


export function deleteAction(id: string): void {
  excluirDe('evo_actions', getActions(), a => a.id === id);
}

// ══════════════════════════════════════════════════════════════════════
// Metas escritas — trimestre e semana
// ══════════════════════════════════════════════════════════════════════

/** Trimestre do calendário que contém a data, como {inicio, fim}. */
export function trimestreDe(iso: string): { inicio: string; fim: string } {
  const [ano, mes] = iso.split('-').map(Number);
  const primeiro = Math.floor((mes - 1) / 3) * 3 + 1;
  const ultimoDia = new Date(ano, primeiro + 2, 0).getDate();
  const dois = (n: number) => String(n).padStart(2, '0');
  return { inicio: `${ano}-${dois(primeiro)}-01`, fim: `${ano}-${dois(primeiro + 2)}-${dois(ultimoDia)}` };
}

export function getMetasDeTrimestre(categoriaId?: string): MetasDoTrimestre[] {
  const todas = load<MetasDoTrimestre[]>('evo_foco_metas_trimestre', []);
  const filtradas = categoriaId ? todas.filter(m => m.categoriaId === categoriaId) : todas;
  // Mais recente primeiro: é o que se quer ver ao abrir.
  return filtradas.sort((a, b) => b.inicio.localeCompare(a.inicio));
}

/** O trimestre que contém `dia`, se já houver um gravado para ele. */
export function getTrimestreVigente(categoriaId: string, dia: string): MetasDoTrimestre | null {
  return getMetasDeTrimestre(categoriaId).find(m => dia >= m.inicio && dia <= m.fim) ?? null;
}

/**
 * O período do trimestre que cobre o dia — o salvo, ou o do calendário.
 *
 * Sempre devolve alguma coisa, de propósito: é o que garante que toda
 * semana tenha uma posição ("semana 3 de 13") mesmo antes de você ter
 * escrito qualquer meta trimestral.
 */
export function periodoDoTrimestre(categoriaId: string, dia: string): { inicio: string; fim: string } {
  const salvo = getTrimestreVigente(categoriaId, dia);
  return salvo ? { inicio: salvo.inicio, fim: salvo.fim } : trimestreDe(dia);
}

/**
 * O trimestre a que uma SEMANA pertence, para numerá-la.
 *
 * Por SOBREPOSIÇÃO — qualquer dia da semana dentro do período —, não pela
 * quinta-feira. É o que faz o histórico bater com o painel: um trimestre
 * que começa no meio da semana já reivindica essa semana, então "definir o
 * início como hoje" deixa a semana atual como a nº 1 nos dois lugares. Sem
 * isto, o histórico contava a semana pela quinta-feira e, quando o início
 * caía depois dela, jogava a semana no trimestre anterior.
 *
 * Entre trimestres que se sobrepõem, ganha o de início mais recente
 * (`getMetasDeTrimestre` já vem em ordem decrescente). Sem nenhum salvo,
 * cai no trimestre de calendário da quinta-feira da semana.
 */
export function periodoDaSemana(
  categoriaId: string,
  segundaDaSemana: string
): { inicio: string; fim: string } {
  const fimDaSemana = somarDias(segundaDaSemana, 6);
  const cobre = getMetasDeTrimestre(categoriaId).find(
    m => segundaDaSemana <= m.fim && fimDaSemana >= m.inicio
  );
  return cobre ? { inicio: cobre.inicio, fim: cobre.fim } : trimestreDe(somarDias(segundaDaSemana, 3));
}

export function salvarMetasDeTrimestre(
  dados: { id?: string; categoriaId: string; inicio: string; fim: string; marcadores: string[]; cumpridas?: string[] }
): MetasDoTrimestre {
  const todas = load<MetasDoTrimestre[]>('evo_foco_metas_trimestre', []);
  const marcadores = dados.marcadores.map(m => m.trim()).filter(Boolean);

  /*
   * Sem `id`, procura um trimestre que se SOBREPONHA ao período novo e
   * atualiza esse, em vez de inserir mais um.
   *
   * Dois trimestres da mesma frente cobrindo os mesmos dias não querem
   * dizer nada — e era o que acontecia: mover o período de um trimestre
   * que não cobria hoje criava um registro novo a cada mudança, e o
   * histórico enchia de trimestres vazios. Períodos que não se tocam
   * continuam sendo registros distintos, que é o certo.
   */
  const idx = dados.id
    ? todas.findIndex(m => m.id === dados.id)
    : todas.findIndex(
        m => m.categoriaId === dados.categoriaId && dados.inicio <= m.fim && dados.fim >= m.inicio
      );

  // Preserva os `cumpridas` já marcados quando a chamada não os traz —
  // gravar o período ou os marcadores no painel não pode apagar o que foi
  // marcado como cumprido no histórico. E descarta marca órfã: cumprida
  // cujo texto saiu da lista de marcadores.
  const cumpridasBase = dados.cumpridas ?? (idx >= 0 ? todas[idx].cumpridas ?? [] : []);
  const cumpridas = cumpridasBase.filter(c => marcadores.includes(c));

  const registro: MetasDoTrimestre = {
    // Reaproveita o id do que foi encontrado por sobreposição.
    id: dados.id ?? (idx >= 0 ? todas[idx].id : uuid()),
    categoriaId: dados.categoriaId,
    inicio: dados.inicio,
    fim: dados.fim,
    marcadores,
    cumpridas: cumpridas.length ? cumpridas : undefined,
    atualizadoEm: new Date().toISOString(),
  };

  if (idx >= 0) todas[idx] = registro;
  else todas.push(registro);

  save('evo_foco_metas_trimestre', todas);
  return registro;
}

export function deleteMetasDeTrimestre(id: string): void {
  excluirDe('evo_foco_metas_trimestre', getMetasDeTrimestre(), m => m.id === id);
}

/** Marca ou desmarca uma meta do trimestre como cumprida. Só o histórico
 *  chama isto — é reflexão sobre um período fechado. */
export function alternarCumpridaTrimestre(id: string, meta: string): void {
  const todas = load<MetasDoTrimestre[]>('evo_foco_metas_trimestre', []);
  const m = todas.find(t => t.id === id);
  if (!m) return;
  const feitas = new Set(m.cumpridas ?? []);
  if (feitas.has(meta)) feitas.delete(meta); else feitas.add(meta);
  m.cumpridas = [...feitas].filter(c => m.marcadores.includes(c));
  if (!m.cumpridas.length) m.cumpridas = undefined;
  save('evo_foco_metas_trimestre', todas);
}

export function getMetasDeSemana(categoriaId?: string): MetasDaSemana[] {
  const todas = load<MetasDaSemana[]>('evo_foco_metas_semana', []);
  const filtradas = categoriaId ? todas.filter(m => m.categoriaId === categoriaId) : todas;
  return filtradas.sort((a, b) => b.semana.localeCompare(a.semana));
}

export function getMetasDaSemana(categoriaId: string, semana: string): MetasDaSemana | null {
  return getMetasDeSemana(categoriaId).find(m => m.semana === semana) ?? null;
}

/**
 * Grava metas, observações, ou só uma das duas.
 *
 * Mudança parcial: passar só `observacoes` preserva os marcadores e
 * vice-versa. Sem isso, salvar a anotação apagaria as metas da semana.
 *
 * O registro é removido quando AS DUAS partes ficam vazias — semana em
 * branco não é semana planejada, e guardá-la faria o histórico mostrar
 * uma entrada vazia como se tivesse sido escrita.
 */
export function salvarMetasDaSemana(
  categoriaId: string,
  semana: string,
  mudanca: { marcadores?: string[]; observacoes?: string; cumpridas?: string[] }
): void {
  const todas = load<MetasDaSemana[]>('evo_foco_metas_semana', []);
  const atual = todas.find(m => m.categoriaId === categoriaId && m.semana === semana);

  const marcadores = (mudanca.marcadores ?? atual?.marcadores ?? [])
    .map(m => m.trim())
    .filter(Boolean);
  const observacoes = (mudanca.observacoes ?? atual?.observacoes ?? '').trim();
  const cumpridas = (mudanca.cumpridas ?? atual?.cumpridas ?? []).filter(c => marcadores.includes(c));

  const outras = todas.filter(m => !(m.categoriaId === categoriaId && m.semana === semana));
  const id = `${categoriaId}_${semana}`;
  if (marcadores.length || observacoes) {
    outras.push({
      id,
      categoriaId, semana, marcadores,
      observacoes: observacoes || undefined,
      cumpridas: cumpridas.length ? cumpridas : undefined,
      atualizadoEm: new Date().toISOString(),
    });
  }
  save('evo_foco_metas_semana', outras);
}

/** Marca ou desmarca uma meta da semana como cumprida — só o histórico. */
export function alternarCumpridaSemana(categoriaId: string, semana: string, meta: string): void {
  const atual = getMetasDaSemana(categoriaId, semana);
  if (!atual) return;
  const feitas = new Set(atual.cumpridas ?? []);
  if (feitas.has(meta)) feitas.delete(meta); else feitas.add(meta);
  salvarMetasDaSemana(categoriaId, semana, { cumpridas: [...feitas] });
}
