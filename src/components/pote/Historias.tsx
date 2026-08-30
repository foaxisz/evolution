import { useState, useRef, useCallback } from 'react';
import { Trash2, Pencil, Check, X } from 'lucide-react';
import type { Historia } from '../../types';
import { getHistorias, addHistoria, updateHistoria, deleteHistoria } from '../../store';
import { sequencia, agruparPorDia, temNoDia } from '../../lib/historias';
import { hojeISO, formatarData } from '../../lib/data';

/**
 * A prática de colecionar momentos — "Homework for Life", do Matthew Dicks.
 *
 * Toda noite, uma ou duas frases sobre o momento mais "história" do dia, por
 * mais banal que ele seja. É snippet, não diário: o texto curto é o que
 * sustenta a prática todo dia.
 *
 * ── Por que não é o Pote de Biscoitos, apesar da forma parecida ──
 *
 * O biscoito é CURADO e guarda o que dá força na dúvida. A história é DIÁRIA
 * e guarda tudo, inclusive o banal. "Andei com a cachorra na chuva de cueca
 * às 2 da manhã" é uma entrada perfeita aqui e não é um biscoito — não dá
 * força nenhuma. Fundidas, o pote encheria de banalidade e pararia de servir
 * ao que serve.
 *
 * ── A fita ──
 *
 * Cada dia é um quadro numa fita de filme, com as perfurações desenhadas nas
 * laterais. A metáfora é o que a prática é: momentos capturados.
 */
export default function Historias() {
  const [historias, setHistorias] = useState<Historia[]>(() => getHistorias());
  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const [excluir, setExcluir] = useState<string | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  const hoje = hojeISO();
  const recarregar = useCallback(() => setHistorias(getHistorias()), []);

  const dias = sequencia(historias, hoje);
  const jaEscreveuHoje = temNoDia(historias, hoje);
  const grupos = agruparPorDia(historias);

  function guardar() {
    const t = texto.trim();
    if (!t) return;
    addHistoria(hoje, t);
    setTexto('');
    recarregar();
    campo.current?.focus();
  }

  function salvarEdicao() {
    if (!editando) return;
    const t = editando.texto.trim();
    if (t) updateHistoria(editando.id, t);
    setEditando(null);
    recarregar();
  }

  return (
    /* `tom-padrao`: as Histórias vivem dentro da aba do Pote, que é âmbar
       por causa do `tube-amber`. Sem isto elas herdariam o dourado — e o
       pedido foi desenho PRÓPRIO, nada herdado do pote. A classe devolve o
       roxo do app a esta subárvore. */
    <div className="tom-padrao space-y-5">

      {/* ── Sequência ── */}
      <div className="flex items-baseline gap-2.5">
        <span className="font-arcade text-[1.05rem] leading-none text-accent-light">{dias}</span>
        <span className="font-arcade text-[0.5rem] uppercase leading-none tracking-[0.06em] text-text-muted">
          {dias === 1 ? 'dia seguido' : 'dias seguidos'}
        </span>
      </div>

      {/* ── O campo de hoje ── */}
      <div
        className="rounded-md border-solid p-3.5"
        style={{ borderWidth: 1, borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-bg-input)' }}
      >
        <textarea
          ref={campo}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); guardar(); } }}
          placeholder={jaEscreveuHoje
            ? 'aconteceu mais alguma coisa hoje?'
            : 'qual foi o momento de hoje?'}
          rows={2}
          className="font-terminal w-full resize-none bg-transparent text-[19px] leading-[1.3] text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[11px] text-text-muted">
            {texto.trim() ? 'Ctrl+Enter para guardar' : 'uma ou duas frases bastam'}
          </span>
          <button
            onClick={guardar}
            disabled={!texto.trim()}
            className="font-arcade flex-shrink-0 rounded-[3px] px-3 py-2 text-[0.5rem] uppercase leading-none transition-opacity disabled:opacity-30"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg-primary)' }}
          >
            Guardar
          </button>
        </div>
      </div>

      {/* ── A fita ── */}
      {grupos.length === 0 ? (
        <p className="py-6 text-center text-xs leading-relaxed text-text-muted">
          Nada guardado ainda. Toda noite, pergunte-se qual foi o momento mais
          marcante do dia — por mais banal que pareça — e escreva uma frase.
          <br />
          Em algumas semanas você vai começar a enxergar momentos onde antes
          só havia rotina.
        </p>
      ) : (
        /* As perfurações da fita: pontilhado nas duas laterais. */
        <div
          className="px-3"
          style={{
            borderLeft: '2px dotted var(--color-border-light)',
            borderRight: '2px dotted var(--color-border-light)',
          }}
        >
          {grupos.map(g => (
            <div key={g.dia} className="mb-2 last:mb-0">
              {g.itens.map((h, i) => (
                <div
                  key={h.id}
                  className="group mb-1.5 rounded-[3px] border-solid px-3.5 py-3 last:mb-0"
                  style={{ borderWidth: 1, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-card)' }}
                >
                  {/* A data aparece uma vez por dia, no primeiro quadro —
                      repeti-la em cada entrada do mesmo dia seria ruído. */}
                  {i === 0 && (
                    <p className="font-arcade mb-2 text-[0.45rem] uppercase leading-none text-accent">
                      {formatarData(g.dia, "d 'de' MMMM", g.dia)}
                    </p>
                  )}

                  {editando?.id === h.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editando.texto}
                        onChange={e => setEditando({ ...editando, texto: e.target.value })}
                        rows={2}
                        autoFocus
                        className="font-terminal w-full resize-none bg-transparent text-[19px] leading-[1.25] text-text-primary focus:outline-none"
                      />
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditando(null)} title="Cancelar" className="rounded p-1.5 text-text-muted hover:text-text-primary">
                          <X size={13} />
                        </button>
                        <button onClick={salvarEdicao} title="Salvar" className="rounded p-1.5 text-accent-light hover:text-accent">
                          <Check size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <p className="font-terminal min-w-0 flex-1 whitespace-pre-wrap text-[19px] leading-[1.25] text-text-primary">
                        {h.texto}
                      </p>
                      {/* Sempre visíveis no celular, onde não existe hover. */}
                      <div className="flex flex-shrink-0 gap-0.5 opacity-40 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => setEditando({ id: h.id, texto: h.texto })}
                          title="Editar"
                          className="rounded p-1 text-text-muted transition-colors hover:text-accent-light"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => setExcluir(excluir === h.id ? null : h.id)}
                          title="Remover"
                          className="rounded p-1 text-text-muted transition-colors hover:text-danger"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Confirmação no próprio quadro: uma janela para apagar uma
                      frase é desproporcional, mas apagar sem perguntar também. */}
                  {excluir === h.id && (
                    <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-border pt-2.5">
                      <span className="text-[11px] text-text-muted">Remover esta história?</span>
                      <div className="flex gap-2">
                        <button onClick={() => setExcluir(null)} className="text-[11px] text-text-muted hover:text-text-primary">
                          Cancelar
                        </button>
                        <button
                          onClick={() => { deleteHistoria(h.id); setExcluir(null); recarregar(); }}
                          className="text-[11px] text-danger hover:brightness-125"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
