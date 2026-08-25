import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play, Settings, ChartNoAxesCombined,
  ArrowLeft, Pencil, Plus, Flag, History, X,
} from 'lucide-react';
import {
  getActions, saveAction, updateAction, toggleAction, deleteAction,
  getSessoesDeFoco, addSessaoDeFoco,
  getFocoEmAndamento, setFocoEmAndamento,
  getAjustesDeFoco, setAjustesDeFoco, type AjustesDeFoco,
  getCategoriasDeFoco, saveCategoriaDeFoco, deleteCategoriaDeFoco,
  getCabineAberta, setCabineAberta,
} from '../store';
import type { FocoEmAndamento, SessaoDeFoco, Action, CategoriaDeFoco } from '../types';
import { terminou, msDecorridos, formatarDuracao, formatarDuracaoCurta, tocarAviso, tocarConclusao, tocarInicio } from '../lib/pomodoro';
import { hojeISO, somarDias, segundaDaSemana, diaLocal, horaLocal } from '../lib/data';
import { ordenarTarefas, reordenar, mudaramDeOrdem } from '../lib/tarefas';
import HabitIcon from '../components/ui/HabitIcon';
import Modal from '../components/ui/Modal';
import PilulaDeFoco from '../components/foco/PilulaDeFoco';
import TelaCheiaDeFoco from '../components/foco/TelaCheiaDeFoco';
import PainelDeMetas from '../components/foco/PainelDeMetas';
import ModalDeTarefas from '../components/foco/ModalDeTarefas';
import PainelDeDados from '../components/foco/PainelDeDados';
import PaginaDeMetas from '../components/foco/PaginaDeMetas';
import CaixaDeMarcar from '../components/foco/CaixaDeMarcar';
import LinhaDeTarefa from '../components/foco/LinhaDeTarefa';
import MenuDeTarefa from '../components/foco/MenuDeTarefa';
import { PixelLista } from '../components/foco/PixelIcons';

const SUGESTOES = [
  { nome: 'Trabalho', cor: '#38bdf8', icone: 'briefcase' },
  { nome: 'Estudo', cor: '#a855f7', icone: 'book' },
  { nome: 'Projeto pessoal', cor: '#3ddc97', icone: 'rocket' },
];

const CORES = ['#a855f7', '#38bdf8', '#3ddc97', '#ffb000', '#ff6b35', '#ff4d8d', '#00e5ff', '#c88cff'];
// Curados para frentes de trabalho, na ordem em que aparecem no seletor.
// Todas as chaves existem em HABIT_ICONS — não repetir o erro dos alvos.
const ICONES = [
  'briefcase', 'rocket', 'graduation', 'code', 'terminal', 'pen',
  'brain', 'lightbulb', 'palette', 'ruler', 'camera', 'video',
  'clapper', 'music', 'guitar', 'mic', 'languages', 'globe',
  'dumbbell', 'heart', 'sprout', 'coins', 'trending', 'science',
  'game', 'flame', 'trophy', 'target',
];

// ══════════════════════════════════════════════════════════════════════
// Hub das frentes
// ══════════════════════════════════════════════════════════════════════

/** Última frente aberta, mantida entre montagens da página (troca de aba
 *  desmonta o componente). `null` = estava no hub. */
let ultimaFrente: string | null = null;

export default function FocusPage() {
  const [categorias, setCategorias] = useState<CategoriaDeFoco[]>(() => getCategoriasDeFoco());

  /*
   * Onde a aba abre ao montar.
   *
   * Trocar de aba desmonta e remonta esta página, então a escolha é
   * refeita a cada volta. Duas regras, nesta ordem:
   *
   * 1. Bloco RODANDO (não pausado) abre direto na frente dele — o
   *    cronômetro em andamento não pode sumir de vista.
   * 2. Fora isso, volta para onde a pessoa estava (`ultimaFrente`, guardada
   *    no módulo entre montagens). Antes, QUALQUER foco em andamento —
   *    inclusive pausado ou esquecido — puxava para a frente, e voltar da
   *    aba Hoje jogava você dentro de "Trabalho" mesmo tendo saído do hub.
   *
   * Decidido no valor INICIAL, não num efeito: efeito roda depois da
   * pintura e a tela piscaria o hub antes de trocar.
   */
  const [aberto, setAbertoState] = useState<string | null>(() => {
    const emAndamento = getFocoEmAndamento();
    const rodando = emAndamento && emAndamento.pausadaEm === null && !terminou(emAndamento);
    const id = rodando ? emAndamento.categoriaId : ultimaFrente;
    return id && categorias.some(c => c.id === id) ? id : null;
  });

  // Guarda a última frente aberta para sobreviver à troca de aba.
  const setAberto = useCallback((id: string | null) => {
    ultimaFrente = id;
    setAbertoState(id);
  }, []);

  const [editando, setEditando] = useState<CategoriaDeFoco | 'nova' | null>(null);

  const modal = (
    <CategoriaModal
      alvo={editando}
      onFechar={() => setEditando(null)}
      onSalvar={dados => {
        const salva = saveCategoriaDeFoco(dados);
        setCategorias(getCategoriasDeFoco());
        setEditando(null);
        if (editando === 'nova') setAberto(salva.id);
      }}
      onExcluir={id => {
        deleteCategoriaDeFoco(id);
        setCategorias(getCategoriasDeFoco());
        setEditando(null);
        setAberto(null);
      }}
    />
  );

  // `find` em vez de `setAberto(null)` no meio do render: mudar estado
  // durante a pintura força um segundo render imediato, que é a mesma
  // classe de piscada. Frente que sumiu simplesmente cai no hub.
  const cat = aberto !== null ? categorias.find(c => c.id === aberto) : undefined;

  if (cat) {
    return (
      <EspacoDaFrente
        key={cat.id}
        categoria={cat}
        onVoltar={() => { setCategorias(getCategoriasDeFoco()); setAberto(null); }}
        onEditar={() => setEditando(cat)}

        modal={modal}
      />
    );
  }

  return (
    <>
      <Hub
        categorias={categorias.filter(c => !c.archived)}
        onAbrir={setAberto}
        onNova={() => setEditando('nova')}
        onCriarSugestao={s => {
          const nova = saveCategoriaDeFoco(s);
          setCategorias(getCategoriasDeFoco());
          setAberto(nova.id);
        }}
      />
      {modal}
    </>
  );
}

