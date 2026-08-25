import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Minus, Check, Target, ChevronRight, Sparkles, CheckSquare, Pencil, Flame } from 'lucide-react';
import HabitIcon from '../components/ui/HabitIcon';
import {
  getHabits,
  getHabitLogs,
  toggleHabitLog,
  incrementHabitCount,
  getActions,
  toggleAction,
  getDestaques,
  setDestaques,
  semanasSeguidas,
} from '../store';
import Modal from '../components/ui/Modal';
import type { Habit, HabitLog, Action, Page } from '../types';
import { hojeISO, formatarData } from '../lib/data';

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function shouldShowHabitToday(habit: Habit, todayDow: number, weekLogs: HabitLog[]): boolean {
  const completedThisWeek = weekLogs.filter(l => l.habitId === habit.id).length;
  if (completedThisWeek >= habit.frequency) return habit.preferredDays.includes(todayDow);
  if (habit.preferredDays.includes(todayDow)) return true;
  if (habit.preferredDays.length === 0) return true;
  const remaining = habit.preferredDays.filter(d => d > todayDow).length;
  const needed = habit.frequency - completedThisWeek;
  return remaining < needed;
}

interface TodayPageProps {
  onNavigate?: (page: Page) => void;
}

export default function TodayPage({ onNavigate }: TodayPageProps) {
  // Inicialização direto do store. Começar com [] fazia o primeiro frame
  // renderizar a tela de boas-vindas antes do useEffect carregar os dados.
  const [habits, setHabits] = useState<Habit[]>(() => getHabits().filter(h => !h.archived));
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>(() => getHabitLogs());
  // Só as avulsas. Tarefa que pertence a uma frente do Foco tem
  // `categoriaId` e é assunto da frente dela — a aba Hoje mostrava as duas
  // coisas misturadas sob o rótulo de ação.
  const [actions, setActions] = useState<Action[]>(() => getActions().filter(a => !a.categoriaId));
  /** Ações em processo de saída — mantidas no DOM até a animação acabar. */
  const [saindo, setSaindo] = useState<Set<string>>(new Set());
  /** Hábitos escolhidos para os dois cards de sequência */
  const [destaques, setDestaquesState] = useState<string[]>(() => getDestaques());
  const [escolhendoSlot, setEscolhendoSlot] = useState<number | null>(null);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayDow = today.getDay();
  // Janela rolante de 7 dias terminando hoje. Com a semana de calendário,
  // num domingo todos os outros dias caem no futuro e não dá pra marcar
  // um dia esquecido — que é justamente o caso de uso.
  const weekDayStrings = Array.from({ length: 7 }, (_, i) =>
    format(subDays(today, 6 - i), 'yyyy-MM-dd')
  );
  const rawDate = format(today, "EEEE, d 'de' MMMM", { locale: ptBR });
  const dateHeader = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  const load = useCallback(() => {
    setHabits(getHabits().filter(h => !h.archived));
    setHabitLogs(getHabitLogs());
    setActions(getActions().filter(a => !a.categoriaId));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ATENÇÃO: logs parciais (ex: 3 de 6 copos) têm completed=false. Filtrar por
  // completed aqui zerava o contador na tela até bater a meta.
  const weekLogsAll = habitLogs.filter(l => weekDayStrings.includes(l.date));
  const weekLogs = weekLogsAll.filter(l => l.completed);
  const todayLogsAll = weekLogsAll.filter(l => l.date === todayStr);

  // Agrupamento SÓ pela agenda. Não pode depender de ter registro hoje:
  // marcar promovia o card pro grupo de cima e desmarcar devolvia pra baixo,
  // fazendo a lista saltar a cada clique.
  const agendadoHoje = (h: Habit) =>
    h.preferredDays.length === 0 || h.preferredDays.includes(todayDow);
  const habitosDoDia = habits.filter(agendadoHoje);
  const habitosOutrosDias = habits.filter(h => !agendadoHoje(h));
  const todayHabits = [...habitosDoDia, ...habitosOutrosDias];

  // Só o que é de hoje: atrasadas, vencendo hoje e as sem prazo. Uma ação
  // marcada para daqui a três meses não é assunto da tela do dia — mas a
  // sem prazo continua aqui, porque é justamente a que se esquece.
  const pendingActions = actions.filter(
    a => !a.completed && (!a.dueDate || a.dueDate <= todayStr)
  );

  const isEmpty = habits.length === 0 && pendingActions.length === 0;

  /** Marca/desmarca um dia qualquer da semana — inclusive retroativo. */
  function handleToggleDay(habitId: string, dia: string) {
    toggleHabitLog(habitId, dia);
    load();
  }

  /** Soma ou subtrai na contagem do dia (água, etc). */
  function handleCount(habit: Habit, delta: number) {
    incrementHabitCount(habit.id, todayStr, delta, habit.dailyTarget);
    load();
  }

  /** Marca a ação como saindo, deixa a animação rodar e só então grava. */
  function handleToggleAction(id: string) {
    if (saindo.has(id)) return;
    setSaindo(prev => new Set(prev).add(id));
    window.setTimeout(() => {
      toggleAction(id);
      load();
      setSaindo(prev => {
        const proximo = new Set(prev);
        proximo.delete(id);
        return proximo;
      });
      // 380ms: um pouco mais que os 340ms da transição do `.item-saindo`.
      // Com 300 o elemento sumia antes do fim e a saída estalava.
    }, 380);
  }


  if (isEmpty) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">
        {/* Welcome Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/20 via-bg-card to-bg-card border border-accent/20 p-8 md:p-10 mb-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative">
            <p className="text-sm text-accent-light font-medium mb-2">{dateHeader}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
              Comece sua jornada
            </h1>
            <p className="text-text-secondary max-w-md leading-relaxed">
              Defina seus hábitos, registre suas vitórias e acompanhe sua evolução.
              Tudo começa com o primeiro passo.
            </p>
          </div>
        </div>

        {/* Quick Start Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate?.('habits')}
            className="group flex items-center gap-4 p-5 rounded-xl bg-bg-card border border-border hover:border-accent/40 hover:bg-bg-card-hover transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/25 transition-colors">
              <Target size={22} className="text-accent-light" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">Criar Hábitos</p>
              <p className="text-xs text-text-muted mt-0.5">Defina o que quer acompanhar</p>
            </div>
            <ChevronRight size={16} className="text-text-muted group-hover:text-accent-light transition-colors" />
          </button>

          <button
            onClick={() => onNavigate?.('challenges')}
            className="group flex items-center gap-4 p-5 rounded-xl bg-bg-card border border-border hover:border-accent/40 hover:bg-bg-card-hover transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0 group-hover:bg-warning/20 transition-colors">
              <Sparkles size={22} className="text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">Criar Desafios</p>
              <p className="text-xs text-text-muted mt-0.5">Metas específicas e mensuráveis</p>
            </div>
            <ChevronRight size={16} className="text-text-muted group-hover:text-accent-light transition-colors" />
          </button>

          <button
            onClick={() => onNavigate?.('actions')}
            className="group flex items-center gap-4 p-5 rounded-xl bg-bg-card border border-border hover:border-accent/40 hover:bg-bg-card-hover transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center flex-shrink-0 group-hover:bg-info/20 transition-colors">
              <CheckSquare size={22} className="text-info" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">Adicionar Ações</p>
              <p className="text-xs text-text-muted mt-0.5">Tarefas pontuais para resolver</p>
            </div>
            <ChevronRight size={16} className="text-text-muted group-hover:text-accent-light transition-colors" />
          </button>

          <button
            onClick={() => onNavigate?.('cookies')}
            className="group flex items-center gap-4 p-5 rounded-xl bg-bg-card border border-border hover:border-accent/40 hover:bg-bg-card-hover transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-cookie/10 flex items-center justify-center flex-shrink-0 group-hover:bg-cookie/20 transition-colors">
              <Sparkles size={22} className="text-cookie" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">Registrar Vitória</p>
              <p className="text-xs text-text-muted mt-0.5">Anote uma conquista pessoal</p>
            </div>
            <ChevronRight size={16} className="text-text-muted group-hover:text-accent-light transition-colors" />
          </button>
        </div>
      </div>
    );
  }

  return (
    // space-y no contêiner em vez de mb-* em cada seção: assim o último
    // bloco — seja ele qual for — nunca deixa margem sobrando no rodapé.
    // O respiro final já vem do p-* daqui e do pb-16 do Layout (nav fixa).
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 md:p-6 lg:p-8 animate-fade-in">
      {/* Sequências semanais em destaque */}
      {habits.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map(slot => (
            <CardSequencia
              key={slot}
              habit={habits.find(h => h.id === destaques[slot]) ?? habits[slot]}
              semanas={
                (() => {
                  const h = habits.find(x => x.id === destaques[slot]) ?? habits[slot];
                  return h ? semanasSeguidas(h.id, h.frequency) : 0;
                })()
              }
              feitosNaSemana={
                (() => {
                  const h = habits.find(x => x.id === destaques[slot]) ?? habits[slot];
                  if (!h) return 0;
                  return weekLogs.filter(l => l.habitId === h.id).length;
                })()
              }
              onTrocar={() => setEscolhendoSlot(slot)}
            />
          ))}
        </div>
      )}

      {/* Today's Habits */}
      {todayHabits.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-accent uppercase tracking-widest mb-3">
            Hábitos
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {todayHabits.map(habit => {
              const foraDoDia = !habitosDoDia.includes(habit);

              if (habit.dailyTarget && habit.dailyTarget > 1) {
                // lê de todayLogsAll: um registro parcial (3/6) tem completed=false
                const log = todayLogsAll.find(l => l.habitId === habit.id);
                const count = log?.count ?? (log?.completed ? 1 : 0);
                return (
                  <CountHabitCard
                    key={habit.id}
                    habit={habit}
                    count={count}
                    foraDoDia={foraDoDia}
                    onChange={delta => handleCount(habit, delta)}
                  />
                );
              }
              const doneDays = new Set(
                weekLogs.filter(l => l.habitId === habit.id).map(l => l.date)
              );
              return (
                <WeekHabitCard
                  key={habit.id}
                  habit={habit}
                  weekDayStrings={weekDayStrings}
                  doneDays={doneDays}
                  todayStr={todayStr}
                  foraDoDia={foraDoDia}
                  onToggleDay={dia => handleToggleDay(habit.id, dia)}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Pending Actions */}
      {pendingActions.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-accent uppercase tracking-widest mb-3">
            Ações Pendentes
          </h2>
          {/* gap por margem no filho (não `gap` no pai): assim ele colapsa
              junto com o item e não sobra buraco durante a saída */}
          <div>
            {pendingActions.map(action => (
              <div
                key={action.id}
                className={`mb-2 ${saindo.has(action.id) ? 'item-saindo' : 'item-entrando'}`}
              >
                <div>
                  <ActionCard
                    action={action}
                    marcada={saindo.has(action.id)}
                    onToggle={() => handleToggleAction(action.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Escolher qual hábito vai em cada card */}
      <Modal
        isOpen={escolhendoSlot !== null}
        onClose={() => setEscolhendoSlot(null)}
        title="Hábito em destaque"
        maxWidth="max-w-sm"
      >
        <div className="space-y-2">
          {habits.map(h => (
            <button
              key={h.id}
              onClick={() => {
                if (escolhendoSlot === null) return;
                // preenche o slot não escolhido com o padrão em vez de gravar null
                const novos = [0, 1].map(i =>
                  i === escolhendoSlot
                    ? h.id
                    : destaques[i] ?? habits[i]?.id
                ).filter((v): v is string => !!v);
                setDestaques(novos);
                setDestaquesState(novos);
                setEscolhendoSlot(null);
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-bg-input px-4 py-3 text-left transition-colors hover:border-accent"
            >
              <HabitIcon name={h.icon} size={15} color={h.color} />
              <span className="flex-1 truncate text-sm text-text-primary">{h.name}</span>
              <span className="text-xs text-text-muted">{h.frequency}x/sem</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ── Sub-components ──

/** Sequência de semanas em que o hábito bateu a meta. Visual arcade. */
function CardSequencia({
  habit, semanas, feitosNaSemana, onTrocar,
}: {
  habit?: Habit;
  semanas: number;
  feitosNaSemana: number;
  onTrocar: () => void;
}) {
  if (!habit) {
    return (
      <button
        onClick={onTrocar}
        className="flex min-h-[7.5rem] items-center justify-center rounded-2xl border border-dashed border-border text-xs uppercase tracking-widest text-text-muted transition-colors hover:border-accent hover:text-text-secondary"
      >
        + escolher hábito
      </button>
    );
  }

  const cor = habit.color ?? 'var(--color-accent)';
  const bateuEstaSemana = feitosNaSemana >= habit.frequency;
  const aceso = semanas > 0;
  const BLOCOS = 8;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: aceso ? `color-mix(in oklab, ${cor} 40%, transparent)` : 'var(--color-border)',
        // fundo próprio na cor do hábito — o card genérico não lia como streak
        backgroundImage: aceso
          ? `linear-gradient(150deg, color-mix(in oklab, ${cor} 22%, var(--color-bg-card)), var(--color-bg-card) 65%)`
          : undefined,
        backgroundColor: 'var(--color-bg-card)',
        boxShadow: aceso ? `inset 0 0 26px color-mix(in oklab, ${cor} 12%, transparent)` : undefined,
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <HabitIcon name={habit.icon} size={13} color={cor} />
        <span className="min-w-0 flex-1 truncate text-[11px] uppercase tracking-wider text-text-secondary">
          {habit.name}
        </span>
        <button
          onClick={onTrocar}
          title="Trocar hábito"
          aria-label="Trocar hábito"
          className="alvo-toque text-text-muted transition-colors hover:text-text-primary"
        >
          <Pencil size={11} />
        </button>
      </div>

      {/* Rótulo EMBAIXO do número, não ao lado.
          Ao lado, num cartão de meia largura no celular, sobravam ~40px
          para "SEGUIDAS" e a palavra quebrava no meio: "SEGUIDA / S".
          Empilhado, a linha do número fica com a largura toda e o rótulo
          nunca precisa quebrar — `whitespace-nowrap` garante isso mesmo
          num nome de hábito longo. */}
      <div className="flex items-end gap-2">
        {aceso && (
          <Flame
            size={20}
            style={{ color: cor, filter: `drop-shadow(0 0 8px ${cor})` }}
            fill={cor}
          />
        )}
        <span
          className="font-arcade text-[1.75rem] leading-none"
          style={{
            color: aceso ? cor : 'var(--color-text-muted)',
            textShadow: aceso ? `0 0 22px color-mix(in oklab, ${cor} 60%, transparent)` : undefined,
          }}
        >
          {String(semanas).padStart(2, '0')}
        </span>
      </div>

      {/* Concordância: "1 semana seguida", não "1 semana seguidas". O
          plural estava preso só no substantivo. */}
      <p className="mt-1.5 whitespace-nowrap text-[10px] uppercase tracking-wider text-text-muted">
        {semanas === 1 ? 'semana seguida' : 'semanas seguidas'}
      </p>

      {/* Corrente de semanas — é isto que lê como streak */}
      <div className="mt-3.5 flex items-center gap-1">
        {Array.from({ length: BLOCOS }, (_, i) => {
          const ativo = i < Math.min(semanas, BLOCOS);
          return (
            <span
              key={i}
              className="h-2.5 flex-1 rounded-[2px] transition-colors duration-300"
              style={{
                backgroundColor: ativo ? cor : 'var(--color-bg-input)',
                boxShadow: ativo ? `0 0 8px color-mix(in oklab, ${cor} 45%, transparent)` : undefined,
              }}
            />
          );
        })}
        {semanas > BLOCOS && (
          <span className="ml-0.5 font-arcade text-[0.5rem]" style={{ color: cor }}>
            +{semanas - BLOCOS}
          </span>
        )}
      </div>

      <p className="mt-3 border-t pt-2.5 text-[10px] uppercase tracking-wider text-text-muted"
         style={{ borderColor: 'color-mix(in oklab, var(--color-border) 70%, transparent)' }}>
        esta semana{' '}
        <span style={{ color: bateuEstaSemana ? cor : 'var(--color-text-secondary)' }}>
          {feitosNaSemana}/{habit.frequency}
        </span>
        {/* O selo ocupa a linha SEMPRE, e só fica visível quando vale.
            Renderizado condicionalmente, ele entrava e saía da segunda
            linha e o cartão mudava de altura ao bater a meta — como os
            dois cartões dividem uma linha de grade, a fileira inteira
            saltava. `invisible` reserva o espaço e acompanha a fonte,
            que uma altura fixa em pixel não faria. */}
        <span className={bateuEstaSemana ? '' : 'invisible'} style={{ color: cor }}>
          {' '}· garantida
        </span>
      </p>
    </div>
  );
}

interface HabitCardProps {
  habit: Habit;
  isCompleted: boolean;
  habitWeekLogs: HabitLog[];
  weekDayStrings: string[];
  todayStr: string;
  onToggle: () => void;
}

/** Moldura comum dos dois tipos de card */
function CardShell({
  habit,
  isCompleted,
  children,
  subtitle,
  counter,
  progress,
  foraDoDia,
}: {
  habit: Habit;
  isCompleted: boolean;
  children: React.ReactNode;
  subtitle: string;
  counter: { atual: number; alvo: number };
  progress: number;
  foraDoDia?: boolean;
}) {
  const cor = habit.color ?? 'var(--color-accent)';
  const diasPref = habit.preferredDays.length
    ? habit.preferredDays.map(d => DAY_LABELS[d]).join(' · ')
    : null;

  return (
    <div
      className={`card-soft relative overflow-hidden rounded-2xl border bg-bg-card p-5 transition-[opacity,border-color] duration-300 ${
        foraDoDia ? 'opacity-55 hover:opacity-100' : ''
      }`}
      style={{
        borderColor: isCompleted
          ? `color-mix(in oklab, ${cor} 45%, transparent)`
          : 'var(--color-border)',
      }}
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-2.5 mb-4">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in oklab, ${cor} 18%, transparent)` }}
        >
          <HabitIcon name={habit.icon} size={15} color={cor} />
        </span>
        <h3 className="flex-1 truncate text-[15px] font-semibold text-text-primary">
          {habit.name}
        </h3>
        {isCompleted && (
          <Check size={16} strokeWidth={3} style={{ color: cor }} className="glow" />
        )}
      </div>

      {/* Sempre renderizada — se aparecesse só quando fora do dia, o card
          mudava de altura ao marcar/desmarcar. */}
      <p className="-mt-2.5 mb-3 h-3.5 text-[10px] uppercase tracking-wider text-text-muted">
        {diasPref ?? ''}
      </p>

      {/* Sublinha + contador */}
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-xs text-text-muted">{subtitle}</span>
        <span className="text-sm font-semibold tabular-nums">
          <span style={{ color: cor }} className={isCompleted ? 'glow' : undefined}>
            {counter.atual}
          </span>
          <span className="text-text-muted"> / {counter.alvo}</span>
        </span>
      </div>

      {children}

      {/* Barra de progresso */}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-bg-input">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, progress)}%`,
            backgroundImage: `linear-gradient(90deg, color-mix(in oklab, ${cor} 55%, transparent), ${cor})`,
            boxShadow: progress > 0 ? `0 0 10px color-mix(in oklab, ${cor} 55%, transparent)` : undefined,
          }}
        />
      </div>
    </div>
  );
}

/** Hábito contável: água 0/6, com − e + Adicionar. Conclui sozinho na meta. */
function CountHabitCard({
  habit,
  count,
  onChange,
  foraDoDia,
}: {
  habit: Habit;
  count: number;
  onChange: (delta: number) => void;
  foraDoDia?: boolean;
}) {
  // Sanidade da meta antes de virar quantidade de elementos na tela: um
  // valor absurdo gravado (digitação errada, importação, sincronização)
  // renderizava um slot por unidade e travava a aba — e como fica salvo,
  // travava de novo a cada abertura, sem saída para o usuário.
  const alvo = Math.max(1, Math.floor(habit.dailyTarget ?? 1) || 1);
  const cor = habit.color ?? 'var(--color-accent)';
  const concluido = count >= alvo;

  // Acima disso os slots deixam de ser legíveis de relance, que é a única
  // razão de existirem: vira barra com o número.
  const MAX_SLOTS = 24;
  const usarSlots = alvo <= MAX_SLOTS;

  return (
    <CardShell
      habit={habit}
      isCompleted={concluido}
      foraDoDia={foraDoDia}
      subtitle={habit.unit ? `Meta diária · ${habit.unit}` : 'Meta diária'}
      counter={{ atual: count, alvo }}
      progress={(count / alvo) * 100}
    >
      {/* Slots — indicadores de preenchimento, não são clicáveis:
          a contagem sobe de um em um pelos botões abaixo. */}
      {!usarSlots ? (
        <div className="h-10 overflow-hidden rounded-xl border border-border bg-bg-input">
          <div
            className="flex h-full items-center justify-center text-xs font-semibold transition-[width] duration-300"
            style={{
              width: `${Math.min(100, (count / alvo) * 100)}%`,
              backgroundColor: `color-mix(in oklab, ${cor} 22%, transparent)`,
              color: 'var(--color-text-primary)',
            }}
          >
            {count > 0 && `${count}`}
          </div>
        </div>
      ) : (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: alvo }, (_, i) => {
          const cheio = i < count;
          return (
            <div
              key={i}
              title={`${i + 1} de ${alvo}`}
              className="flex h-10 flex-1 min-w-9 items-center justify-center rounded-xl border transition-[background-color,border-color,box-shadow] duration-300"
              style={{
                backgroundColor: cheio
                  ? `color-mix(in oklab, ${cor} 22%, transparent)`
                  : 'var(--color-bg-input)',
                borderColor: cheio
                  ? `color-mix(in oklab, ${cor} 55%, transparent)`
                  : 'var(--color-border)',
                boxShadow: cheio ? `0 0 12px color-mix(in oklab, ${cor} 30%, transparent)` : undefined,
              }}
            >
              <HabitIcon
                name={habit.icon}
                size={14}
                color={cheio ? cor : 'var(--color-text-muted)'}
                fill={cheio}
              />
            </div>
          );
        })}
      </div>
      )}

      {/* Controles */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onChange(-1)}
          disabled={count === 0}
          className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-bg-input text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary disabled:opacity-40"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={() => onChange(1)}
          // `flex-1` como o de tirar, não `flex-[2]`: os dois fazem a mesma
          // coisa em sentidos opostos, e dar o dobro da largura a um deles
          // sugeria que tirar fosse a ação secundária. Beber de menos e
          // corrigir para baixo é tão comum quanto somar.
          // `border-transparent` só para bater a caixa com a do vizinho, que
          // tem 1px de borda de cada lado. Sem isso os dois `flex-1` davam
          // 179 e 181px — invisível, mas os dois botões deixavam de ser
          // exatamente metade e metade.
          className="btn-grad flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-transparent text-sm font-semibold text-white transition-transform active:scale-95"
        >
          <Plus size={16} />
          Adicionar
        </button>
      </div>
    </CardShell>
  );
}

/** Hábito simples: faixa da semana clicável — dá pra marcar dia passado. */
function WeekHabitCard({
  habit,
  weekDayStrings,
  doneDays,
  todayStr,
  onToggleDay,
  foraDoDia,
}: {
  habit: Habit;
  weekDayStrings: string[];
  doneDays: Set<string>;
  todayStr: string;
  onToggleDay: (dia: string) => void;
  foraDoDia?: boolean;
}) {
  const cor = habit.color ?? 'var(--color-accent)';
  const feitos = weekDayStrings.filter(d => doneDays.has(d)).length;

  return (
    <CardShell
      habit={habit}
      isCompleted={feitos >= habit.frequency}
      foraDoDia={foraDoDia}
      subtitle="Últimos 7 dias"
      counter={{ atual: feitos, alvo: habit.frequency }}
      progress={(feitos / habit.frequency) * 100}
    >
      <div className="flex gap-1.5">
        {weekDayStrings.map(dia => {
          const feito = doneDays.has(dia);
          const ehHoje = dia === todayStr;
          const futuro = dia > todayStr;
          // janela rolante: o rótulo vem do dia da semana da data, não do índice
          const dow = new Date(`${dia}T12:00:00`).getDay();
          const preferencial = habit.preferredDays.includes(dow);
          return (
            <button
              key={dia}
              disabled={futuro}
              onClick={() => onToggleDay(dia)}
              title={
                `${DAY_LABELS[dow]}${preferencial ? ' · dia preferencial' : ''}` +
                ` — clique para marcar`
              }
              className="flex flex-1 flex-col items-center gap-1.5 disabled:opacity-30"
            >
              <span className={`text-[10px] ${ehHoje ? 'font-bold text-text-primary' : 'text-text-muted'}`}>
                {DAY_LABELS[dow].charAt(0)}
              </span>
              {/* A borda destaca os DIAS PREFERENCIAIS do hábito, não o dia de
                  hoje — serve só para enxergar o plano; qualquer dia continua
                  clicável. Hoje é indicado pela letra em negrito acima. */}
              <span
                className="flex aspect-square w-full max-w-10 items-center justify-center rounded-full border-2 transition-[background-color,border-color,box-shadow] duration-200"
                style={{
                  backgroundColor: feito
                    ? `color-mix(in oklab, ${cor} 25%, transparent)`
                    : preferencial
                    ? `color-mix(in oklab, ${cor} 8%, transparent)`
                    : 'transparent',
                  borderColor: feito
                    ? cor
                    : preferencial
                    ? `color-mix(in oklab, ${cor} 50%, transparent)`
                    : 'var(--color-border)',
                  borderStyle: feito || preferencial ? 'solid' : 'dashed',
                }}
              >
                {feito && <Check size={13} strokeWidth={3} style={{ color: cor }} />}
              </span>
            </button>
          );
        })}
      </div>
    </CardShell>
  );
}

interface ActionCardProps {
  action: Action;
  marcada?: boolean;
  onToggle: () => void;
}

function ActionCard({ action, marcada, onToggle }: ActionCardProps) {
  return (
    <div
      onClick={onToggle}
      className={`flex items-center gap-4 px-4 py-4 rounded-xl border cursor-pointer transition-[background-color,border-color] duration-200 group ${
        marcada
          ? 'bg-accent/10 border-accent/40'
          : 'bg-bg-card border-border hover:border-border-light hover:bg-bg-card-hover'
      }`}
    >
      {/* durante a saída o check aparece preenchido, então dá pra ver o
          feedback antes do item recolher */}
      <div
        className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-[background-color,border-color] duration-200 ${
          marcada ? 'bg-accent border-accent' : 'border-border-light group-hover:border-accent'
        }`}
      >
        {marcada && <Check size={14} strokeWidth={3} className="text-bg-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{action.name}</p>
        {action.dueDate && (
          <p className={`text-xs mt-0.5 ${action.dueDate < hojeISO() ? 'text-danger' : 'text-text-muted'}`}>
            {formatarData(action.dueDate, "d 'de' MMMM")}
          </p>
        )}
      </div>
    </div>
  );
}
