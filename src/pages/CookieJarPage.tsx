import { useState, useCallback, useRef } from 'react';
import { Cookie, Trash2, Plus, Search, X, Pencil } from 'lucide-react';
import {
  getCookieJarEntries,
  addCookieJarEntry,
  updateCookieJarEntry,
  deleteCookieJarEntry,
} from '../store';
import type { CookieJarEntry } from '../types';
import { hojeISO as todayISO, formatarData } from '../lib/data';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Historias from '../components/pote/Historias';

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

  /** Qual sub-aba está aberta. Dados e telas separados. */
  const [vista, setVista] = useState<'biscoitos' | 'historias'>('biscoitos');
  /**
   * O formulário só ocupa espaço quando está em uso.
   *
   * Ele era um cartão sempre aberto — textarea de três linhas, campo de
   * categoria, botão e a dica do atalho — uns 180px empurrando os biscoitos
   * para baixo mesmo de quem só queria ler.
   */
  const [escrevendo, setEscrevendo] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CookieJarEntry | null>(null);
  const [edicao, setEdicao] = useState<FormEdicao | null>(null);


  const textareaRef = useRef<HTMLTextAreaElement>(null);


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

  /** Aberto quando está em foco ou já tem texto — fechar com texto dentro
   *  esconderia o botão de guardar. */
  const aberto = escrevendo || description.trim().length > 0;

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
      {/* Cabeçalho: título, frase e a BUSCA na mesma linha.
          Saiu o ícone numa caixa com borda — ele repetia em desenho o que o
          título já dizia em palavra, e ocupava a altura de duas linhas para
          isso. E saiu o "Pegar um biscoito": a busca é mais útil no lugar
          dele, e agora aparece sempre em vez de só depois de três entradas. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary">Pote de Biscoitos</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Quando bater a dúvida, enfie a mão aqui.
          </p>
        </div>

        {entries.length > 0 && (
          <div className="relative w-full flex-shrink-0 sm:w-56">
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
        )}
      </div>

      {/* Sub-abas: o pote e as histórias moram na mesma aba, mas são coisas
          diferentes — uma é curada, a outra é diária. */}
      <div className="flex gap-1 border-b border-border">
        {([['biscoitos', 'Biscoitos'], ['historias', 'Histórias']] as const).map(([chave, rotulo]) => {
          const on = vista === chave;
          return (
            <button
              key={chave}
              onClick={() => setVista(chave)}
              /*
               * `tom-padrao` na aba das Histórias, e não só na tela delas.
               *
               * Os botões vivem dentro do `tube-amber`, então aqui
               * `var(--color-accent)` resolve para o DOURADO — a aba saía cor
               * de pote mesmo apontando para o roxo. A classe devolve o roxo
               * a este botão, e aí a cor da aba anuncia o mundo para onde ela
               * leva.
               */
              className={`font-arcade -mb-px border-b-2 px-3.5 py-2.5 text-[0.5rem] uppercase leading-none transition-colors ${
                chave === 'historias' ? 'tom-padrao' : ''
              }`}
              style={{
                borderColor: on ? 'var(--color-accent)' : 'transparent',
                color: on ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}
            >
              {rotulo}
            </button>
          );
        })}
      </div>

      {vista === 'historias' ? <Historias /> : <>

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
          onFocus={() => setEscrevendo(true)}
          placeholder="O que aconteceu que vale guardar?"
          // Uma linha fechado, três escrevendo. É a diferença entre um campo
          // que espera e um cartão que ocupa a tela sem ser usado.
          rows={aberto ? 3 : 1}
          className="entrada resize-none"
        />

        {/* Categoria, botão e atalhos só existem quando há o que salvar. */}
        {aberto && (
        <>
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

        {/* A dica só enquanto se escreve. Permanente, ela era mais uma linha
            ocupando a tela para explicar um atalho que ninguém vai usar
            enquanto está só lendo. */}
        <p className="text-xs text-text-muted">Ctrl+Enter para guardar rapidamente</p>
        </>
        )}
      </div>

      {/* As categorias como filtro. A busca subiu para o cabeçalho — aqui
          ela era invisível até haver mais de três biscoitos, justamente
          quando ainda não fazia falta. */}
      {entries.length > 0 && (
        <div className="space-y-3">
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

      </>}

      {/* Os modais ficam FORA do fragmento das sub-abas. */}

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
                    color: 'var(--color-accent)',
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
