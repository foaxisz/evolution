import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight, Flag, Trash2 } from 'lucide-react';
import type { Action } from '../../types';
import {
  PRIORIDADES, SEM_PRIORIDADE_COR, hojeISO, somarDias, type Prioridade,
} from '../../lib/tarefas';
import CalendarioDeUmDia from './CalendarioDeUmDia';

/**
 * Duração da entrada e da saída, em ms.
 *
 * Curta o bastante para não atrasar quem já sabe o que vai clicar, longa o
 * bastante para o menu não brotar nem sumir de estalo. Vale para os dois
 * sentidos: menu que entra suave e desaparece instantâneo fica pior que o
 * que nunca animou, porque a saída passa a parecer defeito.
 */
const ANIMACAO_MS = 120;

/**
 * Atraso antes do submenu do calendário abrir no `hover`.
 *
 * Sem ele, o calendário pisca na cara de quem só está passando o mouse a
 * caminho de "Excluir", que fica logo abaixo.
 */
const ATRASO_SUBMENU_MS = 180;

/** Folga da borda da tela, para o menu nunca encostar. */
const FOLGA = 8;

export interface PosicaoDoMenu {
  x: number;
  y: number;
}

/**
 * O menu de contexto de uma tarefa.
 *
 * Botão direito, e só no computador — foi decisão explícita não haver
 * equivalente por toque no celular por ora, então não há `long-press` aqui.
 *
 * Ele mesmo controla a própria saída: os itens chamam `fechar()`, que anima
 * e só então avisa o pai para desmontar. Se o pai desmontasse na hora do
 * clique, não haveria o que animar.
 */
