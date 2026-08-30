import { useState, useRef, useCallback, useEffect } from 'react';
import { Trash2, Pencil, Check, X, Download } from 'lucide-react';
import type { Historia } from '../../types';
import { getHistorias, addHistoria, updateHistoria, deleteHistoria } from '../../store';
import {
  sequencia, agruparPorDia, mesesComHistoria, doMes, montarCSVDeHistorias,
} from '../../lib/historias';
import { baixarArquivo } from '../../lib/relatorio';
import { hojeISO, formatarData } from '../../lib/data';

/**
 * Campo de texto que cresce com o conteúdo.
 *
 * Uma caixa de altura fixa erra sempre: alta demais, ocupa a tela para uma
 * frase; baixa demais, esconde o texto de quem escreveu três. Aqui ela começa
 * numa linha e só toma o espaço que o texto pedir.
 */
function CampoElastico({
  valor, aoMudar, aoTeclar, placeholder, refExterna, className, autoFocus,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  aoTeclar?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  refExterna?: React.RefObject<HTMLTextAreaElement | null>;
  className?: string;
  autoFocus?: boolean;
}) {
  const proprio = useRef<HTMLTextAreaElement>(null);
  const campo = refExterna ?? proprio;

  // Zera antes de medir: sem isso a caixa só cresce, porque `scrollHeight`
  // de um elemento já alto devolve a altura dele, não a do conteúdo.
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [valor, campo]);

  return (
    <textarea
      ref={campo}
      value={valor}
      onChange={e => aoMudar(e.target.value)}
      onKeyDown={aoTeclar}
      placeholder={placeholder}
      rows={1}
      autoFocus={autoFocus}
      className={`font-terminal w-full resize-none overflow-hidden bg-transparent text-[19px] leading-[1.3] text-text-primary placeholder:text-text-muted focus:outline-none ${className ?? ''}`}
    />
  );
}

