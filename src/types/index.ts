export interface Habit {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  frequency: number; // vezes por semana
  preferredDays: number[]; // 0=Dom, 1=Seg, ..., 6=Sáb
  color?: string;
  createdAt: string;
  archived?: boolean;
  /** Se definido, o hábito é contável no dia (ex: 6 copos de água).
   *  Conclui sozinho quando a contagem atinge a meta. */
  dailyTarget?: number;
  /** Unidade da contagem diária: "copos", "min", "páginas"… */
  unit?: string;
  /** Posição manual na lista. Menor aparece primeiro. */
  order?: number;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  /** Quantidade registrada no dia. Ausente = 1 (hábito simples). */
  count?: number;
}

export interface Challenge {
  id: string;
  name: string;
  description?: string;
  target: number;
  current: number;
  unit: string;
  color?: string;
  createdAt: string;
  completedAt?: string;
  archived?: boolean;
}

export interface ChallengeLog {
  id: string;
  challengeId: string;
  date: string;
  increment: number;
  note?: string;
}

export interface Review {
  id: string;
  date: string;
  weekLabel: string;
  areas: ReviewArea[];
  /** Título livre da entrada, estilo diário. */
  title?: string;
  /** Área/categoria da entrada — usada para filtrar a lista.
   *  Substitui as notas por área das entradas antigas. */
  area?: string;
  /** Cor escolhida para esta entrada. Tinge o card na lista e o brilho
   *  do editor. Ausente = roxo padrão do app. */
  color?: string;
  /** Texto corrido da entrada. Substitui wins/struggles/insights nas
   *  entradas novas; os campos antigos ficam para não perder histórico. */
  content?: string;
  wins: string;
  struggles: string;
  insights: string;
  overallFeeling: number; // 1-5
}

export interface ReviewArea {
  name: string;
  rating: number; // 1-5
  note?: string;
}

export interface CookieJarEntry {
  id: string;
  date: string;
  description: string;
  category?: string;
}

export interface ShoppingCategory {
  id: string;
  name: string;
  /** chave de HABIT_ICONS */
  icon?: string;
  color?: string;
  createdAt: string;
}

