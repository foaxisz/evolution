import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { Plus, Edit2, Trash2, Target, ChevronUp, ChevronDown } from 'lucide-react';
import { getHabits, saveHabit, deleteHabit, getHabitLogs, toggleHabitLog, moverHabito } from '../store';
import type { Habit, HabitLog } from '../types';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import HabitIcon, { HABIT_ICONS, HABIT_ICON_KEYS } from '../components/ui/HabitIcon';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const PRESET_COLORS = [
  '#a855f7', // roxo (padrão)
  '#c88cff', // lavanda
  '#7c3aed', // violeta profundo
  '#38bdf8', // ciano
  '#3ddc97', // verde
  '#ffb000', // âmbar
  '#ff6b35', // laranja
  '#ff4d8d', // rosa
  '#00e5ff', // turquesa
  '#ffe600', // amarelo
];

interface FormData {
  name: string;
  description: string;
  frequency: number;
  preferredDays: number[];
  color: string;
  icon: string;
  contavel: boolean;
  dailyTarget: number;
  unit: string;
}

/** Teto da meta diária. Acima disso não é meta, é digitação errada — e o
 *  valor vira quantidade de elementos na tela Hoje. */
const META_MAXIMA = 99;

function limitarMeta(valor: number): number {
  if (!Number.isFinite(valor)) return 2;
  return Math.min(META_MAXIMA, Math.max(2, Math.floor(valor)));
}

/** Frequência semanal: no máximo os 7 dias da semana. */
function limitarFrequencia(valor: number): number {
  if (!Number.isFinite(valor)) return 1;
  return Math.min(7, Math.max(1, Math.floor(valor)));
}

const DEFAULT_FORM: FormData = {
  name: '',
  description: '',
  frequency: 3,
  preferredDays: [],
  color: '#a855f7',
  icon: 'target',
  contavel: false,
  dailyTarget: 6,
  unit: '',
};