/**
 * A prática de colecionar momentos — "Homework for Life", do Matthew Dicks.
 *
 * Toda noite, uma ou duas frases sobre o momento mais "história" do dia, por
 * mais banal que ele seja.
 *
 * Separada do Pote de Biscoitos de propósito, apesar da forma parecida: o
 * biscoito é curado e guarda o que dá força na dúvida; a história é diária e
 * guarda tudo, inclusive o banal.
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
  const [mes, setMes] = useState<string | null>(null);
  const [baixou, setBaixou] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);

  const hoje = hojeISO();
  const recarregar = useCallback(() => setHistorias(getHistorias()), []);

  // A sequência conta a vida inteira, não o mês filtrado: ela é sobre o
  // hábito, e filtrar a vista não muda quantos dias seguidos você cumpriu.
  const dias = sequencia(historias, hoje);
  const meses = mesesComHistoria(historias);
  const grupos = agruparPorDia(doMes(historias, mes));

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

  function baixar() {
    baixarArquivo(
      montarCSVDeHistorias(doMes(historias, mes)),
      `evolution-historias${mes ? '-' + mes : ''}.csv`,
      'text/csv',
    );
    setBaixou(true);
    window.setTimeout(() => setBaixou(false), 2000);
  }

  return (
    /* `tom-padrao`: as Histórias vivem dentro da aba do Pote, que é âmbar
       por causa do `tube-amber`. Sem isto elas herdariam o dourado — e o
       pedido foi desenho PRÓPRIO, nada herdado do pote. */
    <div className="tom-padrao space-y-5">

      {/* ── Sequência, filtro e download na mesma linha ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <span className="font-arcade text-[1.05rem] leading-none text-accent-light">{dias}</span>
          <span className="font-arcade text-[0.5rem] uppercase leading-none tracking-[0.06em] text-text-muted">
            {dias === 1 ? 'dia seguido' : 'dias seguidos'}
          </span>
        </div>

        {historias.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={mes ?? ''}
              onChange={e => setMes(e.target.value || null)}
              aria-label="Filtrar por mês"
              className="font-arcade rounded-[3px] border-solid bg-bg-input px-2.5 py-2 text-[0.5rem] uppercase leading-none text-text-secondary focus:outline-none"
              style={{ borderWidth: 1, borderColor: 'var(--color-border)' }}
            >
              <option value="">Tudo</option>
              {meses.map(m => (
                <option key={m} value={m}>{formatarData(`${m}-01`, "MMM 'de' yy", m)}</option>
              ))}
            </select>

            <button
              onClick={baixar}
              aria-label="Baixar as histórias (.csv)"
              title="Baixar as histórias (.csv)"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[3px] border-solid transition-colors"
              style={{
                borderWidth: 1,
                borderColor: 'var(--color-border)',
                color: baixou ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}
            >
              {baixou ? <Check size={14} /> : <Download size={14} />}
            </button>
          </div>
        )}
      </div>

      {/* ── O campo de hoje ── */}
      <div
        className="rounded-md border-solid px-3.5 py-3"
        style={{ borderWidth: 1, borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-bg-input)' }}
      >
        <div className="flex items-end gap-3">
          <CampoElastico
            refExterna={campo}
            valor={texto}
            aoMudar={setTexto}
            aoTeclar={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); guardar(); } }}
            placeholder="uma história de 5 minutos de hoje"
          />
          {/* O botão só existe quando há o que guardar: vazio, ele é um
              convite para clicar em nada. */}
          {texto.trim() && (
            <button
              onClick={guardar}
              className="font-arcade flex-shrink-0 rounded-[3px] px-3 py-2 text-[0.5rem] uppercase leading-none"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg-primary)' }}
            >
              Guardar
            </button>
          )}
        </div>
      </div>

      {/* ── A fita ── */}
      {grupos.length === 0 ? (
        <p className="py-6 text-center text-xs leading-relaxed text-text-muted">
          {historias.length === 0
            ? 'Nada guardado ainda. Toda noite, pergunte-se qual foi o momento mais marcante do dia — por mais banal que pareça — e escreva uma frase. Em algumas semanas você vai começar a enxergar momentos onde antes só havia rotina.'
            : 'Nenhuma história neste mês.'}
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
              {g.itens.map(h => (
                <div
                  key={h.id}
                  className="group mb-1.5 rounded-[3px] border-solid px-3.5 py-3 last:mb-0"
                  style={{ borderWidth: 1, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-card)' }}
                >
                  {/* A data em TODO quadro, inclusive no segundo do mesmo
                      dia. Mostrá-la só no primeiro economizava uma linha e
                      deixava a entrada seguinte flutuando sem âncora — cada
                      quadro é um momento e cada momento tem quando. */}
                  <p className="font-arcade mb-2 text-[0.45rem] uppercase leading-none text-accent">
                    {formatarData(g.dia, "d 'de' MMMM", g.dia)}
                  </p>

                  {editando?.id === h.id ? (
                    <div className="flex items-end gap-2">
                      <CampoElastico
                        valor={editando.texto}
                        aoMudar={t => setEditando({ ...editando, texto: t })}
                        aoTeclar={e => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); salvarEdicao(); }
                          if (e.key === 'Escape') setEditando(null);
                        }}
                        autoFocus
                      />
                      <button onClick={() => setEditando(null)} title="Cancelar" className="flex-shrink-0 rounded p-1.5 text-text-muted hover:text-text-primary">
                        <X size={13} />
                      </button>
                      <button onClick={salvarEdicao} title="Salvar" className="flex-shrink-0 rounded p-1.5 text-accent-light hover:text-accent">
                        <Check size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <p className="font-terminal min-w-0 flex-1 whitespace-pre-wrap text-[19px] leading-[1.3] text-text-primary">
                        {h.texto}
                      </p>
                      <div className="flex flex-shrink-0 gap-0.5 opacity-40 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => setEditando({ id: h.id, texto: h.texto })}
                          title="Editar"
                          className="rounded p-1 text-text-muted transition-colors hover:text-accent-light"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          /* Apaga direto, sem perguntar — pedido explícito.
                             Não há como desfazer: uma história removida some
                             de vez. */
                          onClick={() => { deleteHistoria(h.id); recarregar(); }}
                          title="Remover"
                          className="rounded p-1 text-text-muted transition-colors hover:text-danger"
                        >
                          <Trash2 size={12} />
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
