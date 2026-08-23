import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { Zap, Trash2, Calendar, AlertCircle, Plus, Check } from 'lucide-react';
import { getActions, saveAction, toggleAction, deleteAction } from '../store';
import type { Action } from '../types';
import { hojeISO as hojeStr, somarDias, formatarData, desdeQuando } from '../lib/data';
import Modal from '../components/ui/Modal';
import Toast from '../components/ui/Toast';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';

/** Espera da saída antes de gravar. Um pouco MAIOR que os 340ms da
 *  transição do `.item-saindo` — com 280 o elemento sumia antes do fim e
 *  a saída estalava. */
const MS_SAIDA = 380;

/** Espera da saída do chip. Também um pouco maior que os 300ms da
 *  transição do `.chip-saindo`. */
const MS_CHIP = 340;

const CONCLUIDAS = '__concluidas__';
const TODAS = 'todas';

type Grupo = 'atrasadas' | 'hoje' | 'semana' | 'depois' | 'semData';

const GRUPOS: { chave: Grupo; rotulo: string; perigo?: boolean }[] = [
  { chave: 'atrasadas', rotulo: 'Atrasadas', perigo: true },
  { chave: 'hoje', rotulo: 'Hoje' },
  { chave: 'semana', rotulo: 'Esta semana' },
  { chave: 'depois', rotulo: 'Depois' },
  { chave: 'semData', rotulo: 'Sem data' },
];

/** Em qual faixa de urgência a ação cai. */
function grupoDe(action: Action, hoje: string, limiteSemana: string): Grupo {
  if (!action.dueDate) return 'semData';
  if (action.dueDate < hoje) return 'atrasadas';
  if (action.dueDate === hoje) return 'hoje';
  if (action.dueDate <= limiteSemana) return 'semana';
  return 'depois';
}

/** Chaves que saíram da lista mas ainda estão animando. Sem isso o chip é
 *  desmontado no mesmo quadro em que o contador zera: não sobra elemento
 *  para transicionar e ele some do nada. */