/** Retrato de uma frente: o que está aberto e o que já andou. */
function resumo(categoriaId: string) {
  const hoje = hojeISO();
  const sessoes = getSessoesDeFoco().filter(s => s.tipo === 'foco' && s.categoriaId === categoriaId);
  const acoes = getActions().filter(a => a.categoriaId === categoriaId);

  const porDia = Array.from({ length: 7 }, (_, i) => {
    const d = somarDias(hoje, -(6 - i));
    return sessoes
      .filter(s => diaLocal(s.inicio) === d)
      .reduce((soma, s) => soma + s.segundosFocados, 0);
  });

  return {
    pendentes: acoes.filter(a => !a.completed).length,
    concluidas: acoes.filter(a => a.completed).length,
    total: sessoes.reduce((soma, s) => soma + s.segundosFocados, 0),
    hoje: sessoes.filter(s => diaLocal(s.inicio) === hoje)
      .reduce((soma, s) => soma + s.segundosFocados, 0),
    porDia,
    pico: Math.max(1, ...porDia),
    ultima: sessoes.length ? sessoes.map(s => s.inicio).sort().at(-1)! : null,
  };
}

function Hub({
  categorias, onAbrir, onNova, onCriarSugestao,
}: {
  categorias: CategoriaDeFoco[];
  onAbrir: (id: string) => void;
  onNova: () => void;
  onCriarSugestao: (s: { nome: string; cor: string; icone: string }) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 md:p-6 lg:p-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Foco</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {categorias.length === 0 ? 'Crie a primeira frente de trabalho' : 'Suas frentes de trabalho'}
        </p>
      </div>

      {categorias.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6">
          <p className="text-sm leading-relaxed text-text-secondary">
            Uma frente reúne tudo de uma área: tarefas, metas e o tempo que você
            dedicou a ela. Comece por uma destas ou crie a sua.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGESTOES.map(s => (
              <button
                key={s.nome}
                onClick={() => onCriarSugestao(s)}
                className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-bg-card"
                style={{ borderColor: `color-mix(in oklab, ${s.cor} 45%, transparent)`, color: s.cor }}
              >
                <HabitIcon name={s.icone} size={14} color={s.cor} />
                {s.nome}
              </button>
            ))}
            <button
              onClick={onNova}
              className="rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:border-border-light hover:text-text-primary"
            >
              Criar a minha
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {categorias.map(c => (
              <CartaoDaFrente key={c.id} categoria={c} onAbrir={() => onAbrir(c.id)} />
            ))}
          </div>

          {/* Barra fina abaixo da grade, não um cartão vazio do mesmo
              tamanho dos outros — adicionar frente é ação rara e não
              precisa competir de igual com as frentes em si. */}
          <button
            onClick={onNova}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-[11px] uppercase tracking-[0.14em] text-text-muted transition-colors hover:border-border-light hover:text-text-secondary"
          >
            <Plus size={13} />
            Nova frente
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Tile de fliperama para escolher a frente.
 *
 * O nome vem no centro, em bitmap, com o ícone ao lado — como o título de
 * um jogo na tela de seleção. Moldura de visor, brilho de fósforo na cor
 * da frente e o mostrador aceso: apertar tem que dar a sensação de
 * "agora eu vou focar", não de abrir mais um cartão de app.
 *
 * O brilho e o realce vêm por estado, não por `:hover` no CSS, porque a
 * cor é de cada frente e `color-mix` com variável no `:hover` não resolve
 * de forma confiável.
 */
function CartaoDaFrente({ categoria, onAbrir }: { categoria: CategoriaDeFoco; onAbrir: () => void }) {
  const r = resumo(categoria.id);
  const cor = categoria.cor;
  const [aceso, setAceso] = useState(false);

  // Título na cor da frente clareada — lê como letreiro ligado, não como
  // texto branco comum.
  const corTitulo = `color-mix(in oklab, ${cor} 32%, white)`;

  const canto = 'pointer-events-none absolute h-4 w-4';
  const corCanto = `color-mix(in oklab, ${cor} ${aceso ? 55 : 40}%, transparent)`;

  return (
    <button
      onClick={onAbrir}
      onMouseEnter={() => setAceso(true)}
      onMouseLeave={() => setAceso(false)}
      onFocus={() => setAceso(true)}
      onBlur={() => setAceso(false)}
      // Realce contido de propósito: sem salto, sem halo forte. Ao apontar,
      // só a borda firma um pouco e o fundo aquece de leve — o brilho de
      // fliperama cheio virava agitação a cada passada de mouse.
      className="crt-scanlines group relative flex min-h-[11rem] w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border p-5 text-center transition-[border-color,background-color] duration-200"
      style={{
        borderColor: aceso
          ? `color-mix(in oklab, ${cor} 55%, var(--color-border))`
          : `color-mix(in oklab, ${cor} 28%, var(--color-border))`,
        backgroundColor: aceso ? 'var(--color-bg-card-hover)' : 'var(--color-bg-card)',
        backgroundImage: `radial-gradient(ellipse 80% 62% at 50% 42%, color-mix(in oklab, ${cor} ${aceso ? 11 : 8}%, transparent), transparent 72%)`,
      }}
    >
      {/* Quatro quinas de visor. */}
      <span aria-hidden>
        <span className={`${canto} left-2.5 top-2.5 border-l border-t`} style={{ borderColor: corCanto }} />
        <span className={`${canto} right-2.5 top-2.5 border-r border-t`} style={{ borderColor: corCanto }} />
        <span className={`${canto} bottom-2.5 left-2.5 border-b border-l`} style={{ borderColor: corCanto }} />
        <span className={`${canto} bottom-2.5 right-2.5 border-b border-r`} style={{ borderColor: corCanto }} />
      </span>

      {/* ── Letreiro: só o nome, no centro ──
          O ícone saiu: um lucide grande ao lado do nome dava cara de
          template, e o nome sozinho, em bitmap e aceso, é o letreiro. */}
      <h2
        className="font-arcade relative max-w-full text-[0.95rem] uppercase leading-[1.6]"
        style={{ color: corTitulo, textShadow: `0 0 9px color-mix(in oklab, ${cor} 28%, transparent)` }}
      >
        {categoria.nome}
      </h2>

      {/* ── Placar: tempo acumulado, como pontuação de fliperama ──
          A hora total que você já pôs na frente é o "high score" dela —
          um número que só cresce, e é o que dá a sensação de progresso ao
          bater o olho. */}
      <div className="relative mt-6 flex w-full max-w-[13rem] flex-col items-center gap-2.5">
        <div className="flex h-4 w-full items-end justify-center gap-1">
          {r.porDia.map((seg, i) => (
            <div
              key={i}
              className="flex-1 rounded-[1px]"
              style={{
                height: seg > 0 ? `${Math.max(18, (seg / r.pico) * 100)}%` : '2px',
                backgroundColor: seg > 0
                  ? `color-mix(in oklab, ${cor} ${i === 6 ? 100 : 45}%, transparent)`
                  : 'var(--color-border)',
              }}
            />
          ))}
        </div>

        {r.total > 0 ? (
          <p className="flex items-baseline gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.2em] text-text-muted">total</span>
            <span className="font-arcade text-[0.62rem] leading-none" style={{ color: cor }}>
              {formatarDuracaoCurta(r.total)}
            </span>
          </p>
        ) : (
          <p className="text-[11px] text-text-muted">pronto para começar</p>
        )}
      </div>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Espaço de uma frente
// ══════════════════════════════════════════════════════════════════════

function EspacoDaFrente({
  categoria, onVoltar, onEditar, modal,
}: {
  categoria: CategoriaDeFoco;
  onVoltar: () => void;
  onEditar: () => void;


  modal: React.ReactNode;
}) {
  const cor = categoria.cor;

  // Mesma razão do `aberto` no hub: com `null` inicial, o primeiro quadro
  // saía sem a pílula do cronômetro e o segundo a trazia — o rodapé
  // piscava a cada entrada na frente. Bloco já vencido continua no efeito
  // abaixo, porque ali há gravação a fazer, não só leitura.
  const [foco, setFoco] = useState<FocoEmAndamento | null>(() => {
    const guardado = getFocoEmAndamento();
    return guardado && !terminou(guardado) ? guardado : null;
  });
  const [sessoes, setSessoes] = useState<SessaoDeFoco[]>(() => getSessoesDeFoco());
  const [acoes, setAcoes] = useState<Action[]>(() => getActions());
  const [ajustes, setAjustes] = useState<AjustesDeFoco>(() => getAjustesDeFoco());
  const [ajustesAbertos, setAjustesAbertos] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [historicoAberto, setHistoricoAberto] = useState(false);
  // Uma página por vez. Com um booleano por página, abrir duas ao mesmo
  // tempo é um estado possível que não deveria existir.
  const [pagina, setPagina] = useState<'frente' | 'dados' | 'metas'>('frente');

  // A cabine é estado salvo, não só de tela: fechar o app em tela cheia e
  // reabrir tem que devolver a tela cheia, com o mesmo bloco correndo.
  const [cabineAberta, definirCabine] = useState(() => getCabineAberta() && !!getFocoEmAndamento());
  const abrirCabine = useCallback((aberta: boolean) => {
    definirCabine(aberta);
    setCabineAberta(aberta);
  }, []);

  // Só força o repintar. Os números saem de Date.now() a cada render — o
  // tique nunca é a fonte da verdade.
  const [, setTique] = useState(0);
  const repintar = useCallback(() => setTique(t => t + 1), []);

  // Menu de contexto: qual tarefa e onde. Um só de cada vez — dois abertos
  // é um estado que não deveria existir.
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  // Arrasto: de quem, e sobre quem está agora.
  const [arrasto, setArrasto] = useState<{ de: string; sobre: string } | null>(null);

  const daFrente = acoes.filter(a => a.categoriaId === categoria.id);
  const pendentes = ordenarTarefas(daFrente.filter(a => !a.completed));
  const concluidas = daFrente.filter(a => a.completed);

  const acaoDoMenu = menu ? pendentes.find(a => a.id === menu.id) ?? null : null;

  /** Grava o vencimento. `undefined` limpa ("Algum dia"). */
  const definirVencimento = useCallback((id: string, dia: string | undefined) => {
    updateAction(id, { dueDate: dia });
    setAcoes(getActions());
  }, []);

  /** Grava a prioridade. `undefined` limpa (bandeira cinza). */
  const definirPrioridade = useCallback((id: string, p: 1 | 2 | 3 | undefined) => {
    updateAction(id, { prioridade: p });
    setAcoes(getActions());
  }, []);

  /**
   * Solta a tarefa arrastada na posição da que está sob o cursor.
   *
   * Renumera a lista visível e grava só as que de fato mudaram de posição —
   * `mudaramDeOrdem` existe para isso. Gravar as inalteradas encheria a fila
   * de sincronização de linhas idênticas.
   */
  const soltarTarefa = useCallback(() => {
    setArrasto(atual => {
      if (!atual) return null;
      const nova = reordenar(pendentes, atual.de, atual.sobre);
      for (const t of mudaramDeOrdem(pendentes, nova)) {
        updateAction(t.id, { ordem: t.ordem });
      }
      setAcoes(getActions());
      return null;
    });
  }, [pendentes]);

  const registrar = useCallback((s: FocoEmAndamento, completa: boolean) => {
    const teto = s.minutosPlanejados * 60_000;
    const segundos = Math.round(Math.min(msDecorridos(s), teto) / 1000);
    // Piso de 5s, não 30: encerrar antes da hora tem que contabilizar o
    // tempo feito. O piso existe só para descartar clique errado — apertar
    // play e parar em seguida não é uma sessão.
    if (segundos < 5) return null;

    const nova = addSessaoDeFoco({
      inicio: new Date(s.inicioEm).toISOString(),
      fim: new Date().toISOString(),
      minutosPlanejados: s.minutosPlanejados,
      segundosFocados: segundos,
      tipo: s.tipo,
      categoriaId: s.categoriaId,
      actionId: s.actionId,
      rotulo: s.rotulo,
      completa,
    });
    setSessoes(getSessoesDeFoco());
    return nova;
  }, []);

  // Bloco que venceu com o app fechado: fecha agora com o tempo planejado,
  // senão o cronômetro voltaria parado em 00:00. Retomar o que AINDA está
  // correndo é feito no valor inicial de `foco`, acima — aqui só fica o
  // caso que grava sessão, que não pode acontecer durante o render.
  const jaRetomou = useRef(false);
  useEffect(() => {
    if (jaRetomou.current) return;
    jaRetomou.current = true;
    const guardado = getFocoEmAndamento();
    if (!guardado || !terminou(guardado)) return;

    registrar(guardado, true);
    setFocoEmAndamento(null);
    // Fecha a cabine também por aqui. São DOIS caminhos de fim de bloco:
    // o natural, com o app aberto, e este — o bloco venceu enquanto o app
    // estava fechado. Fechar só no primeiro deixava a tela cheia aberta
    // em cima do cartão de encerramento, que fica na página.
    abrirCabine(false);
  }, [registrar, abrirCabine]);

  useEffect(() => {
    if (!foco || foco.pausadaEm !== null) return;
    const id = window.setInterval(repintar, 1000);
    return () => window.clearInterval(id);
  }, [foco, repintar]);

  // O tique é estrangulado em segundo plano: voltar à aba repinta na hora.
  useEffect(() => {
    const aoVoltar = () => { if (!document.hidden) repintar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, [repintar]);

  useEffect(() => {
    if (!foco || foco.pausadaEm !== null || !terminou(foco)) return;
    registrar(foco, true);
    setFocoEmAndamento(null);
    setFoco(null);
    if (ajustes.som) tocarAviso();
    // Fecha a cabine no fim do bloco: o cartão de encerramento — com o
    // "o que avançou?" e a descoberta do marco — vive na página, e é o
    // momento em que ele mais importa.
    abrirCabine(false);
  });

  // ── Comandos ────────────────────────────────────────────────────────
  function iniciar(alvo: { actionId?: string; rotulo?: string }, tipo: 'foco' | 'pausa' = 'foco', ciclo = 0) {
    const minutos =
      tipo === 'foco' ? ajustes.minutosFoco
      : ciclo > 0 && ciclo % ajustes.blocosAteAPausaLonga === 0 ? ajustes.minutosPausaLonga
      : ajustes.minutosPausa;

    const novo: FocoEmAndamento = {
      inicioEm: Date.now(),
      minutosPlanejados: minutos,
      tipo,
      categoriaId: categoria.id,
      ...(tipo === 'foco' ? alvo : {}),
      pausadaEm: null,
      msPausados: 0,
      ciclo,
    };
    setFocoEmAndamento(novo);
    setFoco(novo);
    if (ajustes.som) tocarInicio();
  }

  function pausar() {
    if (!foco || foco.pausadaEm !== null) return;
    const novo = { ...foco, pausadaEm: Date.now() };
    setFocoEmAndamento(novo); setFoco(novo);
  }

  function retomar() {
    if (!foco || foco.pausadaEm === null) return;
    const novo = { ...foco, msPausados: foco.msPausados + (Date.now() - foco.pausadaEm), pausadaEm: null };
    setFocoEmAndamento(novo); setFoco(novo);
  }

  /** Encerra antes da hora — o tempo já feito conta. */
  function parar() {
    if (!foco) return;
    registrar(foco, false);
    setFocoEmAndamento(null);
    setFoco(null);
  }

  function alternarTarefa(id: string) {
    const estavaAberta = !acoes.find(a => a.id === id)?.completed;
    toggleAction(id);
    setAcoes(getActions());
    // Só ao CONCLUIR. Reabrir uma tarefa não é conquista nenhuma.
    if (estavaAberta && ajustes.som) tocarConclusao();
  }

  /**
   * Play de uma tarefa: abre a cabine e começa a focar nela.
   *
   * Funciona SEMPRE, inclusive com outro bloco correndo — antes o botão
   * ficava desabilitado nesse caso, a 20% de opacidade, e clicar não fazia
   * nada. Como o bloco sobrevive a fechar o app, bastava ter um em
   * andamento para todos os plays estarem mortos sem explicar por quê.
   *
   * Trocar de tarefa grava o bloco atual com o tempo já feito (nada se
   * perde) e começa um novo. Um bloco, uma tarefa — trabalhar em duas ao
   * mesmo tempo não é foco.
   */
  function focarNaTarefa(id: string) {
    if (foco?.actionId === id) { abrirCabine(true); return; }
    if (foco) registrar(foco, false);
    iniciar({ actionId: id });
    abrirCabine(true);
  }

  function criarTarefa() {
    const nome = novaTarefa.trim();
    if (!nome) return;
    saveAction({ name: nome, categoriaId: categoria.id });
    setNovaTarefa('');
    setAcoes(getActions());
  }

  // ── Números ─────────────────────────────────────────────────────────
  const nomeDoAlvo = useCallback((s: { actionId?: string; rotulo?: string }): string => {
    if (s.actionId) return acoes.find(a => a.id === s.actionId)?.name ?? 'Tarefa removida';
    return s.rotulo || 'Foco livre';
  }, [acoes]);

  const m = useMemo(() => {
    const hoje = hojeISO();
    const minhas = sessoes.filter(s => s.tipo === 'foco' && s.categoriaId === categoria.id);
    const doDia = minhas.filter(s => diaLocal(s.inicio) === hoje);
    // Janela móvel em vez de sequência: perder um dia não "quebra" nada.
    const dias30 = new Set(
      minhas.filter(s => diaLocal(s.inicio) >= somarDias(hoje, -29)).map(s => diaLocal(s.inicio))
    );
    // Semana de calendário (segunda a domingo), não sete dias móveis: o
    // plano é semanal, e as duas contagens têm que bater.
    const segAtual = segundaDaSemana(hoje);
    const segAnterior = somarDias(segAtual, -7);
    const dentroDe = (s: SessaoDeFoco, inicio: string) => {
      const d = diaLocal(s.inicio);
      return d >= inicio && d <= somarDias(inicio, 6);
    };
    const daSemanaCorrente = minhas.filter(s => dentroDe(s, segAtual));
    const daSemanaAnterior = minhas.filter(s => dentroDe(s, segAnterior));

    const porDia = new Map<string, number>();
    minhas.forEach(s => {
      const d = diaLocal(s.inicio);
      porDia.set(d, (porDia.get(d) ?? 0) + s.segundosFocados);
    });

    return {
      hojeSegundos: doDia.reduce((soma, s) => soma + s.segundosFocados, 0),
      hojeBlocos: doDia.filter(s => s.completa).length,
      semanaSegundos: daSemanaCorrente.reduce((soma, s) => soma + s.segundosFocados, 0),
      semanaAnteriorSegundos: daSemanaAnterior.reduce((soma, s) => soma + s.segundosFocados, 0),
      blocosSemanaAnterior: daSemanaAnterior.filter(s => s.completa).length,
      totalSegundos: minhas.reduce((soma, s) => soma + s.segundosFocados, 0),
      recordeNoDia: Math.max(0, ...porDia.values()),
      diasEm30: dias30.size,
      minhas,
      doDia: [...doDia].sort((a, b) => b.inicio.localeCompare(a.inicio)),
    };
  }, [sessoes, categoria.id]);

  const rodando = !!foco && foco.pausadaEm === null;

  /** Quanto já foi focado em cada tarefa — preenche o vão da linha. */
  const tempoPorTarefa = useMemo(() => {
    const mapa = new Map<string, number>();
    sessoes.forEach(s => {
      if (s.tipo !== 'foco' || !s.actionId) return;
      mapa.set(s.actionId, (mapa.get(s.actionId) ?? 0) + s.segundosFocados);
    });
    return mapa;
  }, [sessoes]);

  const painel = (
    <PainelDeMetas categoria={categoria} segundosDaSemana={m.semanaSegundos} />
  );

  /*
   * Cronômetro, cabine e modais ficam FORA do que troca de tela.
   *
   * O painel de dados substitui só o miolo da página. Se ele substituísse
   * o componente inteiro, a pílula do rodapé desmontaria junto e um bloco
   * correndo sumiria de vista exatamente enquanto a pessoa olha os
   * gráficos — que é quando ela mais fica ali parada.
   */
  const permanentes = (
    <>
      <PilulaDeFoco
        foco={foco}
        minutosPadrao={ajustes.minutosFoco}
        cor={cor}
        onAbrir={() => abrirCabine(true)}
        onIniciar={() => { iniciar({}); abrirCabine(true); }}
        onPausar={pausar}
        onRetomar={retomar}
      />

      <TelaCheiaDeFoco
        aberta={cabineAberta}
        categoria={categoria}
        foco={foco}
        minutosPadrao={ajustes.minutosFoco}
        alvo={foco ? nomeDoAlvo(foco) : null}
        tarefas={daFrente}
        actionIdAtual={foco?.actionId}
        segundosHoje={m.hojeSegundos}
        recordeSegundos={m.recordeNoDia}
        onFechar={() => abrirCabine(false)}
        onIniciar={id => iniciar(id ? { actionId: id } : {})}
        onPausar={pausar}
        onRetomar={retomar}
        onParar={() => { parar(); abrirCabine(false); }}
        onAlternarTarefa={alternarTarefa}
      />

      <ModalDeTarefas
        aberto={historicoAberto}
        categoria={categoria}
        tarefas={daFrente}
        tempoPorTarefa={tempoPorTarefa}
        onFechar={() => setHistoricoAberto(false)}
        onAlternar={alternarTarefa}
        onExcluir={id => { deleteAction(id); setAcoes(getActions()); }}
      />

      <AjustesModal
        aberto={ajustesAbertos}
        ajustes={ajustes}
        onFechar={() => setAjustesAbertos(false)}
        onSalvar={a => { setAjustes(a); setAjustesDeFoco(a); setAjustesAbertos(false); }}
      />
      {modal}
    </>
  );

  if (pagina === 'dados') {
    return (
      <>
        <PainelDeDados
          categoria={categoria}
          sessoes={sessoes}
          acoes={acoes}
          onVoltar={() => setPagina('frente')}
        />
        {permanentes}
      </>
    );
  }

  if (pagina === 'metas') {
    return (
      <>
        <PaginaDeMetas
          categoria={categoria}
          sessoes={sessoes}
          acoes={acoes}
          onVoltar={() => setPagina('frente')}
        />
        {permanentes}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 gap-8 p-4 pb-32 md:p-6 md:pb-32 lg:flex lg:p-8 lg:pb-32 animate-fade-in">
      {/* Coluna do trabalho */}
      <div className="min-w-0 flex-1 space-y-6">
      {/* ── Barra de sistema ── */}
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <button
          onClick={onVoltar}
          className="alvo-toque font-arcade flex flex-shrink-0 items-center gap-2 text-[0.45rem] uppercase text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={13} />
          <span className="hidden sm:inline">frentes</span>
        </button>

        <span className="hidden flex-1 items-center gap-3 sm:flex" style={{ color: cor }}>
          <span className="filete flex-1" />
          <span className="font-arcade flex items-center gap-2 text-[0.45rem] uppercase text-text-secondary">
            <HabitIcon name={categoria.icone} size={11} color={cor} />
            {categoria.nome}
          </span>
          <span className="filete flex-1" />
        </span>

        {/* No celular o nome não cabe no meio: vira título à esquerda. */}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 sm:hidden">
          <HabitIcon name={categoria.icone} size={13} color={cor} />
          <span className="truncate text-sm font-semibold text-text-primary">{categoria.nome}</span>
        </span>

        <span
          className="font-arcade flex flex-shrink-0 items-center gap-2 text-[0.45rem] uppercase"
          style={{ color: rodando ? cor : 'var(--color-text-muted)' }}
        >
          <span
            className={`h-1.5 w-1.5 ${rodando ? 'ponto-status' : ''}`}
            style={{
              background: rodando ? cor : 'var(--color-border-light)',
              boxShadow: rodando ? `0 0 8px ${cor}` : 'none',
            }}
          />
          <span className="hidden sm:inline">{rodando ? 'ativo' : 'parado'}</span>
        </span>

        {/* Só no celular e tablet: em tela larga o painel é coluna fixa. */}
        <button
          onClick={() => setPainelAberto(true)}
          aria-label="Abrir metas"
          className="botao-icone text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary lg:hidden"
        >
          <Flag size={15} />
        </button>
        <button
          onClick={onEditar}
          aria-label="Editar frente"
          className="botao-icone text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => setAjustesAbertos(true)}
          aria-label="Ajustes do cronômetro"
          className="botao-icone text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
        >
          <Settings size={15} />
        </button>
        <button
          onClick={() => setPagina('dados')}
          aria-label="Abrir painel de dados"
          title="Painel de dados"
          className="botao-icone transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = cor; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
        >
          <ChartNoAxesCombined size={16} />
        </button>
        <button
          onClick={() => setPagina('metas')}
          aria-label="Abrir metas e histórico"
          title="Metas e histórico"
          className="botao-icone transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = cor; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
        >
          <History size={16} />
        </button>
      </div>

      {/* ── Placares ──
          Objetivo, meta de horas e trilha saíram daqui: são horizonte, e
          horizonte agora mora no painel. Aqui fica só o dia. */}
      <div className="relative px-2 py-2">
        <CantosDeMoldura cor={cor} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Placar rotulo="Hoje" valor={formatarDuracaoCurta(m.hojeSegundos)} cor={cor} />
          <Placar rotulo="Tempo total" valor={formatarDuracaoCurta(m.totalSegundos)} cor={cor} />
          <Placar rotulo="Abertas" valor={String(pendentes.length)} cor={cor} />
          <Placar rotulo="Concluídas" valor={String(concluidas.length)} cor={cor} />
        </div>
      </div>

      {/* ── Tarefas ── */}
      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: cor }}>
            Tarefas
          </h2>
          <div className="h-px flex-1 bg-border" />

          {/* A lista da página é sobre o que fazer agora. O que já foi feito
              vive no histórico, atrás deste ícone — encher a lista de
              concluídas transforma trabalho em arquivo morto. */}
          <button
            onClick={() => setHistoricoAberto(true)}
            aria-label="Abrir histórico de tarefas"
            title="Histórico de tarefas"
            className="alvo-toque flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
          >
            <PixelLista cor={cor} />
          </button>
        </div>

        {/* `label`, não `div`: o respiro é do contêiner, então o input em si
            tem 20px de altura e tocar em volta do texto não focaria. */}
        <label
          className="mb-2 flex cursor-text items-center gap-2.5 rounded-xl border-solid bg-bg-input px-4 py-3 transition-colors focus-within:border-border-light"
          style={{ borderWidth: 2, borderColor: 'var(--color-border)' }}
        >
          <Plus size={15} className="flex-shrink-0 text-text-muted" />
          <input
            type="text"
            value={novaTarefa}
            onChange={e => setNovaTarefa(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') criarTarefa(); }}
            placeholder="Adicionar uma tarefa e apertar Enter"
            // Mesma fonte da linha que ele cria: digitar numa fonte e ver
            // o resultado em outra é um degrau desnecessário.
            className="font-terminal w-full bg-transparent text-[17px] leading-[1.35] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </label>

        <div>
          {pendentes.map((a, i) => {
            // De onde o fio de destino aparece: acima quando a linha
            // arrastada vem de baixo, abaixo quando vem de cima.
            const alvo = arrasto?.sobre === a.id && arrasto.de !== a.id;
            const deIndice = arrasto ? pendentes.findIndex(x => x.id === arrasto.de) : -1;

            return (
              <LinhaDeTarefa
                key={a.id}
                acao={a}
                cor={cor}
                focando={foco?.actionId === a.id}
                segundosFocados={tempoPorTarefa.get(a.id) ?? 0}
                arrastada={arrasto?.de === a.id}
                indicador={alvo ? (deIndice > i ? 'acima' : 'abaixo') : null}
                onAlternar={() => alternarTarefa(a.id)}
                onFocar={() => focarNaTarefa(a.id)}
                onMenu={(x, y) => setMenu({ id: a.id, x, y })}
                onIniciarArrasto={() => setArrasto({ de: a.id, sobre: a.id })}
                onArrastarSobre={() => setArrasto(at => (at && at.sobre !== a.id ? { ...at, sobre: a.id } : at))}
                onSoltar={soltarTarefa}
                onTerminarArrasto={() => setArrasto(null)}
              />
            );
          })}

          {pendentes.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
              {daFrente.length === 0 ? 'Nenhuma tarefa nesta frente ainda.' : 'Tudo em dia por aqui.'}
            </p>
          )}

        </div>

        {acaoDoMenu && menu && (
          <MenuDeTarefa
            acao={acaoDoMenu}
            posicao={{ x: menu.x, y: menu.y }}
            cor={cor}
            onVencimento={dia => definirVencimento(menu.id, dia)}
            onPrioridade={p => definirPrioridade(menu.id, p)}
            onExcluir={() => { deleteAction(menu.id); setAcoes(getActions()); }}
            onFechar={() => setMenu(null)}
          />
        )}
      </section>

      {/* ── Blocos de hoje ── */}
      {m.doDia.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: cor }}>
              Blocos de hoje
            </h2>
            <div className="h-px flex-1 bg-border" />
            <span className="font-arcade text-[0.55rem] text-text-muted">
              {formatarDuracao(m.hojeSegundos)}
            </span>
          </div>

          <div>
            {m.doDia.map(s => (
              // `items-baseline`, não `items-start` com um `mt-0.5` de
              // chute: são três fontes diferentes na mesma linha (bitmap na
              // hora, terminal no nome, mono na duração) e alinhá-las pelo
              // TOPO da caixa deixa cada uma numa altura, porque cada fonte
              // ocupa a caixa de um jeito. A linha de base é a única
              // referência que as três compartilham.
              <div key={s.id} className="mb-2 flex items-baseline gap-3 rounded-xl border border-border bg-bg-card px-4 py-2.5 last:mb-0">
                <span className="font-arcade flex-shrink-0 text-[0.5rem] text-text-muted">{horaLocal(s.inicio)}</span>
                {/* Filho DIRETO do flex, sem invólucro: a base de um item de
                    flex que é bloco vem da caixa de linha dele, e o `div`
                    que havia aqui punha uma caixa a mais entre o texto e o
                    alinhamento. Mesma fonte da lista de tarefas — é o mesmo
                    nome, e ler o mesmo texto em duas fontes denuncia. */}
                <span className="font-terminal min-w-0 flex-1 truncate text-[17px] leading-[1.35] text-text-primary">
                  {nomeDoAlvo(s)}
                </span>
                <span
                  className="flex-shrink-0 text-xs font-semibold tabular-nums"
                  style={{ color: s.completa ? cor : 'var(--color-text-muted)' }}
                >
                  {formatarDuracao(s.segundosFocados)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {permanentes}
      </div>

      {/* Coluna de metas em tela larga */}
      <aside className="hidden w-72 flex-shrink-0 lg:block">
        <div className="sticky top-8">{painel}</div>
      </aside>

      {/* Gaveta no celular. Sempre montada, animando por opacidade e
          deslocamento — aparecer de estalo é o que a gente não faz aqui. */}
      <div
        onClick={() => setPainelAberto(false)}
        className={`fixed inset-0 z-[95] bg-black/60 transition-opacity duration-200 lg:hidden ${
          painelAberto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden
      />
      <div
        className={`fixed inset-y-0 left-0 z-[96] w-[19rem] max-w-[88vw] rolagem-limpa border-r border-border bg-bg-secondary p-5 transition-transform duration-250 ease-out lg:hidden ${
          painelAberto ? 'translate-x-0' : 'pointer-events-none -translate-x-full'
        }`}
        role="dialog"
        aria-label="Metas da frente"
      >
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.3em] text-text-muted">Metas</span>
          <button
            onClick={() => setPainelAberto(false)}
            aria-label="Fechar metas"
            className="alvo-toque text-text-muted transition-colors hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>
        {painel}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Peças
// ══════════════════════════════════════════════════════════════════════

/** Quatro cantos de visor. Só as quinas, nunca a moldura inteira — a
 *  caixa fechada vira mais uma borda concorrendo com as dos cartões. */
function CantosDeMoldura({ cor }: { cor: string }) {
  const borda = `color-mix(in oklab, ${cor} 45%, transparent)`;
  const comum = 'pointer-events-none absolute h-2.5 w-2.5';
  return (
    <span aria-hidden>
      <span className={`${comum} left-0 top-0 border-l border-t`} style={{ borderColor: borda }} />
      <span className={`${comum} right-0 top-0 border-r border-t`} style={{ borderColor: borda }} />
      <span className={`${comum} bottom-0 left-0 border-b border-l`} style={{ borderColor: borda }} />
      <span className={`${comum} bottom-0 right-0 border-b border-r`} style={{ borderColor: borda }} />
    </span>
  );
}

/**
 * Leitura de instrumento, não cartão colorido.
 *
 * O número em cor cheia deixava quatro manchas roxas lado a lado e puxava
 * a tela para o lado infantil. A identidade fica na estrutura — marca de
 * canal na borda, rótulo em micro-caixa-alta espaçada, número sóbrio em
 * tabular — e a cor entra só como sinalização, num filete de 1px.
 */
function Placar({
  rotulo, valor, cor, progresso,
}: { rotulo: string; valor: string; cor: string; progresso?: number }) {
  return (
    <div
      className="rounded-lg border px-4 py-3"
      style={{
        // A identidade vem da PRÓPRIA borda: o topo puxa a cor da frente e
        // as outras três ficam neutras. Quatro cartões lado a lado viram
        // uma fileira de canais, como réguas de console.
        //
        // O filete que existia aqui antes era um elemento solto encostado
        // na borda — com `overflow-hidden` a curva do canto o cortava e ele
        // virava um traço que não alcançava as pontas.
        borderColor: 'var(--color-border)',
        borderTopColor: `color-mix(in oklab, ${cor} 45%, var(--color-border))`,
        backgroundColor: 'var(--color-bg-card)',
        // Tinta descendo do topo + fio de luz na aresta de cima: é o que dá
        // relevo sem precisar de sombra colorida em volta.
        backgroundImage: `linear-gradient(180deg, color-mix(in oklab, ${cor} 7%, transparent), transparent 45%)`,
        boxShadow: `inset 0 1px 0 color-mix(in oklab, ${cor} 18%, transparent)`,
      }}
    >
      <p className="text-[9px] uppercase tracking-[0.28em] text-text-muted">{rotulo}</p>
      {/* Press Start 2P no número, não na etiqueta: a fonte de bitmap é
          péssima para ler texto corrido e ótima para leitura de painel.
          Vira placar de máquina; a etiqueta continua legível em mono.
          `leading-none` NÃO serve aqui: os glifos dela ocupam o bloco em
          inteiro e a caixa de linha de altura 1 corta o topo e a base —
          o número sai achatado. Precisa de folga vertical. */}
      <p className="font-arcade mt-2 truncate text-[0.85rem] leading-[1.45] text-text-primary">
        {valor}
      </p>
      {progresso !== undefined && (
        <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-bg-input">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progresso * 100}%`, backgroundColor: cor }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Linha de uma lista, não um cartão.
 *
 * Antes cada tarefa era uma caixa com borda própria e `py-3`, então três
 * tarefas viravam três cartões soltos, altos e vazios no meio. Agora as
 * linhas dividem um contêiner só, separadas por fio — lê como lista, cabe
 * mais na tela e o olho corre pela coluna dos nomes.
 *
 * O tempo já focado ocupa o vão morto que existia entre o nome e o play:
 * é a informação que a pessoa quer ali, e o dado já existe nas sessões.
 */
function CategoriaModal({
  alvo, onFechar, onSalvar, onExcluir,
}: {
  alvo: CategoriaDeFoco | 'nova' | null;
  onFechar: () => void;
  onSalvar: (dados: Partial<CategoriaDeFoco> & { nome: string; cor: string }) => void;
  onExcluir: (id: string) => void;
}) {
  const editando = alvo && alvo !== 'nova' ? alvo : null;
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(CORES[0]);
  const [icone, setIcone] = useState(ICONES[0]);
  const [horasSemana, setHorasSemana] = useState('');

  useEffect(() => {
    if (!alvo) return;
    setNome(editando?.nome ?? '');
    setCor(editando?.cor ?? CORES[0]);
    setIcone(editando?.icone ?? ICONES[0]);
    setHorasSemana(
      editando?.metaSemanalMinutos ? String(Math.round(editando.metaSemanalMinutos / 60)) : ''
    );
  }, [alvo, editando]);

  const valido = nome.trim().length > 0;
  const salvar = () => {
    if (!valido) return;
    // Teto de 100h/semana: acima disso não é meta, é digitação errada.
    const horas = Number(horasSemana);
    const metaSemanalMinutos = Number.isFinite(horas) && horas > 0
      ? Math.min(100, Math.round(horas)) * 60
      : undefined;
    onSalvar({
      id: editando?.id,
      nome: nome.trim(),
      cor,
      icone,
      metaSemanalMinutos,
    });
  };

  return (
    <Modal
      isOpen={alvo !== null}
      onClose={onFechar}
      title={editando ? 'Editar frente' : 'Nova frente'}
      rodape={
        <div className="flex gap-3">
          {editando && (
            <button
              onClick={() => onExcluir(editando.id)}
              className="rounded-xl border border-danger/40 px-4 py-3 text-sm font-semibold text-danger transition-colors hover:bg-danger/10"
            >
              Excluir
            </button>
          )}
          <button
            onClick={onFechar}
            className="flex-1 rounded-xl bg-bg-card-hover py-3 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={!valido}
            className="btn-grad flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Nome</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') salvar(); }}
            placeholder="Trabalho, Estudo, Projeto…"
            autoFocus
            className="entrada"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Meta por semana <span className="normal-case tracking-normal text-text-muted">(horas, opcional)</span>
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={horasSemana}
            onChange={e => setHorasSemana(e.target.value)}
            placeholder="8"
            className="entrada"
          />
          <p className="mt-1.5 text-xs text-text-muted">
            Uma meta só, de propósito — três metas concorrentes valem o mesmo que nenhuma.
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Cor</p>
          <div className="flex flex-wrap gap-2">
            {CORES.map(c => (
              <button
                key={c}
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                className="alvo-toque h-8 w-8 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  boxShadow: cor === c ? `0 0 0 2px var(--color-bg-primary), 0 0 0 4px ${c}` : 'none',
                  opacity: cor === c ? 1 : 0.5,
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Ícone</p>
          {/* Grade fixa de 7 colunas com rolagem: com quase trinta ícones,
              deixá-los quebrarem em `flex-wrap` fazia a última fileira
              ficar solta e o modal esticar demais. */}
          <div className="rolagem-limpa grid max-h-40 grid-cols-7 gap-1.5 rounded-lg border border-border bg-bg-input p-2">
            {ICONES.map(i => {
              const sel = icone === i;
              return (
                <button
                  key={i}
                  onClick={() => setIcone(i)}
                  aria-label={`Ícone ${i}`}
                  aria-pressed={sel}
                  className="flex aspect-square items-center justify-center rounded-md border transition-colors"
                  style={{
                    borderColor: sel ? cor : 'transparent',
                    backgroundColor: sel ? `color-mix(in oklab, ${cor} 18%, transparent)` : 'transparent',
                  }}
                >
                  <HabitIcon name={i} size={17} color={sel ? cor : 'var(--color-text-muted)'} />
                </button>
              );
            })}
          </div>
        </div>

        {editando && (
          <p className="rounded-lg border border-border bg-bg-input px-3 py-2.5 text-xs text-text-muted">
            Excluir a frente não apaga o tempo já focado nem as tarefas — elas só
            deixam de pertencer a ela.
          </p>
        )}
      </div>
    </Modal>
  );
}

function AjustesModal({
  aberto, ajustes, onFechar, onSalvar,
}: {
  aberto: boolean;
  ajustes: AjustesDeFoco;
  onFechar: () => void;
  onSalvar: (a: AjustesDeFoco) => void;
}) {
  const [rascunho, setRascunho] = useState(ajustes);
  useEffect(() => { if (aberto) setRascunho(ajustes); }, [aberto, ajustes]);

  const campos: { chave: keyof AjustesDeFoco; rotulo: string; min: number; max: number }[] = [
    { chave: 'minutosFoco', rotulo: 'Bloco de foco (min)', min: 1, max: 180 },
    { chave: 'minutosPausa', rotulo: 'Pausa curta (min)', min: 1, max: 60 },
    { chave: 'minutosPausaLonga', rotulo: 'Pausa longa (min)', min: 1, max: 90 },
    { chave: 'blocosAteAPausaLonga', rotulo: 'Blocos até a pausa longa', min: 2, max: 12 },
  ];

  return (
    <Modal
      isOpen={aberto}
      onClose={onFechar}
      title="Ajustes do cronômetro"
      rodape={
        <div className="flex gap-3">
          <button
            onClick={onFechar}
            className="flex-1 rounded-xl bg-bg-card-hover py-3 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSalvar(rascunho)}
            className="btn-grad flex-1 rounded-xl py-3 text-sm font-semibold text-white"
          >
            Salvar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {campos.map(c => (
          <div key={c.chave}>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {c.rotulo}
            </label>
            <input
              type="number"
              min={c.min}
              max={c.max}
              value={rascunho[c.chave] as number}
              onChange={e => {
                // `min`/`max` do campo só valem para as setinhas, não para o
                // que é digitado — um bloco de 0 min travaria o ciclo.
                const n = Number(e.target.value);
                const seguro = Number.isFinite(n) ? Math.min(c.max, Math.max(c.min, Math.round(n))) : c.min;
                setRascunho(r => ({ ...r, [c.chave]: seguro }));
              }}
              className="entrada"
            />
          </div>
        ))}

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-bg-input px-3.5 py-3">
          <input
            type="checkbox"
            checked={rascunho.som}
            onChange={e => setRascunho(r => ({ ...r, som: e.target.checked }))}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          <span className="text-sm text-text-secondary">Tocar um aviso quando o bloco terminar</span>
        </label>
      </div>
    </Modal>
  );
}