export interface ShoppingItem {
  id: string;
  /** ausente = "Sem categoria". Campos novos são opcionais para os
   *  itens antigos continuarem válidos sem migração. */
  categoryId?: string;
  name: string;
  /** miniatura em base64, já reduzida antes de salvar */
  imageData?: string;
  /** ou um link externo de imagem */
  imageUrl?: string;
  productUrl?: string;
  price?: number;
  /** Margem do preço, em reais: 1200 ±200. Ausente = preço exato. */
  tolerancia?: number;
  /** Quanto já foi guardado para comprar este item. */
  guardado?: number;
  notes?: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface Action {
  id: string;
  name: string;
  description?: string;
  /** Categoria de foco a que a ação pertence. Ausente = sem categoria. */
  categoriaId?: string;
  dueDate?: string;
  /** 1 baixa, 2 média, 3 alta. Ausente = sem prioridade (bandeira cinza). */
  prioridade?: 1 | 2 | 3;
  /** Posição na lista da categoria. Ausente = ordena por `createdAt`. */
  ordem?: number;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

/**
 * Registro individual dentro de um desafio (ex: uma conversa no Mil Interações).
 * Os nomes seguem o JSON exportado do site anterior para a importação ser
 * direta: `rating` é a nota de 1 a 5 e `nota` é o texto livre.
 */
export interface Interacao {
  id: string;
  desafioId: string;
  /** nota de 1 a 5 */
  rating: number;
  /** texto livre sobre como foi */
  nota: string;
  lugar?: string;
  tipo?: string;
  titulo?: string;
  /** ISO completo — guarda a hora, não só a data */
  date: string;
}

/**
 * Categoria de foco — Trabalho, Estudo, Projeto pessoal. É o eixo que
 * organiza sessões, ações e metas: cada uma tem seu próprio tempo
 * acumulado e seus próprios objetivos.
 */
export interface CategoriaDeFoco {
  id: string;
  nome: string;
  cor: string;
  /** chave de HABIT_ICONS */
  icone?: string;
  /** Meta de ritmo, em minutos por semana. UMA por frente de propósito:
   *  três metas concorrentes equivalem a nenhuma. */
  metaSemanalMinutos?: number;
  createdAt: string;
  ordem: number;
  archived?: boolean;
}

/** Um bloco de foco ou de pausa já encerrado. */
export interface SessaoDeFoco {
  id: string;
  /** ISO completo — guarda a hora, não só a data. */
  inicio: string;
  fim: string;
  /** Minutos que o bloco deveria ter. */
  minutosPlanejados: number;
  /** Segundos realmente focados, descontando o tempo pausado. */
  segundosFocados: number;
  tipo: 'foco' | 'pausa';
  /** Categoria a que o bloco pertence. Ausente = sem categoria. */
  categoriaId?: string;
  /** No que focou: ou aponta para uma ação do app, ou é só um rótulo
   *  escrito na hora. */
  actionId?: string;
  rotulo?: string;
  /** Chegou ao fim do bloco, em vez de ter sido interrompido. */
  completa: boolean;
}

/**
 * Sessão em andamento. Fica gravada à parte para o cronômetro sobreviver
 * a fechar a aba: como a contagem vem de `inicioEm`, reabrir o app
 * recupera o tempo certo em vez de começar do zero.
 */
export interface FocoEmAndamento {
  inicioEm: number;
  minutosPlanejados: number;
  tipo: 'foco' | 'pausa';
  categoriaId?: string;
  actionId?: string;
  rotulo?: string;
  /** Momento em que foi pausada, ou `null` se está correndo. */
  pausadaEm: number | null;
  /** Total já acumulado em pausa, em ms. */
  msPausados: number;
  /** Quantos blocos de foco já fechados neste ciclo — define quando cai
   *  a pausa longa. */
  ciclo: number;
}

export type Page = 'today' | 'dashboard' | 'habits' | 'challenges' | 'reviews' | 'cookies' | 'shopping' | 'actions' | 'focus';

/**
 * Metas de um trimestre e de uma semana.
 *
 * São as duas escalas escritas do planejamento multiescala: o trimestre
 * informa a semana, a semana informa os blocos do dia — que já existem
 * como sessões do cronômetro.
 *
 * Marcadores de texto, não tarefas. A lista do que fazer já é a de
 * tarefas; aqui vai o que o período precisa ENTREGAR, que é outra coisa
 * e por isso não tem caixa de marcar nem entra na fila de trabalho.
 *
 * Guardados todos, nunca sobrescritos: rever o que se pretendia ao lado
 * do que de fato aconteceu é a razão de existirem.
 */
export interface MetasDoTrimestre {
  id: string;
  categoriaId: string;
  /** Primeiro e último dia do período, em YYYY-MM-DD. Editáveis: nem todo
   *  trimestre de trabalho começa em janeiro. */
  inicio: string;
  fim: string;
  marcadores: string[];
  /** Textos de `marcadores` que você marcou como cumpridos, em retrospecto.
   *  Guardado pelo TEXTO, não pelo índice: marcar é feito no histórico, com
   *  o período já fechado, então o texto não muda mais e é a chave estável.
   *  Só se marca no histórico — a frente de trabalho não tem esse toggle. */
  cumpridas?: string[];
  atualizadoEm: string;
}

export interface MetasDaSemana {
  id?: string;
  categoriaId: string;
  /** Segunda-feira da semana, em YYYY-MM-DD. A semana vira no domingo à
   *  noite, então a chave é sempre a segunda que a abre. */
  semana: string;
  marcadores: string[];
  /** Texto livre sobre a semana: o que aconteceu, o que travou, o que
   *  mudou de plano.
   *
   *  No MESMO registro das metas, não numa tabela à parte: o histórico
   *  precisa mostrar intenção e anotação lado a lado, e cruzar duas
   *  fontes para montar uma tela só seria trabalho sem motivo. */
  observacoes?: string;
  /** Metas cumpridas em retrospecto — ver `MetasDoTrimestre.cumpridas`. */
  cumpridas?: string[];
  atualizadoEm: string;
}

/**
 * Uma história do dia — a prática de colecionar momentos.
 *
 * Deliberadamente separada de `CookieJarEntry`, apesar da forma parecida: o
 * biscoito é curado e guarda o que dá força; a história é diária e guarda
 * TUDO, inclusive o banal. Um tipo só faria as duas coisas virarem a mesma
 * coisa, e o pote perderia o sentido.
 */
export interface Historia {
  id: string;
  /** 'YYYY-MM-DD' — o dia a que a história pertence. */
  data: string;
  /** Uma ou duas frases. É snippet, não texto longo. */
  texto: string;
  createdAt: string;
}

/**
 * Um quadro de uma frente de propósito — o mapa de como se pensa aquela
 * frente. Vários por categoria.
 */
export interface Quadro {
  id: string;
  categoriaId: string;
  nome: string;
  createdAt: string;
}

/**
 * Um nó do quadro.
 *
 * Registro PRÓPRIO, e não aninhado dentro do `Quadro`, de propósito: a
 * sincronização manda o registro inteiro a cada mudança. Aninhado, editar
 * uma palavra reenviaria o quadro completo — a cada tecla, num quadro
 * grande. Separado, editar um nó manda um nó.
 */
export interface NoDeQuadro {
  id: string;
  quadroId: string;
  /** Ausente = raiz do mapa. */
  paiId?: string;
  texto: string;
  /** Posição entre os irmãos. */
  ordem: number;
  createdAt: string;
}
