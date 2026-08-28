import { useState, useCallback, useRef } from 'react';
import { Cookie, Trash2, Plus, Search, X, Pencil, HandMetal } from 'lucide-react';
import { parseISO } from 'date-fns';
import {
  getCookieJarEntries,
  addCookieJarEntry,
  updateCookieJarEntry,
  deleteCookieJarEntry,
} from '../store';
import type { CookieJarEntry } from '../types';
import { hojeISO as todayISO, formatarData, desdeQuando } from '../lib/data';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';

function groupByMonth(entries: CookieJarEntry[]): Array<[string, CookieJarEntry[]]> {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const map = new Map<string, CookieJarEntry[]>();
  for (const entry of sorted) {
    const monthKey = entry.date.slice(0, 7); // YYYY-MM
    if (!map.has(monthKey)) map.set(monthKey, []);
    map.get(monthKey)!.push(entry);
  }
  return Array.from(map.entries());
}

function formatMonthHeader(monthKey: string): string {
  const label = formatarData(`${monthKey}-01`, "MMMM 'de' yyyy", '');
  if (!label) return 'Sem data';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Sorteio com peso na idade. Uniforme não serve para o que o pote é: o
 * biscoito de ontem você ainda lembra, o de um ano atrás é o que bate
 * forte. Peso = 1 + dias/60, então um registro de um ano sai ~7x mais que
 * o de hoje. `evitar` impede repetir o que acabou de sair — e se todos
 * estiverem na lista de evitados, volta a considerar o pote inteiro, o
 * que mantém o sorteio de um pote com um biscoito só funcionando.
 */
function sortear(entries: CookieJarEntry[], evitar: string[]): CookieJarEntry | null {
  if (entries.length === 0) return null;

  const candidatos = entries.filter(e => !evitar.includes(e.id));
  const pool = candidatos.length > 0 ? candidatos : entries;

  const agora = Date.now();
  const pesos = pool.map(e => {
    const t = parseISO(e.date).getTime();
    const dias = Number.isNaN(t) ? 0 : Math.max(0, (agora - t) / 86_400_000);
    return 1 + dias / 60;
  });

  const total = pesos.reduce((s, p) => s + p, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= pesos[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

interface FormEdicao {
  id: string;
  description: string;
  category: string;
}

export default function CookieJarPage() {
  const [entries, setEntries] = useState<CookieJarEntry[]>(() => getCookieJarEntries());

  const reload = useCallback(() => {
    setEntries(getCookieJarEntries());
  }, []);

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CookieJarEntry | null>(null);
  const [edicao, setEdicao] = useState<FormEdicao | null>(null);

  /** biscoito sorteado no momento */
  const [sorteado, setSorteado] = useState<CookieJarEntry | null>(null);
  /** ids sorteados recentemente, para não repetir em sequência */
  const ultimos = useRef<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function puxarBiscoito() {
    // Evita no máximo os últimos 3, e nunca mais do que o pote comporta.
    const limite = Math.min(3, Math.max(0, entries.length - 1));
    const escolhido = sortear(entries, ultimos.current.slice(0, limite));
    if (!escolhido) return;
    ultimos.current = [escolhido.id, ...ultimos.current.filter(id => id !== escolhido.id)].slice(0, 3);
    setSorteado(escolhido);
  }

  function handleAdd() {
    const desc = description.trim();
    if (!desc) return;
    addCookieJarEntry({
      date: todayISO(),
      description: desc,
      category: category.trim() || undefined,
    });
    setDescription('');
    setCategory('');
    reload();
    textareaRef.current?.focus();
  }

  function salvarEdicao() {
    if (!edicao || !edicao.description.trim()) return;
    updateCookieJarEntry(edicao.id, {
      description: edicao.description.trim(),
      category: edicao.category.trim() || undefined,
    });
    setEdicao(null);
    reload();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteCookieJarEntry(deleteTarget.id);
    setDeleteTarget(null);
    reload();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAdd();
    }
  }

  // Categorias existentes — não há CRUD aqui, elas nascem do que já foi escrito.
  const categorias = Array.from(
    new Set(entries.map(e => e.category?.trim()).filter((c): c is string => !!c))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const termo = busca.trim().toLowerCase();
  const filtradas = entries.filter(e => {
    if (catFiltro && e.category?.trim() !== catFiltro) return false;
    if (!termo) return true;
    return (
      e.description.toLowerCase().includes(termo) ||
      (e.category ?? '').toLowerCase().includes(termo)
    );
  });

  const grouped = groupByMonth(filtradas);
  const filtrando = !!termo || !!catFiltro;

  return (
    <div className="tube-amber mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 md:p-6 lg:p-8 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl border"
              style={{
                backgroundColor: 'var(--color-cookie-bg)',
                borderColor: 'color-mix(in oklab, var(--color-accent) 30%, transparent)',
              }}
            >
              <Cookie size={20} style={{ color: 'var(--color-cookie)' }} />
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Pote de Biscoitos</h1>
          </div>
          {/* O pote guarda o que vale relembrar: tanto o que custou e você
              fez assim mesmo, quanto o dia em que algo deu certo. Os dois
              servem para a mesma coisa — consultar quando bater a dúvida.
              A frase dizia só "coisas difíceis que você já superou", e isso
              deixava metade do pote de fora. */}
          <p className="text-sm text-text-secondary">
            Quando bater a dúvida, enfie a mão aqui.
          </p>
        </div>

        {entries.length > 0 && (
          <button
            onClick={puxarBiscoito}
            className="flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-[filter] duration-150 hover:brightness-110"
            style={{
              backgroundColor: 'var(--color-cookie)',
              color: 'var(--color-bg-primary)',
              boxShadow: '0 4px 18px color-mix(in oklab, var(--color-cookie) 35%, transparent)',
            }}
          >
            <HandMetal size={16} />
            Pegar um biscoito
          </button>
        )}
      </div>

      {/* Registrar */}
      <div
        className="space-y-3 rounded-2xl border p-5"
        style={{
          backgroundColor: 'var(--color-cookie-bg)',
          borderColor: 'color-mix(in oklab, var(--color-accent) 20%, transparent)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="O que aconteceu que vale guardar?"
          rows={3}
          className="entrada resize-none"
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="Categoria (opcional)"
            className="entrada min-w-0 flex-1"
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button
            onClick={handleAdd}
            disabled={!description.trim()}
            className="flex flex-shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-[opacity,filter] duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-cookie)', color: 'var(--color-bg-primary)' }}
          >
            <Plus size={16} />
            Guardar
          </button>
        </div>

        {/* Categorias já usadas viram atalho: evita "Treino" e "treino"
            virarem duas categorias diferentes. Só aparecem enquanto você
            escreve — senão ficam duas fileiras de chips quase iguais na
            tela (estas preenchem o campo, as de baixo filtram a lista). */}
        {categorias.length > 0 && description.trim().length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {categorias.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className="rounded-full border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
                style={{ borderColor: 'color-mix(in oklab, var(--color-accent) 22%, transparent)' }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-text-muted">Ctrl+Enter para guardar rapidamente</p>
      </div>

      {/* Busca e filtro — a partir de algumas dezenas, achar um vira problema */}
      {entries.length > 3 && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar no pote…"
              className="entrada pl-9"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-primary"
                aria-label="Limpar busca"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <ChipCat ativo={!catFiltro} onClick={() => setCatFiltro(null)} rotulo="Todas" contagem={entries.length} />
              {categorias.map(c => (
                <ChipCat
                  key={c}
                  ativo={catFiltro === c}
                  onClick={() => setCatFiltro(catFiltro === c ? null : c)}
                  rotulo={c}
                  contagem={entries.filter(e => e.category?.trim() === c).length}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pote vazio */}
      {entries.length === 0 && (
        <EmptyState
          icon={<Cookie size={26} />}
          message="Pote vazio"
          subtitle="Guarde a primeira: algo que vale relembrar depois."
        />
      )}

      {/* Nada encontrado */}
      {entries.length > 0 && filtradas.length === 0 && (
        <EmptyState
          icon={<Search size={26} />}
          message="Nenhum biscoito encontrado"
          subtitle="Tente outra palavra ou limpe o filtro."
          actionLabel="Limpar filtros"
          onAction={() => { setBusca(''); setCatFiltro(null); }}
        />
      )}

      {/* Linha do tempo por mês */}
      {grouped.length > 0 && (
        <div className="space-y-10">
          {grouped.map(([monthKey, monthEntries]) => (
            <div key={monthKey}>
              <div className="mb-5 flex items-center gap-3">
                <h2
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--color-cookie)' }}
                >
                  {formatMonthHeader(monthKey)}
                </h2>
                <div className="h-px flex-1" style={{ backgroundColor: 'color-mix(in oklab, var(--color-accent) 15%, transparent)' }} />
                <span className="text-xs text-text-muted">
                  {monthEntries.length} biscoito{monthEntries.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="relative">
                <div
                  className="absolute bottom-0 left-4 top-0 w-px"
                  style={{ backgroundColor: 'color-mix(in oklab, var(--color-accent) 12%, transparent)' }}
                />
                <div className="space-y-3 pl-10">
                  {monthEntries.map(entry => (
                    <TimelineEntry
                      key={entry.id}
                      entry={entry}
                      onEditar={() => setEdicao({
                        id: entry.id,
                        description: entry.description,
                        category: entry.category ?? '',
                      })}
                      onDelete={() => setDeleteTarget(entry)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contagem do pote — some quando está filtrando, senão engana */}
      {entries.length > 0 && !filtrando && (
        <p className="text-xs text-text-muted">
          {entries.length} biscoito{entries.length !== 1 ? 's' : ''} no pote
        </p>
      )}

      {/* ── O saque ── */}
      <Modal
        isOpen={!!sorteado}
        onClose={() => setSorteado(null)}
        title="Você viveu isto"
        maxWidth="max-w-lg"
        rodape={
          <div className="flex gap-3">
            <button
              onClick={() => setSorteado(null)}
              className="flex-1 rounded-xl bg-bg-card-hover py-3 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
            >
              Fechar
            </button>
            <button
              onClick={puxarBiscoito}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-[filter] hover:brightness-110"
              style={{ backgroundColor: 'var(--color-cookie)', color: 'var(--color-bg-primary)' }}
            >
              <HandMetal size={15} />
              Pegar outro
            </button>
          </div>
        }
      >
        {sorteado && (
          <div className="tube-amber py-2 text-center">
            <Cookie
              size={30}
              className="mx-auto mb-5"
              style={{ color: 'var(--color-cookie)', filter: 'drop-shadow(0 0 14px var(--color-cookie))' }}
            />
            <p className="text-lg leading-relaxed text-text-primary">{sorteado.description}</p>
            <p className="mt-5 text-xs uppercase tracking-wider text-text-muted">
              {formatarData(sorteado.date, "d 'de' MMMM 'de' yyyy")}
              {' · '}
              {desdeQuando(sorteado.date)}
            </p>
            {sorteado.category && (
              <span
                className="mt-3 inline-block rounded-full border px-2.5 py-1 text-xs"
                style={{
                  color: 'var(--color-cookie)',
                  borderColor: 'color-mix(in oklab, var(--color-accent) 25%, transparent)',
                }}
              >
                {sorteado.category}
              </span>
            )}
          </div>
        )}
      </Modal>

      {/* ── Editar ── */}
      <Modal
        isOpen={!!edicao}
        onClose={() => setEdicao(null)}
        title="Editar biscoito"
        maxWidth="max-w-md"
        rodape={
          <div className="flex gap-3">
            <button
              onClick={() => setEdicao(null)}
              className="flex-1 rounded-xl bg-bg-card-hover py-3 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
            >
              Cancelar
            </button>
            <button
              onClick={salvarEdicao}
              disabled={!edicao?.description.trim()}
              className="flex-1 rounded-xl py-3 text-sm font-semibold transition-[filter] hover:brightness-110 disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-cookie)', color: 'var(--color-bg-primary)' }}
            >
              Salvar
            </button>
          </div>
        }
      >
        {edicao && (
          <div className="space-y-4">
            <textarea
              value={edicao.description}
              onChange={e => setEdicao(f => f && { ...f, description: e.target.value })}
              rows={4}
              autoFocus
              className="entrada resize-none"
            />
            <input
              type="text"
              value={edicao.category}
              onChange={e => setEdicao(f => f && { ...f, category: e.target.value })}
              placeholder="Categoria (opcional)"
              onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(); }}
              className="entrada"
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remover biscoito"
        message="Tem certeza que deseja tirar isto do pote?"
        confirmLabel="Remover"
        danger
      />
    </div>
  );
}

/* ---------- Subcomponentes ---------- */

function ChipCat({
  ativo, onClick, rotulo, contagem,
}: {
  ativo: boolean; onClick: () => void; rotulo: string; contagem: number;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-[background-color,border-color] duration-200"
      style={{
        backgroundColor: ativo ? 'color-mix(in oklab, var(--color-accent) 18%, transparent)' : 'var(--color-bg-card)',
        borderColor: ativo ? 'var(--color-accent)' : 'var(--color-border)',
      }}
    >
      <span className={ativo ? 'font-medium text-text-primary' : 'text-text-secondary'}>{rotulo}</span>
      <span className="text-xs text-text-muted">{contagem}</span>
    </button>
  );
}

interface TimelineEntryProps {
  entry: CookieJarEntry;
  onEditar: () => void;
  onDelete: () => void;
}

/**
 * O hover é puro CSS. Antes o item sob o mouse ficava em estado React,
 * então cada movimento re-renderizava a lista inteira e a página travava.
 */
function TimelineEntry({ entry, onEditar, onDelete }: TimelineEntryProps) {
  const formattedDate = formatarData(entry.date, "d 'de' MMMM");

  return (
    <div className="group relative">
      <div
        className="absolute -left-[1.625rem] top-4 h-2.5 w-2.5 rounded-full border-2 bg-bg-card transition-[background-color,transform] duration-150 group-hover:scale-125 group-hover:bg-cookie"
        style={{ borderColor: 'var(--color-cookie)' }}
      />

      <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-bg-card p-4 transition-[background-color,border-color] duration-150 group-hover:border-accent/25 group-hover:bg-accent/[0.06]">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-text-primary">{entry.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">{formattedDate}</span>
            {entry.category && (
              <>
                <span className="text-xs text-text-muted">·</span>
                <span
                  className="rounded-full border px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: 'color-mix(in oklab, var(--color-accent) 12%, transparent)',
                    color: 'var(--color-cookie)',
                    borderColor: 'color-mix(in oklab, var(--color-accent) 20%, transparent)',
                  }}
                >
                  {entry.category}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Sempre visíveis: no celular não existe hover, e antes estas
            ações ficavam inalcançáveis. */}
        <div className="flex flex-shrink-0 items-center gap-1 opacity-45 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEditar}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-cookie"
            aria-label="Editar entrada"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-danger"
            aria-label="Excluir entrada"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
