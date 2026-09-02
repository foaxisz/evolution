import { useState, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import type { CategoriaDeFoco, Quadro } from '../../types';
import { getQuadros, addQuadro, renomearQuadro, deleteQuadro, getNosDeQuadro } from '../../store';
import { formatarData } from '../../lib/data';
import MapaDoQuadro from './MapaDoQuadro';

/**
 * Os quadros de uma frente de propósito.
 *
 * Lista quando nenhum está aberto; o mapa quando um está. Vários por
 * categoria, porque uma frente tem mais de um assunto a mapear.
 */
export default function PaginaDeQuadros({
  categoria, onVoltar,
}: {
  categoria: CategoriaDeFoco;
  onVoltar: () => void;
}) {
  const [quadros, setQuadros] = useState<Quadro[]>(
    () => getQuadros().filter(q => q.categoriaId === categoria.id)
  );
  const [aberto, setAberto] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null);
  const [excluir, setExcluir] = useState<string | null>(null);

  const cor = categoria.cor;
  const recarregar = useCallback(
    () => setQuadros(getQuadros().filter(q => q.categoriaId === categoria.id)),
    [categoria.id]
  );

  function criar() {
    const novo = addQuadro(categoria.id, 'Quadro sem nome');
    recarregar();
    setAberto(novo.id);
    setRenomeando({ id: novo.id, nome: novo.nome });
  }

  function salvarNome() {
    if (!renomeando) return;
    const n = renomeando.nome.trim();
    if (n) renomearQuadro(renomeando.id, n);
    setRenomeando(null);
    recarregar();
  }

  const oAberto = quadros.find(q => q.id === aberto) ?? null;

  // ── Um quadro aberto: o mapa ──
  if (oAberto) {
    return (
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 md:p-6 lg:p-8 animate-fade-in">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAberto(null)}
            aria-label="Voltar para os quadros"
            className="botao-icone text-text-muted transition-colors hover:text-text-primary"
          >
            <ArrowLeft size={16} />
          </button>

          {renomeando?.id === oAberto.id ? (
            <input
              autoFocus
              // Seleciona ao entrar: quadro novo nasce "Quadro sem nome" e o
              // primeiro gesto é sempre trocar esse nome. Sem isto, o cursor
              // cai no fim e escrever concatena em cima do provisório.
              onFocus={e => e.target.select()}
              value={renomeando.nome}
              onChange={e => setRenomeando({ ...renomeando, nome: e.target.value })}
              onBlur={salvarNome}
              onKeyDown={e => { if (e.key === 'Enter') salvarNome(); }}
              className="font-terminal min-w-0 flex-1 rounded-[3px] border-solid bg-bg-input px-2.5 py-1.5 text-[19px] leading-none text-text-primary focus:outline-none"
              style={{ borderWidth: 2, borderColor: cor }}
            />
          ) : (
            <button
              onClick={() => setRenomeando({ id: oAberto.id, nome: oAberto.nome })}
              className="font-terminal min-w-0 flex-1 truncate text-left text-[19px] leading-none text-text-primary"
              title="Renomear"
            >
              {oAberto.nome}
            </button>
          )}
        </div>

        <MapaDoQuadro quadroId={oAberto.id} cor={cor} />
      </div>
    );
  }

  // ── Nenhum aberto: a lista ──
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-5 p-4 md:p-6 lg:p-8 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onVoltar}
            aria-label="Voltar para a frente"
            className="botao-icone text-text-muted transition-colors hover:text-text-primary"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="truncate text-xl font-bold text-text-primary">Quadros</h2>
        </div>

        <button
          onClick={criar}
          aria-label="Novo quadro"
          title="Novo quadro"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[3px] border-solid transition-colors"
          style={{
            borderWidth: 2,
            borderColor: `color-mix(in oklab, ${cor} 55%, transparent)`,
            backgroundColor: `color-mix(in oklab, ${cor} 16%, transparent)`,
            color: cor,
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      {quadros.length === 0 ? (
        <p className="py-8 text-center text-xs leading-relaxed text-text-muted">
          Nenhum quadro nesta frente. Um quadro é o mapa de um assunto — o que
          precisa ser resolvido e como as partes se ligam.
        </p>
      ) : (
        <div className="space-y-2">
          {quadros.map(q => {
            const quantos = getNosDeQuadro(q.id).length;
            return (
              <div
                key={q.id}
                className="group flex items-center gap-3 rounded-xl border-solid bg-bg-card px-4 py-3"
                style={{ borderWidth: 2, borderColor: 'var(--color-border)' }}
              >
                {renomeando?.id === q.id ? (
                  <input
                    autoFocus
                    onFocus={e => e.target.select()}
                    value={renomeando.nome}
                    onChange={e => setRenomeando({ ...renomeando, nome: e.target.value })}
                    onBlur={salvarNome}
                    onKeyDown={e => { if (e.key === 'Enter') salvarNome(); }}
                    className="font-terminal min-w-0 flex-1 bg-transparent text-[17px] leading-none text-text-primary focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setAberto(q.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-terminal truncate text-[17px] leading-tight text-text-primary">
                      {q.nome}
                    </p>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {quantos === 0 ? 'vazio' : `${quantos} ${quantos === 1 ? 'nó' : 'nós'}`}
                      {' · '}
                      {formatarData(q.createdAt.slice(0, 10), "d 'de' MMM", '')}
                    </p>
                  </button>
                )}

                <div className="flex flex-shrink-0 gap-0.5 opacity-40 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setRenomeando({ id: q.id, nome: q.nome })}
                    title="Renomear"
                    className="rounded p-1.5 text-text-muted transition-colors hover:text-accent-light"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setExcluir(excluir === q.id ? null : q.id)}
                    title="Remover"
                    className="rounded p-1.5 text-text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Confirmação aqui, ao contrário das Histórias: apagar um
                    quadro leva o mapa inteiro, não uma frase. */}
                {excluir === q.id && (
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      onClick={() => setExcluir(null)}
                      className="rounded p-1.5 text-text-muted hover:text-text-primary"
                      title="Cancelar"
                    >
                      <X size={13} />
                    </button>
                    <button
                      onClick={() => { deleteQuadro(q.id); setExcluir(null); recarregar(); }}
                      className="rounded p-1.5 text-danger hover:brightness-125"
                      title="Confirmar remoção"
                    >
                      <Check size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
