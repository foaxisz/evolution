import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { BookOpen, Plus, ArrowLeft, Trash2, Star, X } from 'lucide-react';
import { format, getISOWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getReviews, saveReview, deleteReview } from '../store';
import { hojeISO, paraData, formatarData } from '../lib/data';
import type { Review } from '../types';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';

/** Cores de entrada — as mesmas usadas em hábitos e categorias de compras. */
const CORES = ['#a855f7', '#c88cff', '#38bdf8', '#3ddc97', '#ffb000', '#ff6b35', '#ff4d8d', '#00e5ff'];

const COR_PADRAO = 'var(--color-accent)';


function rotuloSemana(dataStr: string): string {
  const d = paraData(dataStr);
  if (!d) return 'Data não reconhecida';
  const mes = format(d, 'MMMM yyyy', { locale: ptBR });
  return `Semana ${getISOWeek(d)} · ${mes.charAt(0).toUpperCase() + mes.slice(1)}`;
}

interface Rascunho {
  id?: string;
  date: string;
  title: string;
  content: string;
  area: string;
  color: string;
  overallFeeling: number;
}

function rascunhoVazio(): Rascunho {
  // sentimento começa em 0 — nada pré-marcado
  return { date: hojeISO(), title: '', content: '', area: '', color: '', overallFeeling: 0 };
}

/** Área de uma entrada, com fallback para o formato antigo (notas por área). */
function areaDe(r: Review): string {
  return r.area ?? r.areas?.[0]?.name ?? '';
}

/** Título para a lista. Sem título escrito, usa a primeira linha do texto
 *  — "Sem título" repetido na lista não diz nada sobre a entrada. */
