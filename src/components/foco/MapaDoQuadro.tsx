import { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, CornerDownRight } from 'lucide-react';
import type { NoDeQuadro } from '../../types';
import {
  getNosDeQuadro, addNoDeQuadro, updateNoDeQuadro, deleteNosDeQuadro,
} from '../../store';
import { dispor, subarvore, proximaOrdem, tamanhoDoMapa } from '../../lib/quadros';

const LARGURA_NO = 176;
const ALTURA_NO = 38;

/**
 * O mapa mental de um quadro.
 *
 * Posicionamento AUTOMÁTICO: não se arrasta nada. A conta de onde cada nó
 * fica está em `lib/quadros.ts`, testada no node — árvore torta e nó
 * sobreposto são erros que a tela esconde, porque quem olha vê "um mapa" e
 * não percebe que dois nós caíram no mesmo lugar.
 *
 * Só desktop para editar. No celular os controles não aparecem: editar mapa
 * com o dedo pede gesto, detecção de acerto por toque e barra própria — e a
 * decisão foi que consultar basta.
 */
export default function MapaDoQuadro({ quadroId, cor }: { quadroId: string; cor: string }) {
  const [nos, setNos] = useState<NoDeQuadro[]>(() => getNosDeQuadro(quadroId));
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');

  const recarregar = useCallback(() => setNos(getNosDeQuadro(quadroId)), [quadroId]);

  const posicoes = useMemo(() => dispor(nos), [nos]);
  const porId = useMemo(() => new Map(posicoes.map(p => [p.id, p])), [posicoes]);
  const { largura, altura } = tamanhoDoMapa(posicoes);

  function criar(paiId?: string) {
    const novo = addNoDeQuadro(quadroId, '', paiId, proximaOrdem(nos, paiId));
    setNos(getNosDeQuadro(quadroId));
    setEditando(novo.id);
    setRascunho('');
  }

  function salvar(id: string) {
    const t = rascunho.trim();
    if (t) {
      updateNoDeQuadro(id, t);
    } else {
      // Nó vazio não vira nada: criar e desistir não deve deixar caixa em
      // branco no mapa. Some com o galho, que aqui é só ele mesmo.
      deleteNosDeQuadro(subarvore(nos, id));
    }
    setEditando(null);
    recarregar();
  }

  function apagar(id: string) {
    deleteNosDeQuadro(subarvore(nos, id));
    recarregar();
  }

  if (nos.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-xs leading-relaxed text-text-muted">
          Quadro em branco. Comece por uma ideia — o que esta frente precisa
          resolver — e vá abrindo ramos a partir dela.
        </p>
        <button
          onClick={() => criar(undefined)}
          className="font-arcade rounded-[3px] border-solid px-4 py-2.5 text-[0.5rem] uppercase leading-none transition-colors"
          style={{
            borderWidth: 2,
            borderColor: `color-mix(in oklab, ${cor} 45%, transparent)`,
            backgroundColor: `color-mix(in oklab, ${cor} 14%, transparent)`,
            color: cor,
          }}
        >
          + Primeira ideia
        </button>
      </div>
    );
  }

  return (
    <div className="rolagem-lateral">
      <div className="relative" style={{ width: largura, height: altura, minWidth: '100%' }}>

        {/* As ligações, atrás dos nós.
            Cotovelo em L e não linha reta: com o pai centrado no galho, a
            reta cruzaria os nós irmãos pelo meio. O L sai do pai, desce na
            metade do vão e entra no filho pela lateral. */}
        <svg className="pointer-events-none absolute inset-0" width={largura} height={altura} aria-hidden>
          {nos.map(n => {
            if (!n.paiId) return null;
            const pai = porId.get(n.paiId);
            const eu = porId.get(n.id);
            if (!pai || !eu) return null;

            const x1 = pai.x + LARGURA_NO;
            const y1 = pai.y + ALTURA_NO / 2;
            const x2 = eu.x;
            const y2 = eu.y + ALTURA_NO / 2;
            const meio = x1 + (x2 - x1) / 2;

            return (
              <path
                key={n.id}
                d={`M ${x1} ${y1} H ${meio} V ${y2} H ${x2}`}
                fill="none"
                stroke={`color-mix(in oklab, ${cor} 40%, transparent)`}
                strokeWidth={1.5}
              />
            );
          })}
        </svg>

        {nos.map(n => {
          const p = porId.get(n.id);
          if (!p) return null;
          const raiz = !n.paiId;

          return (
            <div
              key={n.id}
              className="group absolute"
              style={{ left: p.x, top: p.y, width: LARGURA_NO }}
            >
              {editando === n.id ? (
                <input
                  autoFocus
                  value={rascunho}
                  onChange={e => setRascunho(e.target.value)}
                  onBlur={() => salvar(n.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); salvar(n.id); }
                    if (e.key === 'Escape') { setRascunho(n.texto); salvar(n.id); }
                  }}
                  placeholder="o que é?"
                  className="font-terminal w-full rounded-[3px] border-solid bg-bg-input px-2.5 text-[16px] leading-none text-text-primary focus:outline-none"
                  style={{ height: ALTURA_NO, borderWidth: 2, borderColor: cor }}
                />
              ) : (
                <button
                  onClick={() => { setEditando(n.id); setRascunho(n.texto); }}
                  className="flex w-full items-center rounded-[3px] border-solid px-2.5 text-left transition-colors"
                  style={{
                    height: ALTURA_NO,
                    borderWidth: 2,
                    // A raiz é sólida na cor; os ramos, mais discretos. É o
                    // que dá hierarquia sem precisar de tamanho diferente.
                    borderColor: raiz ? cor : `color-mix(in oklab, ${cor} 35%, var(--color-border))`,
                    backgroundColor: raiz
                      ? `color-mix(in oklab, ${cor} 14%, transparent)`
                      : 'var(--color-bg-card)',
                  }}
                >
                  <span className="font-terminal truncate text-[16px] leading-none text-text-primary">
                    {n.texto || '—'}
                  </span>
                </button>
              )}

              {/* Controles só no desktop: `md:` some no celular, onde a
                  decisão foi consultar em vez de editar. */}
              <div className="absolute left-full top-0 ml-1 hidden items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 md:flex">
                <button
                  onClick={() => criar(n.id)}
                  title="Novo ramo a partir daqui"
                  className="rounded p-1 text-text-muted transition-colors hover:text-accent-light"
                >
                  <CornerDownRight size={12} />
                </button>
                <button
                  onClick={() => criar(n.paiId)}
                  title="Novo irmão"
                  className="rounded p-1 text-text-muted transition-colors hover:text-accent-light"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => apagar(n.id)}
                  title="Remover este nó e o que pende dele"
                  className="rounded p-1 text-text-muted transition-colors hover:text-danger"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 hidden md:block">
        <button
          onClick={() => criar(undefined)}
          className="font-arcade text-[0.5rem] uppercase leading-none text-text-muted transition-colors hover:text-text-primary"
        >
          + Nova raiz
        </button>
      </div>
    </div>
  );
}