export default function MenuDeTarefa({
  acao, posicao, cor, onVencimento, onPrioridade, onExcluir, onFechar,
}: {
  acao: Action;
  posicao: PosicaoDoMenu;
  cor: string;
  /** `undefined` limpa o vencimento ("Algum dia"). */
  onVencimento: (dia: string | undefined) => void;
  /** `undefined` limpa a prioridade (bandeira cinza). */
  onPrioridade: (p: Prioridade | undefined) => void;
  onExcluir: () => void;
  onFechar: () => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [saindo, setSaindo] = useState(false);
  const [ajuste, setAjuste] = useState<{ x: number; y: number } | null>(null);
  const [submenu, setSubmenu] = useState(false);
  const [submenuAEsquerda, setSubmenuAEsquerda] = useState(false);
  const timerSubmenu = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fechando = useRef(false);

  const hoje = hojeISO();

  /**
   * Vira o menu para dentro da tela.
   *
   * `useLayoutEffect` e não `useEffect`: medir e corrigir depois da pintura
   * faria o menu aparecer na posição errada e saltar para a certa.
   */
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();

    // Vira para o lado de dentro em vez de só empurrar: um menu de contexto
    // que nasce sob o cursor deve crescer para longe da borda, não colar
    // nela com o cursor em cima do meio dele.
    const x = posicao.x + width + FOLGA > window.innerWidth
      ? Math.max(FOLGA, posicao.x - width)
      : posicao.x;
    const y = posicao.y + height + FOLGA > window.innerHeight
      ? Math.max(FOLGA, window.innerHeight - height - FOLGA)
      : posicao.y;

    setAjuste({ x, y });
  }, [posicao.x, posicao.y]);

  function fechar() {
    if (fechando.current) return;
    fechando.current = true;
    setSaindo(true);
    setTimeout(onFechar, ANIMACAO_MS);
  }

  // Esc, clique fora e rolagem fecham. A rolagem entra porque o menu é
  // posicionado em coordenada fixa: rolar a página o deixaria flutuando
  // longe da tarefa que ele edita.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); fechar(); }
    };
    const aoApertar = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) fechar();
    };
    document.addEventListener('keydown', aoTeclar);
    // `true` para pegar na descida: um `mousedown` que abre outro menu não
    // deixaria este saber que precisa sair.
    document.addEventListener('mousedown', aoApertar, true);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('mousedown', aoApertar, true);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (timerSubmenu.current) clearTimeout(timerSubmenu.current);
  }, []);

  function agendarSubmenu(linha: HTMLElement | null) {
    if (timerSubmenu.current) clearTimeout(timerSubmenu.current);
    timerSubmenu.current = setTimeout(() => {
      // Decide o lado com a largura real do calendário (~15rem = 240px).
      if (linha) {
        const r = linha.getBoundingClientRect();
        setSubmenuAEsquerda(r.right + 240 + FOLGA > window.innerWidth);
      }
      setSubmenu(true);
    }, ATRASO_SUBMENU_MS);
  }

  function cancelarSubmenu() {
    if (timerSubmenu.current) clearTimeout(timerSubmenu.current);
    setSubmenu(false);
  }

  function escolherVencimento(dia: string | undefined) {
    onVencimento(dia);
    fechar();
  }

  function escolherPrioridade(p: Prioridade | undefined) {
    onPrioridade(p);
    fechar();
  }

  const item =
    'font-terminal flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[15px] ' +
    'leading-tight text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary';
  const rotuloSecao =
    'font-arcade px-2.5 pb-1 pt-2 text-[0.4rem] uppercase leading-none text-text-muted';

  const atalhos: { rotulo: string; dia: string | undefined }[] = [
    { rotulo: 'Vence hoje', dia: hoje },
    { rotulo: 'Vence amanhã', dia: somarDias(hoje, 1) },
    { rotulo: 'Vence na próxima semana', dia: somarDias(hoje, 7) },
  ];

  return (
    <div
      ref={caixa}
      role="menu"
      aria-label={`Opções de ${acao.name}`}
      /*
       * SEM `overflow-hidden`. Ele estava aqui para os realces das linhas não
       * vazarem os cantos redondos — e recortava o submenu, que nasce em
       * `left: 100%`, FORA da caixa. O calendário existia no DOM e era
       * invisível. Os cantos ficam resolvidos pelo `p-1` daqui com o
       * `rounded-md` das linhas: elas não alcançam mais a curva da borda.
       *
       * A entrada é a `animate-scale-in` que o app já usa nos modais, e não
       * uma transição minha disparada por `requestAnimationFrame`. Com o rAF
       * o estilo de repouso era `opacity: 0`, então numa aba que não está
       * compositando quadros — de fundo, minimizada — o callback nunca roda e
       * o menu ficava invisível para sempre. Assim o repouso é VISÍVEL e a
       * animação só enfeita: se ela não rodar, o menu ainda serve. De quebra,
       * a classe do projeto já respeita `prefers-reduced-motion`.
       */
      className={`fixed z-50 w-60 rounded-lg border border-solid p-1 shadow-xl ${saindo ? '' : 'animate-scale-in'}`}
      style={{
        // Enquanto não mediu, fica fora da tela: aparecer no lugar errado e
        // corrigir depois é pior que aparecer um quadro mais tarde.
        left: ajuste?.x ?? -9999,
        top: ajuste?.y ?? -9999,
        borderWidth: 2,
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-card)',
        transformOrigin: 'top left',
        // Só a SAÍDA é inline. A classe de entrada sai junto (animação vence
        // estilo inline, então mantê-la aqui anularia o desaparecimento).
        ...(saindo && {
          opacity: 0,
          transform: 'scale(0.96)',
          transition: `opacity ${ANIMACAO_MS}ms ease-out, transform ${ANIMACAO_MS}ms ease-out`,
        }),
      }}
    >
      {atalhos.map(a => (
        <button key={a.rotulo} type="button" role="menuitem" className={item}
          onClick={() => escolherVencimento(a.dia)}>
          {a.rotulo}
        </button>
      ))}

      {/* A linha do submenu. O `onMouseEnter` na linha e não no calendário:
          o calendário nasce ao lado, e só existe depois do atraso. */}
      <div
        className="relative"
        onMouseEnter={e => agendarSubmenu(e.currentTarget)}
        onMouseLeave={cancelarSubmenu}
      >
        <button
          type="button"
          role="menuitem"
          aria-haspopup="true"
          aria-expanded={submenu}
          className={`${item} justify-between`}
          // Clicar também abre, para quem não quer esperar o atraso.
          onClick={e => { e.stopPropagation(); agendarSubmenu(e.currentTarget.parentElement); }}
          style={submenu ? { backgroundColor: 'var(--color-bg-card-hover)', color: 'var(--color-text-primary)' } : undefined}
        >
          <span>Definir vencimento</span>
          <ChevronRight size={14} className="flex-shrink-0" />
        </button>

        {submenu && (
          <div
            className="absolute top-0 w-60"
            style={{
              // Sobe 4px: alinha a primeira linha do calendário com a linha
              // que o abriu, em vez de com a borda do menu.
              marginTop: -4,
              left: submenuAEsquerda ? undefined : '100%',
              right: submenuAEsquerda ? '100%' : undefined,
            }}
          >
            {/* Respiro lateral que também serve de ponte para o mouse: sem
                ele, atravessar o vão entre menu e calendário conta como
                sair e o submenu fecha no meio do caminho. */}
            <div className={submenuAEsquerda ? 'pr-1.5' : 'pl-1.5'}>
              <CalendarioDeUmDia
                valor={acao.dueDate}
                cor={cor}
                onEscolher={escolherVencimento}
              />
            </div>
          </div>
        )}
      </div>

      <button type="button" role="menuitem" className={item}
        onClick={() => escolherVencimento(undefined)}>
        Algum dia
      </button>

      <div className={rotuloSecao}>Prioridade</div>
      <div className="flex items-center gap-1 px-2 pb-1.5">
        {/* A cinza primeiro: ela é o padrão, e é para onde se volta. */}
        {[undefined, ...PRIORIDADES.map(p => p.nivel)].map((nivel, i) => {
          const corDaBandeira = nivel === undefined
            ? SEM_PRIORIDADE_COR
            : PRIORIDADES[i - 1].cor;
          const ativa = acao.prioridade === nivel;
          const nome = nivel === undefined ? 'Sem prioridade' : PRIORIDADES[i - 1].rotulo;

          return (
            <button
              key={nome}
              type="button"
              role="menuitemradio"
              aria-checked={ativa}
              title={nome}
              aria-label={nome}
              onClick={() => escolherPrioridade(nivel)}
              className="flex h-7 w-7 items-center justify-center rounded-[3px] transition-colors"
              style={{
                // A escolhida ganha um leito na própria cor, como o quadro
                // em volta da bandeira do print — não um contorno, que
                // brigaria com a borda do menu.
                backgroundColor: ativa
                  ? `color-mix(in oklab, ${corDaBandeira} 22%, transparent)`
                  : 'transparent',
              }}
            >
              <Flag size={15} fill={corDaBandeira} strokeWidth={0} style={{ color: corDaBandeira }} />
            </button>
          );
        })}
      </div>

      <div className="my-1 border-t border-border" />

      <button
        type="button"
        role="menuitem"
        className={`${item} hover:!text-danger`}
        onClick={() => { onExcluir(); fechar(); }}
      >
        <Trash2 size={14} className="flex-shrink-0" />
        Excluir
      </button>
    </div>
  );
}