function tituloDe(r: Review): string {
  const t = r.title?.trim();
  if (t) return t;
  const corpo = (r.content || [r.wins, r.struggles, r.insights].filter(Boolean).join(' ')).trim();
  const primeira = corpo.split('\n').map(l => l.trim()).find(Boolean);
  if (primeira) return primeira.length > 64 ? `${primeira.slice(0, 64)}…` : primeira;
  return rotuloSemana(r.date);
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>(() =>
    getReviews().sort((a, b) => b.date.localeCompare(a.date))
  );
  /** null = lista; caso contrário está no editor */
  const [editor, setEditor] = useState<Rascunho | null>(null);
  const [excluir, setExcluir] = useState<Review | null>(null);
  const [filtro, setFiltro] = useState<string>('todas');
  const [novaArea, setNovaArea] = useState('');
  const textoRef = useRef<HTMLTextAreaElement>(null);

  /** todas as áreas já usadas, para virarem sugestão e filtro */
  const areasConhecidas = useMemo(() => {
    const s = new Set<string>();
    reviews.forEach(r => { const a = areaDe(r); if (a) s.add(a); });
    return [...s].sort();
  }, [reviews]);

  const visiveis = useMemo(
    () => filtro === 'todas' ? reviews : reviews.filter(r => areaDe(r) === filtro),
    [reviews, filtro]
  );

  const recarregar = useCallback(() => {
    setReviews(getReviews().sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  // textarea cresce com o conteúdo, sem barra de rolagem interna
  useEffect(() => {
    const el = textoRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [editor?.content, editor]);

  function abrirNova() {
    setEditor(rascunhoVazio());
  }

  function abrir(r: Review) {
    // entradas antigas: junta os três campos num texto só para leitura
    const legado = [
      r.wins && `O que conquistei\n${r.wins}`,
      r.struggles && `O que não funcionou\n${r.struggles}`,
      r.insights && `Percepções\n${r.insights}`,
    ].filter(Boolean).join('\n\n');

    setEditor({
      id: r.id,
      date: r.date,
      title: r.title ?? '',
      content: r.content ?? legado,
      area: areaDe(r),
      color: r.color ?? '',
      overallFeeling: r.overallFeeling,
    });
  }

  function salvar() {
    if (!editor) return;
    saveReview({
      ...(editor.id ? { id: editor.id } : {}),
      date: editor.date,
      weekLabel: rotuloSemana(editor.date),
      title: editor.title.trim() || undefined,
      content: editor.content,
      area: editor.area.trim() || undefined,
      color: editor.color || undefined,
      areas: [],
      wins: '',
      struggles: '',
      insights: '',
      overallFeeling: editor.overallFeeling,
    });
    setEditor(null);
    setNovaArea('');
    recarregar();
  }

  // ── Editor (estilo diário) ──
  if (editor) {
    const palavras = editor.content.trim() ? editor.content.trim().split(/\s+/).length : 0;
    const corEditor = editor.color || COR_PADRAO;

    return (
      <div className="relative flex-1 w-full animate-fade-in px-6 pb-20 pt-5 md:px-12 lg:px-20">
        {/* Brilho no topo, na cor da entrada: o caráter de diário vem da
            luz, não de tingir o texto inteiro. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-72 transition-[background-image] duration-500"
          style={{
            backgroundImage: `radial-gradient(55% 100% at 50% 0%, color-mix(in oklab, ${corEditor} 14%, transparent), transparent 70%)`,
          }}
          aria-hidden
        />

        <div className="relative">
        {/* Barra superior */}
        <div className="mb-10 flex items-center gap-3">
          <button
            onClick={() => setEditor(null)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <span className="ml-auto text-xs text-text-muted">
            {palavras} {palavras === 1 ? 'palavra' : 'palavras'}
          </span>
          <button
            onClick={salvar}
            className="btn-grad rounded-xl px-5 py-2 text-sm font-semibold text-white"
          >
            Salvar
          </button>
        </div>

        {/* Data */}
        <input
          type="date"
          value={editor.date}
          onChange={e => setEditor(d => d && { ...d, date: e.target.value })}
          className="mb-2 border-none bg-transparent p-0 text-xs text-text-muted focus:outline-none"
        />
        <p className="mb-4 text-xs text-text-muted">{rotuloSemana(editor.date)}</p>

        {/* Título — sem placeholder, você sabe o que escrever */}
        <input
          type="text"
          value={editor.title}
          onChange={e => setEditor(d => d && { ...d, title: e.target.value })}
          autoFocus
          className="mb-6 w-full border-none bg-transparent p-0 text-4xl font-bold text-text-primary focus:outline-none"
        />

        {/* Texto livre */}
        <textarea
          ref={textoRef}
          value={editor.content}
          onChange={e => setEditor(d => d && { ...d, content: e.target.value })}
          rows={14}
          className="w-full resize-none border-none bg-transparent p-0 text-[16px] leading-[1.75] text-text-primary focus:outline-none"
        />

        {/* Notas — ficam abaixo do texto, como metadados da entrada */}
        <div className="mt-10 space-y-5 border-t border-border pt-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Sentimento geral
            </p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setEditor(d => d && { ...d, overallFeeling: n })}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={22}
                    style={{ color: editor.overallFeeling >= n ? 'var(--color-warning)' : 'var(--color-border-light)' }}
                    fill={editor.overallFeeling >= n ? 'var(--color-warning)' : 'none'}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Cor desta entrada — tinge o card dela na lista */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Cor da entrada
            </p>
            <div className="flex flex-wrap gap-2">
              {CORES.map(cor => {
                const ativa = editor.color === cor;
                return (
                  <button
                    key={cor}
                    onClick={() => setEditor(d => d && { ...d, color: ativa ? '' : cor })}
                    title={ativa ? 'Remover a cor' : 'Usar esta cor'}
                    className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: cor,
                      boxShadow: ativa ? `0 0 0 2px var(--color-bg-primary), 0 0 0 4px ${cor}` : 'none',
                      opacity: ativa ? 1 : 0.5,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Área única da entrada — vira o filtro da lista */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Área
            </p>
            <div className="flex flex-wrap gap-2">
              {areasConhecidas.map(a => {
                const ativa = editor.area === a;
                return (
                  <button
                    key={a}
                    onClick={() => setEditor(d => d && { ...d, area: ativa ? '' : a })}
                    className="rounded-full border px-3.5 py-1.5 text-sm transition-[background-color,border-color] duration-200"
                    style={{
                      backgroundColor: ativa ? 'var(--color-accent-bg)' : 'transparent',
                      borderColor: ativa ? 'var(--color-accent)' : 'var(--color-border)',
                      color: ativa ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {a}
                  </button>
                );
              })}

              <input
                type="text"
                value={novaArea}
                onChange={e => setNovaArea(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && novaArea.trim()) {
                    e.preventDefault();
                    setEditor(d => d && { ...d, area: novaArea.trim() });
                    setNovaArea('');
                  }
                }}
                placeholder="+ nova área"
                className="w-32 rounded-full border border-dashed border-border bg-transparent px-3.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>

            {editor.area && !areasConhecidas.includes(editor.area) && (
              <p className="mt-2 text-xs text-text-muted">
                Nova área: <span className="text-accent-light">{editor.area}</span>
              </p>
            )}
          </div>

          {editor.id && (
            <button
              onClick={() => {
                const r = reviews.find(x => x.id === editor.id);
                if (r) setExcluir(r);
              }}
              className="flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-danger"
            >
              <Trash2 size={13} /> Excluir esta entrada
            </button>
          )}
        </div>
        </div>

        <ConfirmDialog
          isOpen={!!excluir}
          onClose={() => setExcluir(null)}
          onConfirm={() => {
            if (excluir) { deleteReview(excluir.id); setExcluir(null); setEditor(null); recarregar(); }
          }}
          title="Excluir entrada"
          message="Esta entrada será removida permanentemente."
          confirmLabel="Excluir"
          danger
        />
      </div>
    );
  }

  // ── Lista ──
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary">Reviews</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {reviews.length === 0
              ? 'Nenhuma entrada ainda'
              : `${reviews.length} ${reviews.length === 1 ? 'entrada' : 'entradas'}`}
          </p>
        </div>
        <button onClick={abrirNova} className="btn-grad flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white">
          <Plus size={16} />
          Nova review
        </button>
      </div>

      {/* Filtro por área */}
      {areasConhecidas.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <ChipArea ativo={filtro === 'todas'} onClick={() => setFiltro('todas')} rotulo="Todas" qtd={reviews.length} />
          {areasConhecidas.map(a => (
            <ChipArea
              key={a}
              ativo={filtro === a}
              onClick={() => setFiltro(a)}
              rotulo={a}
              qtd={reviews.filter(r => areaDe(r) === a).length}
            />
          ))}
        </div>
      )}

      {reviews.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={26} />}
          message="Seu diário começa aqui"
          subtitle="Escreva livremente e escolha a área da entrada para filtrar depois."
          actionLabel="Escrever primeira entrada"
          onAction={abrirNova}
        />
      ) : visiveis.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-muted">
          Nenhuma entrada em "{filtro}".
        </p>
      ) : (
        <div className="space-y-2">
          {visiveis.map(r => {
            const texto = r.content || [r.wins, r.struggles, r.insights].filter(Boolean).join(' · ');
            const cor = r.color || COR_PADRAO;
            return (
              <button
                key={r.id}
                onClick={() => abrir(r)}
                className="block w-full overflow-hidden rounded-2xl border bg-bg-card p-4 text-left transition-[border-color,background-color] duration-200 hover:bg-bg-card-hover"
                style={{
                  borderColor: r.color
                    ? `color-mix(in oklab, ${cor} 42%, transparent)`
                    : 'var(--color-border)',
                  backgroundImage: `linear-gradient(150deg, color-mix(in oklab, ${cor} ${r.color ? 14 : 6}%, transparent), transparent 55%)`,
                  boxShadow: r.color
                    ? `0 8px 28px rgba(0,0,0,0.42), inset 0 1px 0 color-mix(in oklab, ${cor} 22%, transparent)`
                    : '0 8px 28px rgba(0,0,0,0.42)',
                }}
              >
                <div className="flex items-baseline gap-3">
                  <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary">
                    {tituloDe(r)}
                  </h3>
                  <span className="flex-shrink-0 text-xs text-text-muted">
                    {formatarData(r.date, 'd MMM yyyy')}
                  </span>
                </div>

                {texto && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-text-secondary">
                    {texto}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star
                        key={n}
                        size={11}
                        style={{ color: r.overallFeeling >= n ? 'var(--color-warning)' : 'var(--color-border)' }}
                        fill={r.overallFeeling >= n ? 'var(--color-warning)' : 'none'}
                      />
                    ))}
                  </span>
                  {areaDe(r) && (
                    <span
                      className="rounded-full border px-2.5 py-0.5 text-[11px]"
                      style={{
                        color: cor,
                        borderColor: `color-mix(in oklab, ${cor} 45%, transparent)`,
                        backgroundColor: `color-mix(in oklab, ${cor} 10%, transparent)`,
                      }}
                    >
                      {areaDe(r)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChipArea({
  ativo, onClick, rotulo, qtd,
}: { ativo: boolean; onClick: () => void; rotulo: string; qtd: number }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-[background-color,border-color] duration-200"
      style={{
        backgroundColor: ativo ? 'var(--color-accent-bg)' : 'var(--color-bg-card)',
        borderColor: ativo ? 'var(--color-accent)' : 'var(--color-border)',
        color: ativo ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
      }}
    >
      {rotulo}
      <span className="text-xs text-text-muted">{qtd}</span>
    </button>
  );
}