function useSaindo(visiveis: string[], ms: number): Set<string> {
  const [saindo, setSaindo] = useState<Set<string>>(new Set());
  const anterior = useRef<string[]>(visiveis);
  const timers = useRef(new Map<string, number>());
  const assinatura = visiveis.join('|');

  useEffect(() => {
    // Reapareceu antes de terminar (desfazer, reabrir): cancela a saída.
    for (const k of visiveis) {
      const t = timers.current.get(k);
      if (t !== undefined) {
        window.clearTimeout(t);
        timers.current.delete(k);
        setSaindo(s => { const n = new Set(s); n.delete(k); return n; });
      }
    }

    const removidas = anterior.current.filter(k => !visiveis.includes(k));
    if (removidas.length > 0) {
      setSaindo(s => { const n = new Set(s); removidas.forEach(k => n.add(k)); return n; });
      for (const k of removidas) {
        timers.current.set(k, window.setTimeout(() => {
          timers.current.delete(k);
          setSaindo(s => { const n = new Set(s); n.delete(k); return n; });
        }, ms));
      }
    }

    anterior.current = visiveis;
    // `assinatura` representa `visiveis` — o array é novo a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, ms]);

  useEffect(() => {
    const m = timers.current;
    return () => { m.forEach(t => window.clearTimeout(t)); };
  }, []);

  return saindo;
}

interface ChipInfo {
  chave: string;
  rotulo: string;
  contagem: number;
  visivel: boolean;
  cor?: string;
  prefixo?: React.ReactNode;
  /** Separador antes do chip — só as Concluídas usam. */
  divisor?: boolean;
}

interface FormState {
  id?: string;
  name: string;
  description: string;
  dueDate: string;
}

const FORM_VAZIO: FormState = { name: '', description: '', dueDate: '' };

interface Aviso {
  chave: number;
  actionId: string;
  mensagem: string;
}

/**
 * Ações são as desta página, e só elas.
 *
 * Tarefa de uma frente do Foco vive no mesmo armazenamento — o que é certo,
 * é o mesmo tipo de registro — mas carrega `categoriaId`. Sem este filtro,
 * tudo que era digitado dentro de uma frente aparecia aqui também, e as
 * duas telas viravam a mesma lista com dois nomes.
 *
 * Filtro, não migração: os registros continuam onde estão, então nada se
 * perde e o Foco segue enxergando as tarefas dele.
 */
function acoesAvulsas(): Action[] {
  return getActions().filter(a => !a.categoriaId);
}

export default function ActionsPage() {
  const [actions, setActions] = useState<Action[]>(() => acoesAvulsas());
  const [filtro, setFiltro] = useState<string>('todas');
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [excluir, setExcluir] = useState<Action | null>(null);
  const [saindo, setSaindo] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<Aviso | null>(null);
  /** Gravações ainda esperando a animação terminar, por temporizador. */
  const pendentesDeGravar = useRef(new Map<number, () => void>());

  // Ao sair da página, ESCREVE o que estava pendente em vez de só cancelar
  // o temporizador. Antes, concluir uma ação e trocar de tela antes dos
  // 380ms da animação descartava a gravação em silêncio: o toque sumia e
  // a ação voltava a aparecer como pendente.
  useEffect(() => () => {
    pendentesDeGravar.current.forEach((gravar, timer) => {
      window.clearTimeout(timer);
      gravar();
    });
    pendentesDeGravar.current.clear();
  }, []);

  const recarregar = useCallback(() => setActions(acoesAvulsas()), []);

  const hoje = hojeStr();
  const limiteSemana = somarDias(hoje, 7);

  const pendentes = actions.filter(a => !a.completed);
  const concluidas = actions.filter(a => a.completed);
  const verConcluidas = filtro === CONCLUIDAS;

  const contarGrupo = (g: Grupo) =>
    pendentes.filter(a => grupoDe(a, hoje, limiteSemana) === g).length;

  /** Conclui/reabre com a animação de saída antes de gravar. */
  function alternar(action: Action) {
    if (saindo.has(action.id)) return;
    setSaindo(p => new Set(p).add(action.id));

    // A gravação vive separada do resto do efeito: é a única parte que
    // precisa acontecer mesmo se a página sumir no meio da animação.
    const gravar = () => toggleAction(action.id);

    const timer = window.setTimeout(() => {
      pendentesDeGravar.current.delete(timer);
      gravar();
      recarregar();
      setSaindo(p => { const n = new Set(p); n.delete(action.id); return n; });
      setAviso({
        chave: Date.now(),
        actionId: action.id,
        mensagem: action.completed
          ? `${action.name} voltou para as pendentes`
          : `${action.name} concluída`,
      });
    }, MS_SAIDA);

    pendentesDeGravar.current.set(timer, gravar);
  }

  function desfazer() {
    if (!aviso) return;
    toggleAction(aviso.actionId);
    recarregar();
    setAviso(null);
  }

  function abrirNova() {
    setForm(FORM_VAZIO);
    setModalAberto(true);
  }

  function abrirEdicao(action: Action) {
    setForm({
      id: action.id,
      name: action.name,
      description: action.description ?? '',
      dueDate: action.dueDate ?? '',
    });
    setModalAberto(true);
  }

  function salvar() {
    if (!form.name.trim()) return;
    saveAction({
      id: form.id,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      dueDate: form.dueDate || undefined,
    });
    setModalAberto(false);
    setForm(FORM_VAZIO);
    recarregar();
  }

  function enterSalva(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); salvar(); }
  }

  // Filtro ativo → quais grupos aparecem
  const gruposVisiveis: Grupo[] =
    filtro === 'todas' ? GRUPOS.map(g => g.chave)
    : filtro === CONCLUIDAS ? []
    : [filtro as Grupo];

  const concluidasOrdenadas = [...concluidas].sort((a, b) =>
    (b.completedAt ?? b.createdAt ?? '').localeCompare(a.completedAt ?? a.createdAt ?? '')
  );

  const nadaParaMostrar = verConcluidas
    ? concluidas.length === 0
    : gruposVisiveis.every(g => contarGrupo(g) === 0);

  // Ordem fixa de todos os chips possíveis. Renderizar sempre desta lista
  // (em vez de montar só os visíveis) mantém o que está saindo no lugar
  // onde estava, em vez de jogá-lo para o fim da fila.
  const chips: ChipInfo[] = [
    { chave: TODAS, rotulo: 'Todas', contagem: pendentes.length, visivel: true },
    ...GRUPOS.map(g => ({
      chave: g.chave as string,
      rotulo: g.rotulo,
      contagem: contarGrupo(g.chave),
      cor: g.perigo ? 'var(--color-danger)' : undefined,
      visivel: contarGrupo(g.chave) > 0,
    })),
    {
      chave: CONCLUIDAS,
      rotulo: 'Concluídas',
      contagem: concluidas.length,
      cor: 'var(--color-success)',
      prefixo: <Check size={13} strokeWidth={3} />,
      divisor: true,
      visivel: concluidas.length > 0,
    },
  ];

  const chipsSaindo = useSaindo(chips.filter(c => c.visivel).map(c => c.chave), MS_CHIP);

  // Congela a contagem de quem está saindo: o chip sai porque zerou, e
  // exibir "Sem data 0" durante o encolhimento entrega a costura.
  const contagens = useRef(new Map<string, number>());
  useEffect(() => {
    chips.forEach(c => { if (c.visivel) contagens.current.set(c.chave, c.contagem); });
  });

  // Largura natural de cada chip em `--w`, para o keyframe ter de onde
  // sair e para onde ir. Medido no filho, que é `w-max` e por isso não
  // encolhe junto com o pai enquanto a animação roda. Em layout effect:
  // roda antes da pintura, então a variável já existe no primeiro quadro
  // da animação — se faltasse, `width: var(--w)` seria inválido e a
  // largura não animaria.
  const caixas = useRef(new Map<string, HTMLDivElement>());
  useLayoutEffect(() => {
    caixas.current.forEach(el => {
      // `offsetWidth`, não `getBoundingClientRect`: o segundo devolve a
      // caixa já transformada, e o keyframe tem `scale(0.92)` — medir ali
      // dava 8px a menos e o chip pulava para a largura real no fim.
      const largura = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
      if (largura > 0) el.style.setProperty('--w', `${largura}px`);
    });
  });

  // O filtro ativo pode apontar para um chip que acabou de sumir — sem
  // isto a página fica presa num "Nada aqui" sem chip aceso para desfazer.
  useEffect(() => {
    if (filtro === TODAS) return;
    const alvo = chips.find(c => c.chave === filtro);
    if (alvo && !alvo.visivel) setFiltro(TODAS);
  });

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-5 p-4 md:p-6 lg:p-8 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Ações</h1>
        <button
          onClick={abrirNova}
          className="btn-grad flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus size={16} />
          Nova ação
        </button>
      </div>

      {/* Filtros. `gap-y` só na vertical: o espaço horizontal é margem do
          próprio chip, para colapsar junto com ele na saída. */}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-y-2">
          {chips.map(c => {
            const saindoChip = !c.visivel && chipsSaindo.has(c.chave);
            if (!c.visivel && !saindoChip) return null;
            const contagem = c.visivel
              ? c.contagem
              : contagens.current.get(c.chave) ?? c.contagem;
            return (
              <div
                key={c.chave}
                ref={el => {
                  if (el) caixas.current.set(c.chave, el);
                  else caixas.current.delete(c.chave);
                }}
                className={`chip-cx mr-2 ${saindoChip ? 'chip-saindo' : 'chip-entrando'}`}
                aria-hidden={saindoChip || undefined}
              >
                <div className="flex w-max items-center">
                  {c.divisor && <span className="mr-2 h-5 w-px bg-border" aria-hidden />}
                  <Chip
                    ativo={filtro === c.chave}
                    onClick={() => setFiltro(filtro === c.chave ? TODAS : c.chave)}
                    rotulo={c.rotulo}
                    contagem={contagem}
                    cor={c.cor}
                    prefixo={c.prefixo}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista */}
      {actions.length === 0 ? (
        <EmptyState
          icon={<Zap size={26} />}
          message="Nenhuma ação ainda"
          subtitle="Consultas, procedimentos, pendências — coisas pontuais que não são hábito."
          actionLabel="Nova ação"
          onAction={abrirNova}
        />
      ) : nadaParaMostrar ? (
        // Três vazios diferentes. Sem separar o do meio, quem concluía
        // tudo lia "Nenhuma ação nesta faixa de prazo" sem ter escolhido
        // faixa nenhuma — parecia defeito em vez de lista limpa.
        <EmptyState
          icon={verConcluidas ? <Check size={26} /> : <Zap size={26} />}
          message={
            verConcluidas ? 'Nada concluído ainda'
            : filtro === TODAS ? 'Tudo em dia'
            : 'Nada aqui'
          }
          subtitle={
            verConcluidas ? 'O que você concluir fica guardado nesta aba.'
            : filtro === TODAS ? 'Nenhuma ação pendente. O que você concluiu está na aba Concluídas.'
            : 'Nenhuma ação nesta faixa de prazo.'
          }
        />
      ) : verConcluidas ? (
        <Secao rotulo="Concluídas" contagem={concluidas.length}>
          {concluidasOrdenadas.map(action => (
            <ItemAcao
              key={action.id}
              action={action}
              hoje={hoje}
              saindo={saindo.has(action.id)}
              onToggle={() => alternar(action)}
              onEditar={() => abrirEdicao(action)}
              onExcluir={() => setExcluir(action)}
            />
          ))}
        </Secao>
      ) : (
        // Espaço por margem no filho, não `space-y` no pai: o space-y usa
        // margin-top do irmão seguinte, que sobreviveria ao colapso e
        // deixaria um buraco de 24px onde a seção sumiu.
        <div>
          {GRUPOS.filter(g => gruposVisiveis.includes(g.chave)).map(g => {
            const doGrupo = pendentes
              .filter(a => grupoDe(a, hoje, limiteSemana) === g.chave)
              .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
            if (doGrupo.length === 0) return null;
            // Se o que resta no grupo já está todo saindo, a seção inteira
            // colapsa junto — senão o cabeçalho ficava sozinho e sumia de
            // estalo no instante em que o último item era gravado.
            const grupoEsvaziando = doGrupo.every(a => saindo.has(a.id));
            return (
              <div key={g.chave} className={`mb-6 last:mb-0 ${grupoEsvaziando ? 'item-saindo' : 'item-entrando'}`}>
                <div>
                  <Secao rotulo={g.rotulo} contagem={doGrupo.length} perigo={g.perigo}>
                    {doGrupo.map(action => (
                      <ItemAcao
                        key={action.id}
                        action={action}
                        hoje={hoje}
                        saindo={saindo.has(action.id)}
                        onToggle={() => alternar(action)}
                        onEditar={() => abrirEdicao(action)}
                        onExcluir={() => setExcluir(action)}
                      />
                    ))}
                  </Secao>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {aviso && (
        <Toast
          chave={aviso.chave}
          mensagem={aviso.mensagem}
          acaoRotulo="Desfazer"
          onAcao={desfazer}
          onFechar={() => setAviso(null)}
        />
      )}

      {/* ── Modal ── */}
      <Modal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title={form.id ? 'Editar ação' : 'Nova ação'}
        rodape={
          <div className="flex gap-3">
            <button
              onClick={() => setModalAberto(false)}
              className="flex-1 rounded-xl bg-bg-card-hover py-3 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={!form.name.trim()}
              className="btn-grad flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {form.id ? 'Salvar' : 'Criar'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Nome" obrigatorio>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={enterSalva}
              placeholder="O que precisa ser feito?"
              autoFocus
              className="entrada"
            />
          </Campo>

          <Campo rotulo="Descrição">
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Detalhes, local, telefone…"
              rows={3}
              className="entrada resize-none"
            />
          </Campo>

          <Campo rotulo="Data limite">
            <input
              type="date"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              onKeyDown={enterSalva}
              className="entrada"
            />
          </Campo>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!excluir}
        onClose={() => setExcluir(null)}
        onConfirm={() => {
          if (excluir) { deleteAction(excluir.id); setExcluir(null); recarregar(); }
        }}
        title="Excluir ação"
        message={`Excluir "${excluir?.name}"? Isso não pode ser desfeito.`}
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}

// ── Subcomponentes ──

function Campo({ rotulo, obrigatorio, children }: { rotulo: string; obrigatorio?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {rotulo} {obrigatorio && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

function Chip({
  ativo, onClick, rotulo, contagem, cor, prefixo,
}: {
  ativo: boolean; onClick: () => void; rotulo: string; contagem: number;
  cor?: string; prefixo?: React.ReactNode;
}) {
  const c = cor ?? 'var(--color-accent)';
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-[background-color,border-color] duration-200"
      style={{
        backgroundColor: ativo ? `color-mix(in oklab, ${c} 18%, transparent)` : 'var(--color-bg-card)',
        borderColor: ativo ? c : 'var(--color-border)',
      }}
    >
      {prefixo && <span style={{ color: ativo ? c : 'var(--color-text-muted)' }}>{prefixo}</span>}
      <span className={ativo ? 'font-medium text-text-primary' : 'text-text-secondary'}>{rotulo}</span>
      <span className="text-xs text-text-muted">{contagem}</span>
    </button>
  );
}

function Secao({
  rotulo, contagem, perigo, children,
}: {
  rotulo: string; contagem: number; perigo?: boolean; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: perigo ? 'var(--color-danger)' : 'var(--color-accent)' }}
        >
          {rotulo}
        </h2>
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-text-muted">{contagem}</span>
      </div>
      {/* gap por margem no filho, não `gap` no pai: assim o espaço colapsa
          junto com o item e não sobra buraco durante a saída */}
      <div>{children}</div>
    </section>
  );
}

function ItemAcao({
  action, hoje, saindo, onToggle, onEditar, onExcluir,
}: {
  action: Action;
  hoje: string;
  saindo: boolean;
  onToggle: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const atrasada = !action.completed && !!action.dueDate && action.dueDate < hoje;
  const marcado = action.completed || saindo;
  const cor = atrasada ? 'var(--color-danger)' : 'var(--color-accent)';

  const quando = action.completed && action.completedAt
    ? desdeQuando(action.completedAt)
    : null;

  return (
    <div className={`mb-2 ${saindo ? 'item-saindo' : 'item-entrando'}`}>
      <div>
        {/* Card inteiro clicável abre a edição; check e excluir param a
            propagação para não editar sem querer. */}
        <div
          onClick={onEditar}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') onEditar(); }}
          title="Editar ação"
          className="card-soft group flex cursor-pointer items-start gap-3 rounded-2xl border bg-bg-card p-4 transition-[border-color,background-color] duration-200 hover:border-border-light hover:bg-bg-card-hover"
          style={{ borderColor: marcado ? `color-mix(in oklab, ${cor} 40%, transparent)` : 'var(--color-border)' }}
        >
          <button
            onClick={e => { e.stopPropagation(); onToggle(); }}
            aria-label={action.completed ? 'Marcar como pendente' : 'Marcar como concluída'}
            className="alvo-toque mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-[background-color,border-color,box-shadow] duration-200"
            style={{
              backgroundColor: marcado ? cor : 'transparent',
              borderColor: marcado ? cor : 'var(--color-border-light)',
              boxShadow: marcado ? `0 0 12px color-mix(in oklab, ${cor} 45%, transparent)` : undefined,
            }}
          >
            {marcado && <Check size={14} strokeWidth={3} className="text-bg-primary" />}
          </button>

          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium leading-snug ${action.completed ? 'text-text-secondary' : 'text-text-primary'}`}>
              {action.name}
            </p>

            {action.description && (
              <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{action.description}</p>
            )}

            {action.dueDate && !action.completed && (
              <div
                className="mt-1.5 flex items-center gap-1 text-xs"
                style={{ color: atrasada ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
              >
                {atrasada ? <AlertCircle size={11} /> : <Calendar size={11} />}
                {atrasada ? 'Atrasada · ' : ''}{formatarData(action.dueDate, 'dd MMM')}
              </div>
            )}

            {quando && <p className="mt-1.5 text-xs text-text-muted">{quando}</p>}
          </div>

          {/* Sempre visível: no celular não existe hover. */}
          <button
            onClick={e => { e.stopPropagation(); onExcluir(); }}
            aria-label="Excluir ação"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-text-muted opacity-45 transition-[opacity,color] hover:text-danger group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
