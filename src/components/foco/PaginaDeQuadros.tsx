import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { ArrowLeft, Plus, Trash2, Pencil, Check, X, Network, Shapes } from 'lucide-react';
import type { CategoriaDeFoco, Quadro } from '../../types';
import {
  getQuadros, addQuadro, renomearQuadro, deleteQuadro, getNosDeQuadro, getCenaDeQuadro,
} from '../../store';
import { formatarData } from '../../lib/data';
import MapaDoQuadro from './MapaDoQuadro';

/**
 * O quadro livre carrega sob demanda.
 *
 * O Excalidraw são ~2,7MB de JavaScript. Preso no pacote principal, ele
 * atrasaria a abertura do app para quem nunca desenhou nada. Assim só desce
 * quando alguém abre um quadro livre.
 */
const QuadroLivre = lazy(() => import('./QuadroLivre'));

/**
 * Qual quadro estava aberto, guardado fora do componente.
 *
 * Mesmo motivo do `ultimaFrente` na FocusPage: a sincronização remonta a
 * página quando traz novidade, e sem isto um traço no quadro podia acabar
 * jogando quem desenhava de volta para a lista.
 */
let ultimoQuadro: string | null = null;

/**
 * Os quadros de uma frente de propósito.
 *
 * Lista quando nenhum está aberto; o quadro quando um está. Vários por
 * categoria, porque uma frente tem mais de um assunto a mapear.
 *
 * Dois tipos, e a escolha é na criação porque eles não se convertem: o
 * mapa organiza sozinho e cabe em texto; o livre é tela em branco e mora
 * em coordenadas. Virar um no outro perderia justamente o que faz cada um.
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
  const [aberto, definirAberto] = useState<string | null>(ultimoQuadro);
  const setAberto = useCallback((id: string | null) => {
    ultimoQuadro = id;
    definirAberto(id);
  }, []);
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null);
  const [excluir, setExcluir] = useState<string | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const caixaDeEscolha = useRef<HTMLDivElement>(null);

  const cor = categoria.cor;
  const recarregar = useCallback(
    () => setQuadros(getQuadros().filter(q => q.categoriaId === categoria.id)),
    [categoria.id]
  );

  // Clique fora fecha a escolha do tipo.
  useEffect(() => {
    if (!escolhendo) return;
    function aoClicar(e: MouseEvent) {
      if (!caixaDeEscolha.current?.contains(e.target as Node)) setEscolhendo(false);
    }
    document.addEventListener('mousedown', aoClicar);
    return () => document.removeEventListener('mousedown', aoClicar);
  }, [escolhendo]);

  function criar(tipo: 'mapa' | 'livre') {
    const novo = addQuadro(categoria.id, 'Quadro sem nome', tipo);
    setEscolhendo(false);
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

  const livreAberto = oAberto?.tipo === 'livre' ? oAberto : null;

  // ── Um mapa aberto ──
  //
  // O quadro livre não entra aqui: ele é uma camada por cima da lista, no
  // fim deste arquivo. Emoldurar tela infinita não faz sentido, e deixar a
  // lista montada embaixo faz o fechar ser só desmontar o portal — sem
  // navegar de volta e sem a página piscar.
  if (oAberto && !livreAberto) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 md:p-6 lg:p-8 animate-fade-in">
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

  // ── A lista dos quadros, com o livre por cima quando há um aberto ──
  return (
    <>
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

        <div className="relative flex-shrink-0" ref={caixaDeEscolha}>
          <button
            onClick={() => setEscolhendo(v => !v)}
            aria-label="Novo quadro"
            title="Novo quadro"
            className="flex h-9 w-9 items-center justify-center rounded-[3px] border-solid transition-colors"
            style={{
              borderWidth: 2,
              borderColor: `color-mix(in oklab, ${cor} 55%, transparent)`,
              backgroundColor: `color-mix(in oklab, ${cor} 16%, transparent)`,
              color: cor,
            }}
          >
            <Plus size={16} />
          </button>

          {/* A escolha explica cada tipo: "mapa" e "livre" só dizem alguma
              coisa para quem já viu os dois. */}
          {escolhendo && (
            <div
              className="absolute right-0 top-full z-30 mt-1.5 w-56 rounded-[4px] border-solid bg-bg-card p-1 animate-fade-in"
              style={{ borderWidth: 2, borderColor: 'var(--color-border)' }}
            >
              <button
                onClick={() => criar('mapa')}
                className="flex w-full items-start gap-2.5 rounded-[3px] px-2.5 py-2 text-left transition-colors hover:bg-bg-input"
              >
                <Network size={14} className="mt-0.5 flex-shrink-0" style={{ color: cor }} />
                <span className="min-w-0">
                  <span className="font-arcade block text-[0.5rem] uppercase leading-none text-text-primary">
                    Mapa
                  </span>
                  <span className="mt-1.5 block text-[11px] leading-snug text-text-muted">
                    Ideias em ramos, arrumadas sozinhas
                  </span>
                </span>
              </button>
              <button
                onClick={() => criar('livre')}
                className="flex w-full items-start gap-2.5 rounded-[3px] px-2.5 py-2 text-left transition-colors hover:bg-bg-input"
              >
                <Shapes size={14} className="mt-0.5 flex-shrink-0" style={{ color: cor }} />
                <span className="min-w-0">
                  <span className="font-arcade block text-[0.5rem] uppercase leading-none text-text-primary">
                    Livre
                  </span>
                  <span className="mt-1.5 block text-[11px] leading-snug text-text-muted">
                    Tela infinita: desenhar, formas e setas
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {quadros.length === 0 ? (
        <p className="py-8 text-center text-xs leading-relaxed text-text-muted">
          Nenhum quadro nesta frente. Um quadro é o mapa de um assunto — o que
          precisa ser resolvido e como as partes se ligam.
        </p>
      ) : (
        <div className="space-y-2">
          {quadros.map(q => {
            const livre = q.tipo === 'livre';
            const quantos = livre
              ? getCenaDeQuadro(q.id)?.elementos.length ?? 0
              : getNosDeQuadro(q.id).length;
            const unidade = livre
              ? (quantos === 1 ? 'traço' : 'traços')
              : (quantos === 1 ? 'nó' : 'nós');

            return (
              <div
                key={q.id}
                className="group flex items-center gap-3 rounded-xl border-solid bg-bg-card px-4 py-3"
                style={{ borderWidth: 2, borderColor: 'var(--color-border)' }}
              >
                <span className="flex-shrink-0" style={{ color: `color-mix(in oklab, ${cor} 70%, var(--color-text-muted))` }}>
                  {livre ? <Shapes size={15} /> : <Network size={15} />}
                </span>

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
                      {quantos === 0 ? 'vazio' : `${quantos} ${unidade}`}
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

    {livreAberto && (
      <Suspense fallback={null}>
        <QuadroLivre
          quadroId={livreAberto.id}
          cor={cor}
          nome={livreAberto.nome}
          onFechar={() => setAberto(null)}
          onRenomear={n => { renomearQuadro(livreAberto.id, n); recarregar(); }}
        />
      </Suspense>
    )}
    </>
  );
}