export default function HabitsPage() {
  // idem TodayPage: sem isto o primeiro frame mostra o estado vazio
  const [habits, setHabits] = useState<Habit[]>(() => getHabits().filter(h => !h.archived));
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>(() => getHabitLogs());
  const [showForm, setShowForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [formError, setFormError] = useState('');

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  // Janela rolante de 7 dias terminando hoje — igual à tela Hoje.
  const weekDayStrings = Array.from({ length: 7 }, (_, i) =>
    format(subDays(today, 6 - i), 'yyyy-MM-dd')
  );

  const load = useCallback(() => {
    setHabits(getHabits().filter(h => !h.archived));
    setHabitLogs(getHabitLogs());
  }, []);

  useEffect(() => { load(); }, [load]);

  const weekLogs = habitLogs.filter(l => weekDayStrings.includes(l.date) && l.completed);

  // ── Form handlers ──────────────────────────────────────────────────────────

  function openCreate() {
    setEditingHabit(null);
    setForm(DEFAULT_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(habit: Habit) {
    setEditingHabit(habit);
    setForm({
      name: habit.name,
      description: habit.description ?? '',
      frequency: habit.frequency,
      preferredDays: [...habit.preferredDays],
      color: habit.color ?? '#a855f7',
      icon: habit.icon ?? 'target',
      contavel: !!habit.dailyTarget && habit.dailyTarget > 1,
      dailyTarget: habit.dailyTarget ?? 6,
      unit: habit.unit ?? '',
    });
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setFormError('');
  }

  function handleSave() {
    if (!form.name.trim()) {
      setFormError('O nome do hábito é obrigatório.');
      return;
    }
    saveHabit({
      id: editingHabit?.id,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      frequency: limitarFrequencia(form.frequency),
      preferredDays: [...form.preferredDays].sort((a, b) => a - b),
      color: form.color,
      icon: form.icon,
      // `min`/`max` do input não seguram valor digitado à mão — só o
      // seletor. Sem o teto aqui, uma meta absurda ia parar no
      // localStorage e travava a tela Hoje em toda abertura.
      dailyTarget: form.contavel ? limitarMeta(form.dailyTarget) : undefined,
      unit: form.contavel ? form.unit.trim() || undefined : undefined,
    });
    closeForm();
    load();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteHabit(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  function toggleDay(dow: number) {
    setForm(f => ({
      ...f,
      preferredDays: f.preferredDays.includes(dow)
        ? f.preferredDays.filter(d => d !== dow)
        : [...f.preferredDays, dow],
    }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Hábitos</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent-dim transition-colors shadow-lg shadow-accent/20"
        >
          <Plus size={16} />
          Novo Hábito
        </button>
      </div>

      {/* Habits list */}
      {habits.length === 0 ? (
        <EmptyState
          icon={<Target size={40} />}
          message="Nenhum hábito criado ainda. Comece agora!"
          actionLabel="Criar primeiro hábito"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-3">
          {habits.map((habit, i) => {
            const habitWeekLogs = weekLogs.filter(l => l.habitId === habit.id);
            return (
              <HabitManageCard
                key={habit.id}
                habit={habit}
                habitWeekLogs={habitWeekLogs}
                todayStr={todayStr}
                onToggleDay={dia => { toggleHabitLog(habit.id, dia); load(); }}
                weekDayStrings={weekDayStrings}
                onEdit={() => openEdit(habit)}
                onDelete={() => setDeleteTarget(habit)}
                onSubir={i > 0 ? () => { moverHabito(habit.id, -1); load(); } : undefined}
                onDescer={i < habits.length - 1 ? () => { moverHabito(habit.id, 1); load(); } : undefined}
              />
            );
          })}
        </div>
      )}

      {/* ── Habit Form Modal ── */}
      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingHabit ? 'Editar Hábito' : 'Novo Hábito'}
        maxWidth="max-w-lg"
      >
        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Nome <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Ex: Meditar, Exercitar, Ler…"
              autoFocus
              className={`w-full bg-bg-input border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors ${
                formError ? 'border-danger' : 'border-border focus:border-accent'
              }`}
            />
            {formError && <p className="text-xs text-danger mt-1">{formError}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Descrição
            </label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Opcional…"
              className="w-full bg-bg-input border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Frequência — {form.frequency}x por semana
            </label>
            {/* Empilhado no celular. Lado a lado, os sete botões somam
                220px fixos e o `input[type=range]` tem largura mínima
                própria de ~130px — `flex-1` não encolhe abaixo dela sem
                `min-w-0`, então a fileira vazava para fora da tela.
                Em grade de 7 colunas os botões dividem a largura que
                existe, seja ela qual for. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <input
                type="range"
                min={1}
                max={7}
                value={form.frequency}
                onChange={e => setForm(f => ({ ...f, frequency: Number(e.target.value) }))}
                aria-label="Frequência semanal"
                className="h-1.5 w-full min-w-0 accent-accent cursor-pointer sm:flex-1"
              />
              <div className="grid grid-cols-7 gap-1 sm:flex sm:flex-none">
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, frequency: n }))}
                    aria-pressed={form.frequency === n}
                    className={`h-8 w-full rounded-lg text-xs font-bold transition-all sm:h-7 sm:w-7 ${
                      form.frequency === n
                        ? 'bg-accent text-white sm:scale-110'
                        : 'bg-bg-card-hover text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Meta contável no dia */}
          <div className="rounded-xl border border-border bg-bg-input p-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.contavel}
                onChange={e => setForm(f => ({ ...f, contavel: e.target.checked }))}
                className="h-4 w-4 accent-accent"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-text-primary">
                  Contar várias vezes por dia
                </span>
                <span className="block text-xs text-text-muted">
                  Ex: 6 copos de água — conclui sozinho ao bater a meta
                </span>
              </span>
            </label>

            {form.contavel && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                    Meta por dia
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={form.dailyTarget}
                    onChange={e => setForm(f => ({ ...f, dailyTarget: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                    Unidade
                  </label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    placeholder="copos, min…"
                    className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Preferred Days */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Dias preferenciais
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_NAMES.map((name, dow) => {
                const active = form.preferredDays.includes(dow);
                return (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => toggleDay(dow)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? 'bg-accent text-white shadow-md shadow-accent/20'
                        : 'bg-bg-card-hover text-text-secondary hover:text-text-primary hover:bg-border'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            {form.preferredDays.length > 0 && form.preferredDays.length < form.frequency && (
              <p className="text-xs text-warning mt-1.5">
                Dica: selecione pelo menos {form.frequency} dias para combinar com a frequência.
              </p>
            )}
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Cor
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color }))}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110 active:scale-95"
                  style={{
                    backgroundColor: color,
                    boxShadow: form.color === color ? `0 0 0 2px #1a1a25, 0 0 0 4px ${color}` : 'none',
                    transform: form.color === color ? 'scale(1.15)' : undefined,
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Ícone */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Ícone
            </label>
            <div className="flex flex-wrap gap-2">
              {HABIT_ICON_KEYS.map(key => {
                const ativo = form.icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, icon: key }))}
                    title={HABIT_ICONS[key].label}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:scale-110"
                    style={{
                      backgroundColor: ativo
                        ? `color-mix(in oklab, ${form.color} 22%, transparent)`
                        : 'var(--color-bg-input)',
                      borderColor: ativo ? form.color : 'var(--color-border)',
                    }}
                  >
                    <HabitIcon
                      name={key}
                      size={16}
                      color={ativo ? form.color : 'var(--color-text-muted)'}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={closeForm}
              className="flex-1 py-3 text-sm font-semibold text-text-secondary hover:text-text-primary bg-bg-card-hover rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 text-sm font-semibold text-white bg-accent hover:bg-accent-dim rounded-xl transition-colors shadow-lg shadow-accent/20"
            >
              {editingHabit ? 'Salvar Alterações' : 'Criar Hábito'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Confirm Delete ── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Hábito"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Todos os registros serão removidos permanentemente.`}
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface HabitManageCardProps {
  habit: Habit;
  habitWeekLogs: HabitLog[];
  weekDayStrings: string[];
  todayStr: string;
  onToggleDay: (dia: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSubir?: () => void;
  onDescer?: () => void;
}

function HabitManageCard({
  habit, habitWeekLogs, weekDayStrings, todayStr, onToggleDay, onEdit, onDelete, onSubir, onDescer,
}: HabitManageCardProps) {
  const accentColor = habit.color ?? 'var(--color-accent)';
  const weekCount = habitWeekLogs.length;
  const pct = Math.min(100, Math.round((weekCount / habit.frequency) * 100));

  return (
    <div
      className="p-4 rounded-xl border bg-bg-card border-border hover:border-border-light transition-all duration-200 animate-slide-up"
      style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}
    >
      <div className="flex items-start gap-3">
        {/* Ícone do hábito */}
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in oklab, ${accentColor} 18%, transparent)` }}
        >
          <HabitIcon name={habit.icon} size={15} color={accentColor} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row: name + actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-text-primary text-sm leading-tight truncate">{habit.name}</h3>
              {habit.description && (
                <p className="text-xs text-text-muted mt-0.5 truncate">{habit.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={onSubir}
                disabled={!onSubir}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-accent-light disabled:opacity-25"
                title="Mover para cima"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={onDescer}
                disabled={!onDescer}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-accent-light disabled:opacity-25"
                title="Mover para baixo"
              >
                <ChevronDown size={14} />
              </button>
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg text-text-muted hover:text-accent-light hover:bg-accent/10 transition-colors"
                title="Editar"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger-bg transition-colors"
                title="Excluir"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Meta row: frequency + preferred days */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs text-text-muted">{habit.frequency}x por semana</span>
            {habit.preferredDays.length > 0 && (
              <div className="flex gap-1">
                {DAY_NAMES.map((name, dow) => (
                  <span
                    key={dow}
                    className={`text-xs font-medium px-1.5 py-0.5 rounded-md transition-colors ${
                      habit.preferredDays.includes(dow)
                        ? 'text-accent-light bg-accent/10'
                        : 'text-text-muted'
                    }`}
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Progress row */}
          <div className="flex items-center gap-3 mt-2.5">
            {/* Week count */}
            <span
              className="text-xs font-semibold"
              style={{ color: weekCount >= habit.frequency ? 'var(--color-success)' : accentColor }}
            >
              {weekCount}/{habit.frequency} em 7 dias
            </span>

            {/* Mini progress bar */}
            <div className="flex-1 h-1 bg-bg-primary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: weekCount >= habit.frequency ? 'var(--color-success)' : accentColor,
                }}
              />
            </div>

            {/* Faixa da semana — clicável, dá pra marcar dia esquecido */}
            <div className="flex gap-1">
              {weekDayStrings.map((dayStr, idx) => {
                // janela rolante: rótulo vem da data, não do índice
                const dayDow = new Date(`${dayStr}T12:00:00`).getDay();
                const isDone = habitWeekLogs.some(l => l.date === dayStr);
                const isPreferred = habit.preferredDays.includes(dayDow);
                const futuro = dayStr > todayStr;
                return (
                  <button
                    key={dayStr}
                    disabled={futuro}
                    onClick={() => onToggleDay(dayStr)}
                    title={futuro ? 'Dia futuro' : `${DAY_NAMES[dayDow]} — clique para marcar`}
                    aria-label={`${DAY_NAMES[dayDow]}, ${dayStr}${isDone ? ' — feito' : ''}`}
                    className="alvo-toque alvo-toque-densa w-5 h-5 rounded-md border text-[9px] font-semibold transition-all hover:scale-125 disabled:opacity-25 disabled:hover:scale-100"
                    style={{
                      backgroundColor: isDone
                        ? accentColor
                        : isPreferred
                        ? `color-mix(in oklab, ${accentColor} 18%, transparent)`
                        : 'transparent',
                      borderColor: isDone
                        ? accentColor
                        : `color-mix(in oklab, ${accentColor} 35%, transparent)`,
                      color: isDone ? 'var(--color-bg-primary)' : 'var(--color-text-muted)',
                    }}
                  >
                    {DAY_NAMES[dayDow].charAt(0)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
