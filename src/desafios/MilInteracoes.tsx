import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ArrowLeft, Trash2, Upload, X, Pencil } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays, subDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getInteracoes, addInteracao, updateInteracao, deleteInteracao, importarInteracoes,
} from '../store';
import type { Interacao } from '../types';
import { paraData, formatarData } from '../lib/data';
import ProgressRing from '../components/ui/ProgressRing';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import type { DefinicaoDesafio } from './index';

const ROTULOS = ['', 'TRAVEI', 'RUIM', 'OK', 'BOA', 'EXCELENTE'];
const CORES = ['', '#ff4d8d', '#ff6b35', '#ffb000', '#3ddc97', '#00e5ff'];

/** Zero-padding no estilo placar de máquina. */
function placar(n: number, largura: number) {
  return String(n).padStart(largura, '0');
}

interface Props {
  desafio: DefinicaoDesafio;
  onVoltar: () => void;
}

export default function MilInteracoes({ desafio, onVoltar }: Props) {
  const [interacoes, setInteracoes] = useState<Interacao[]>(() => getInteracoes(desafio.id));
  const [aberto, setAberto] = useState(false);
  const [rating, setRating] = useState(0);
  const [nota, setNota] = useState('');
  /** id da interação em edição; null = registrando uma nova */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<Interacao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pulso, setPulso] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const recarregar = useCallback(() => setInteracoes(getInteracoes(desafio.id)), [desafio.id]);

  // O anel é o elemento maior da página — em telas estreitas ele era
  // recortado pelo overflow-hidden do fundo.
  const [tamanhoAnel, setTamanhoAnel] = useState(340);
  useEffect(() => {
    const ajustar = () => setTamanhoAnel(window.innerWidth < 420 ? 260 : window.innerWidth < 768 ? 300 : 340);
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, []);

  const total = interacoes.length;
  const pct = Math.min(100, (total / desafio.meta) * 100);
  const digitos = String(desafio.meta).length;

  const stats = useMemo(() => {
    const comNota = interacoes.filter(i => i.rating > 0);
    const media = (l: Interacao[]) => l.length ? l.reduce((s, i) => s + i.rating, 0) / l.length : 0;
    const ordenadas = [...comNota].sort((a, b) => a.date.localeCompare(b.date));

    const dias = new Set(interacoes.map(i => i.date.slice(0, 10)));
    let seq = 0;
    let cursor = new Date();
    if (!dias.has(format(cursor, 'yyyy-MM-dd'))) cursor = subDays(cursor, 1);
    while (dias.has(format(cursor, 'yyyy-MM-dd'))) { seq++; cursor = subDays(cursor, 1); }

    const primeira = ordenadas[0] ?? interacoes[interacoes.length - 1];
    const inicio = paraData(primeira?.date);
    const diasCorridos = inicio
      ? Math.max(1, differenceInCalendarDays(new Date(), inicio) + 1)
      : 1;
    const porDia = total / diasCorridos;

    return {
      media: media(comNota),
      deltaMedia: ordenadas.length >= 20
        ? media(ordenadas.slice(-50)) - media(ordenadas.slice(-100, -50))
        : null,
      distribuicao: [1, 2, 3, 4, 5].map(n => ({ n, qtd: comNota.filter(i => i.rating === n).length })),
      seq,
      hoje: interacoes.filter(i => { const d = paraData(i.date); return d ? isSameDay(d, new Date()) : false; }).length,
      porDia,
      diasCorridos,
      previsao: porDia > 0 ? Math.ceil((desafio.meta - total) / porDia) : null,
    };
  }, [interacoes, total, desafio.meta]);

  const maxDist = Math.max(...stats.distribuicao.map(d => d.qtd), 1);

  const porDia = useMemo(() => {
    const m = new Map<string, Interacao[]>();
    interacoes.forEach(i => {
      const d = i.date.slice(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(i);
    });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [interacoes]);

  // O log cresce sem limite. A página mostra só os recentes; o histórico
  // completo abre num popup em vez de esticar a página sem fim.
  const LIMITE = 12;
  const [verTudo, setVerTudo] = useState(false);
  const recentesPorDia = useMemo(() => {
    const m = new Map<string, Interacao[]>();
    interacoes.slice(0, LIMITE).forEach(i => {
      const d = i.date.slice(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(i);
    });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [interacoes]);

  function abrirNovo() {
    setEditandoId(null);
    setRating(0);
    setNota('');
    setAberto(true);
  }

  function abrirEdicao(i: Interacao) {
    setEditandoId(i.id);
    setRating(i.rating);
    setNota(i.nota);
    setAberto(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function fechar() {
    setAberto(false);
    setEditandoId(null);
  }

  function registrar() {
    if (editandoId) {
      updateInteracao(editandoId, { rating, nota: nota.trim() });
    } else {
      addInteracao({ desafioId: desafio.id, rating, nota: nota.trim(), date: new Date().toISOString() });
      setPulso(true);
      window.setTimeout(() => setPulso(false), 700);
    }
    setNota(''); setRating(0); setAberto(false); setEditandoId(null);
    recarregar();
  }

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    if (!arq) return;
    try {
      const { importadas, ignoradas } = importarInteracoes(JSON.parse(await arq.text()), desafio.id);
      setAviso(`${importadas} IMPORTADAS` + (ignoradas ? ` · ${ignoradas} JA EXISTIAM` : ''));
      recarregar();
    } catch (err) {
      setAviso(err instanceof Error ? err.message : 'ARQUIVO INVALIDO');
    } finally {
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  }

  const c = desafio.cor;

  return (
    <div className="relative min-h-dvh w-full">
      {/* Atmosfera numa camada fixa e isolada: se fosse absolute ela cresceria
          com o conteúdo e o navegador repintaria tudo a cada scroll. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(ellipse 60% 45% at 50% 0%, color-mix(in oklab, ${c} 16%, transparent), transparent 62%)`,
        }}
      />
      <div
        aria-hidden
        className="crt-scanlines pointer-events-none fixed inset-0 z-0 opacity-40"

      />

      <div className="relative z-10 w-full px-6 pb-24 pt-4 md:px-10 lg:px-14">
        {/* ── Barra de sistema ── */}
        <div className="mb-10 flex items-center gap-4 border-b border-border pb-3">
          <button
            onClick={onVoltar}
            className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
          >
            <ArrowLeft size={14} />
            Desafios
          </button>

          <span className="hidden flex-1 items-center gap-2 sm:flex">
            <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${c}55, transparent)` }} />
            <span className="text-[10px] uppercase tracking-[0.3em] text-text-muted">
              {desafio.titulo}
            </span>
            <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${c}55, transparent)` }} />
          </span>

          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest" style={{ color: c }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
            ativo
          </span>

          <button
            onClick={() => arquivoRef.current?.click()}
            className="text-text-muted transition-colors hover:text-text-primary"
            title="Importar JSON"
          >
            <Upload size={14} />
          </button>
          <input ref={arquivoRef} type="file" accept=".json,application/json" onChange={importar} className="hidden" />
        </div>

        {aviso && (
          <div className="mx-auto mb-8 flex max-w-md items-center gap-3 border px-4 py-2.5 text-xs uppercase tracking-wider"
               style={{ borderColor: `${c}55` }}>
            <span className="flex-1" style={{ color: c }}>{aviso}</span>
            <button onClick={() => setAviso(null)} className="text-text-muted hover:text-text-primary">
              <X size={13} />
            </button>
          </div>
        )}

        {/* ── Núcleo: anel centralizado ── */}
        <div className="relative flex flex-col items-center">
          {/* cantos de moldura */}
          <div className="pointer-events-none absolute left-0 top-0 h-6 w-6 border-l border-t" style={{ borderColor: `${c}66` }} />
          <div className="pointer-events-none absolute right-0 top-0 h-6 w-6 border-r border-t" style={{ borderColor: `${c}66` }} />

          <p className="mb-8 text-[10px] uppercase tracking-[0.4em] text-text-muted">
            {desafio.subtitulo}
          </p>

          <div className={pulso ? 'animate-scale-in' : undefined}>
            <ProgressRing
              value={pct}
              size={tamanhoAnel}
              strokeWidth={24}
              ticks={64}
              color={c}
              centro={
                <>
                  <span
                    className="font-arcade text-[2.6rem] leading-none glow"
                    style={{ color: c }}
                  >
                    {placar(total, digitos)}
                  </span>
                  <span className="mt-4 font-arcade text-[0.7rem] leading-none text-text-muted">
                    / {desafio.meta.toLocaleString('pt-BR')}
                  </span>
                  <span className="mt-4 text-[10px] uppercase tracking-[0.25em] text-text-muted">
                    {pct < 0.1 && total > 0 ? '<0.1' : pct.toFixed(1)}%
                  </span>
                </>
              }
            />
          </div>

          {/* Ação — botão vira painel no lugar, com transição de altura */}
          <div className="mt-10 w-full max-w-md">
            <div className={aberto ? 'item-saindo' : 'item-entrando'}>
              <div>
                <button
                  onClick={abrirNovo}
                  className="group relative w-full overflow-hidden border py-4 text-xs uppercase tracking-[0.3em] transition-colors"
                  style={{ borderColor: c, color: c, backgroundColor: `color-mix(in oklab, ${c} 10%, transparent)` }}
                >
                  <span className="relative z-10">+ Registrar interação</span>
                  <span
                    className="absolute inset-0 -translate-x-full transition-transform duration-500 group-hover:translate-x-0"
                    style={{ background: `color-mix(in oklab, ${c} 18%, transparent)` }}
                  />
                </button>
              </div>
            </div>

            <div className={aberto ? 'item-entrando' : 'item-saindo'}>
              <div>
                <div className="border p-5 text-left" style={{ borderColor: `${c}66`, backgroundColor: 'var(--color-bg-card)' }}>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-text-muted">
                      <span style={{ color: c }}>[</span> {editandoId ? "editar" : "como foi"} <span style={{ color: c }}>]</span>
                    </span>
                    <button onClick={fechar} className="text-text-muted transition-colors hover:text-text-primary">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="mb-3 grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setRating(rating === n ? 0 : n)}
                        className="flex flex-col items-center gap-1.5 border py-2.5 transition-[background-color,border-color] duration-200"
                        style={{
                          backgroundColor: rating === n ? `color-mix(in oklab, ${CORES[n]} 18%, transparent)` : 'transparent',
                          borderColor: rating === n ? CORES[n] : 'var(--color-border)',
                        }}
                      >
                        <span className="font-arcade text-[0.7rem]" style={{ color: rating === n ? CORES[n] : 'var(--color-text-muted)' }}>
                          {n}
                        </span>
                        <span className="text-[8px] uppercase tracking-wider" style={{ color: rating === n ? CORES[n] : 'var(--color-text-muted)' }}>
                          {ROTULOS[n]}
                        </span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                    rows={3}
                    className="w-full resize-none border bg-bg-input px-3 py-2.5 text-sm text-text-primary focus:outline-none"
                    style={{ borderColor: 'var(--color-border)' }}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) registrar(); }}
                  />

                  <button
                    onClick={registrar}
                    className="mt-3 w-full border py-3 text-xs uppercase tracking-[0.25em] transition-colors"
                    style={{ borderColor: c, color: 'var(--color-bg-primary)', backgroundColor: c }}
                  >
                    {editandoId ? "salvar" : `confirmar · ${placar(total + 1, digitos)}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Leitura de dados ── */}
        {total > 0 && (
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="grid grid-cols-2 border-y border-border md:grid-cols-4">
              <Bloco rotulo="hoje" valor={placar(stats.hoje, 2)} cor={c} />
              <Bloco rotulo={stats.seq === 1 ? 'dia seguido' : 'dias seguidos'} valor={placar(stats.seq, 2)} cor={c} />
              <Bloco rotulo="média" valor={stats.media ? stats.media.toFixed(1) : '—'} cor={c} delta={stats.deltaMedia} />
              <Bloco rotulo="por dia" valor={stats.porDia.toFixed(1)} cor={c} ultimo />
            </div>

            <div className="mt-14 grid gap-14 lg:grid-cols-2">
              {/* Distribuição */}
              <div>
                <h2 className="mb-6 text-[10px] uppercase tracking-[0.3em] text-text-muted">
                  <span style={{ color: c }}>[</span> distribuição <span style={{ color: c }}>]</span>
                </h2>
                <div className="space-y-2">
                  {stats.distribuicao.slice().reverse().map(d => (
                    <div key={d.n} className="flex items-center gap-3">
                      <span className="w-20 flex-shrink-0 text-[10px] uppercase tracking-wider" style={{ color: CORES[d.n] }}>
                        {ROTULOS[d.n]}
                      </span>
                      {/* barra em blocos discretos, estilo medidor */}
                      <div className="flex flex-1 gap-[3px]">
                        {Array.from({ length: 24 }, (_, i) => {
                          const aceso = i < Math.round((d.qtd / maxDist) * 24);
                          return (
                            <span
                              key={i}
                              className="h-4 flex-1 transition-colors duration-500"
                              style={{
                                backgroundColor: aceso ? CORES[d.n] : 'var(--color-bg-input)',
                                boxShadow: aceso ? `0 0 6px color-mix(in oklab, ${CORES[d.n]} 55%, transparent)` : undefined,
                              }}
                            />
                          );
                        })}
                      </div>
                      <span className="w-8 text-right font-arcade text-[0.6rem] text-text-muted">{d.qtd}</span>
                    </div>
                  ))}
                </div>

                {stats.previsao && (
                  <p className="mt-6 border-t border-border pt-4 text-[11px] uppercase tracking-wider text-text-muted">
                    projeção · {stats.previsao.toLocaleString('pt-BR')} dias no ritmo atual
                  </p>
                )}
              </div>

              {/* Log */}
              <div>
                <div className="mb-6 flex items-baseline justify-between">
                  <h2 className="text-[10px] uppercase tracking-[0.3em] text-text-muted">
                    <span style={{ color: c }}>[</span> log <span style={{ color: c }}>]</span>
                  </h2>
                  <span className="font-arcade text-[0.55rem] text-text-muted">
                    {verTudo ? placar(total, 3) : `${placar(Math.min(LIMITE, total), 3)}/${placar(total, 3)}`}
                  </span>
                </div>
                <div className="space-y-6">
                  {recentesPorDia.map(([dia, lista]) => (
                    <div key={dia}>
                      <div className="mb-2.5 flex items-baseline gap-3">
                        <span className="text-[10px] uppercase tracking-widest" style={{ color: c }}>
                          {formatarData(dia, 'dd.MM.yyyy')}
                        </span>
                        <span className="h-px flex-1 bg-border" />
                        <span className="font-arcade text-[0.55rem] text-text-muted">{placar(lista.length, 2)}</span>
                      </div>
                      <div className="space-y-2">
                        {lista.map(i => (
                          <div key={i.id} className="group flex items-start gap-2.5 text-sm">
                            <span className="mt-0.5 select-none font-mono text-xs" style={{ color: `${c}99` }}>&gt;</span>
                            <span className="mt-0.5 flex-shrink-0 font-mono text-[11px] text-text-muted">
                              {formatarData(i.date, 'HH:mm')}
                            </span>
                            <span
                              className="mt-0.5 flex-shrink-0 border px-1 font-arcade text-[0.5rem]"
                              style={{
                                color: CORES[i.rating] || 'var(--color-text-muted)',
                                borderColor: CORES[i.rating] ? `${CORES[i.rating]}66` : 'var(--color-border)',
                              }}
                            >
                              {i.rating || '-'}
                            </span>
                            <span className="min-w-0 flex-1 leading-relaxed text-text-primary">
                              {i.nota || <span className="text-text-muted">—</span>}
                            </span>
                            {/* sempre visíveis: escondidos no hover ninguém achava */}
                            <span className="flex flex-shrink-0 gap-2 opacity-45 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => abrirEdicao(i)}
                                title="Editar"
                                className="text-text-muted transition-colors hover:text-accent-light"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => setExcluir(i)}
                                title="Remover"
                                className="text-text-muted transition-colors hover:text-danger"
                              >
                                <Trash2 size={12} />
                              </button>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {total > LIMITE && (
                  <button
                    onClick={() => setVerTudo(true)}
                    className="mt-5 w-full border py-2.5 text-[10px] uppercase tracking-[0.25em] transition-colors"
                    style={{ borderColor: `${c}44`, color: c }}
                  >
                    ver histórico completo · {placar(total, 3)}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {total === 0 && (
          <p className="mt-16 text-center text-xs uppercase tracking-[0.3em] text-text-muted">
            aguardando primeiro registro
          </p>
        )}
      </div>

      {/* Histórico completo em popup — a página fica sempre do mesmo tamanho */}
      <Modal
        isOpen={verTudo}
        onClose={() => setVerTudo(false)}
        title={`Histórico · ${total} ${total === 1 ? 'interação' : 'interações'}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          {porDia.map(([dia, lista]) => (
            <div key={dia}>
              <div className="mb-2.5 flex items-baseline gap-3">
                <span className="text-[10px] uppercase tracking-widest" style={{ color: c }}>
                  {formatarData(dia, "dd.MM.yyyy · EEEE")}
                </span>
                <span className="h-px flex-1 bg-border" />
                <span className="font-arcade text-[0.55rem] text-text-muted">{placar(lista.length, 2)}</span>
              </div>
              <div className="space-y-2">
                {lista.map(i => (
                  <div key={i.id} className="group flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 flex-shrink-0 font-mono text-[11px] text-text-muted">
                      {formatarData(i.date, 'HH:mm')}
                    </span>
                    <span
                      className="mt-0.5 flex-shrink-0 border px-1 font-arcade text-[0.5rem]"
                      style={{
                        color: CORES[i.rating] || 'var(--color-text-muted)',
                        borderColor: CORES[i.rating] ? `${CORES[i.rating]}66` : 'var(--color-border)',
                      }}
                    >
                      {i.rating || '-'}
                    </span>
                    <span className="min-w-0 flex-1 leading-relaxed text-text-primary">
                      {i.nota || <span className="text-text-muted">—</span>}
                    </span>
                    <span className="flex flex-shrink-0 gap-2 opacity-45 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => { setVerTudo(false); abrirEdicao(i); }}
                        title="Editar"
                        className="text-text-muted transition-colors hover:text-accent-light"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => setExcluir(i)}
                        title="Remover"
                        className="text-text-muted transition-colors hover:text-danger"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!excluir}
        onClose={() => setExcluir(null)}
        onConfirm={() => { if (excluir) { deleteInteracao(excluir.id); setExcluir(null); recarregar(); } }}
        title="Remover interação"
        message="O contador diminui em 1."
        confirmLabel="Remover"
        danger
      />
    </div>
  );
}

function Bloco({
  rotulo, valor, cor, delta, ultimo,
}: { rotulo: string; valor: string; cor: string; delta?: number | null; ultimo?: boolean }) {
  return (
    <div className={`px-4 py-6 text-center ${ultimo ? '' : 'md:border-r'} border-border`}>
      <p className="font-arcade text-[1.1rem] leading-none" style={{ color: cor }}>
        {valor}
        {delta !== null && delta !== undefined && Math.abs(delta) >= 0.1 && (
          <span
            className="ml-1.5 font-sans text-[0.6rem]"
            style={{ color: delta > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
          >
            {delta > 0 ? '▲' : '▼'}
          </span>
        )}
      </p>
      <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-text-muted">{rotulo}</p>
    </div>
  );
}
