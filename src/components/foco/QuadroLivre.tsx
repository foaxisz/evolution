import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Grid2x2, Grid2x2X } from 'lucide-react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { getCenaDeQuadro, salvarCenaDeQuadro } from '../../store';

/**
 * O quadro livre: tela infinita, desenho à mão, formas e setas.
 *
 * É o Excalidraw por dentro. Vestimos ele — a paleta do app, a cor da
 * frente como cor padrão do traço, cantos retos, e a barra reduzida ao que
 * serve aqui. O que fica de fora é de propósito:
 *
 *   - Imagem: a cena mora no localStorage, e uma imagem colada vira base64
 *     dentro dela. Um print só estoura a cota dos 5MB do app inteiro.
 *   - Abrir/salvar arquivo e biblioteca: quem guarda é o app, e a cena
 *     sobe junto com o resto. Dois donos do mesmo dado é receita de perda.
 *
 * O PNG continua: exportar é levar para fora, não trocar de dono.
 *
 * Ocupa a JANELA INTEIRA, por portal, como a cabine de foco. Emoldurado no
 * meio da página sobrava meia tela de desenho — e meia tela de tela
 * infinita não serve para nada. Aqui a barra do Excalidraw flutua sobre o
 * desenho, que é como ele foi desenhado para ser usado.
 */

/** Espera antes de gravar. Traço à mão dispara `onChange` a cada ponto. */
const ESPERA_MS = 700;

/**
 * A grade é preferência de quem desenha, não do quadro.
 *
 * Fica no `localStorage` cru e fora da sincronização, como o recolher da
 * barra: é jeito de trabalhar, e vale para todos os quadros — quem gosta
 * de grade gosta em todos.
 */
const CHAVE_GRADE = 'evo_quadro_grade';

export default function QuadroLivre({
  quadroId, cor, nome, onFechar, onRenomear,
}: {
  quadroId: string;
  cor: string;
  nome: string;
  onFechar: () => void;
  onRenomear: (nome: string) => void;
}) {
  const [cheio, setCheio] = useState(false);
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [grade, setGrade] = useState(() => localStorage.getItem(CHAVE_GRADE) === '1');
  const relogio = useRef<number | null>(null);
  const ultimos = useRef<unknown[] | null>(null);
  const inicial = useRef(getCenaDeQuadro(quadroId));

  const gravar = useCallback((elementos: readonly unknown[]) => {
    // `deleted` fica na cena para o desfazer funcionar; no disco é peso
    // morto que só cresce.
    const vivos = (elementos as { isDeleted?: boolean }[]).filter(e => !e.isDeleted);
    ultimos.current = vivos;

    if (relogio.current !== null) window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(() => {
      relogio.current = null;
      if (!salvarCenaDeQuadro(quadroId, vivos)) setCheio(true);
    }, ESPERA_MS);
  }, [quadroId]);

  /*
   * Gravação pendente não pode morrer com o componente: sair do quadro logo
   * depois de um traço é exatamente o caso comum.
   *
   * Grava o que o ÚLTIMO `onChange` trouxe, e não o que a API do Excalidraw
   * responde agora. Perguntar a ela aqui APAGAVA o quadro: no desmonte ela
   * devolve uma lista vazia, e lista vazia é uma cena válida — o app
   * gravava zero elemento por cima do desenho e ninguém era avisado. Trocar
   * de aba com um retângulo na tela e voltar para encontrar a prancheta
   * limpa era o sintoma.
   *
   * Só grava se houver relógio pendente. Sem isso, sair de um quadro que
   * ninguém tocou reescreveria a cena à toa a cada visita.
   */
  useEffect(() => () => {
    if (relogio.current === null) return;
    window.clearTimeout(relogio.current);
    relogio.current = null;
    if (ultimos.current) salvarCenaDeQuadro(quadroId, ultimos.current);
  }, [quadroId]);

  // Trava a rolagem do fundo enquanto o quadro está aberto.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, []);

  /*
   * Esc NÃO sai do quadro, ao contrário da cabine de foco.
   *
   * A tecla é do Excalidraw: lá dentro ela larga a seleção, fecha o painel
   * de cores e cancela um traço no meio. E ele não só a usa — chama
   * `stopPropagation()`, então um ouvinte na fase de borbulha nunca é
   * chamado. Ouvir na captura funcionaria, e ao preço de atropelar tudo
   * isso: o gesto de "cancelar isto aqui" jogaria a pessoa para fora do
   * quadro. Quem quer sair aperta o botão que diz Sair.
   */

  function salvarNome() {
    if (rascunho === null) return;
    const n = rascunho.trim();
    if (n && n !== nome) onRenomear(n);
    setRascunho(null);
  }

  return createPortal(
    <div
      className="quadro-imersivo cabine-entrando fixed inset-0 z-[120]"
      style={{ backgroundColor: 'var(--cor-tela-quadro)' }}
    >
      <Excalidraw
        // "light" de propósito, num app inteiro escuro.
        //
        // O modo escuro do Excalidraw não troca as cores: ele joga um
        // `filter: invert()` por cima da tela. Nele, um fundo quase-preto
        // vira cinza-claro e o ciano da frente vira laranja. O tema claro
        // não filtra nada — as cores saem como foram pedidas —, e o
        // cromado dele já vem escuro pelas variáveis que redeclaramos no
        // `index.css`.
        theme="light"
        langCode="pt-BR"
        gridModeEnabled={grade}
        initialData={{
          elements: (inicial.current?.elementos ?? []) as never,
          appState: {
            // O mesmo roxo do `--cor-tela-quadro` no index.css. Repetido
            // aqui porque esta cor entra na CENA — é ela que o Excalidraw
            // pinta no canvas e no PNG exportado, e canvas não lê variável
            // de CSS. Mudar uma sem a outra deixa a tela de um tom e o
            // cromado de outro.
            viewBackgroundColor: '#1b1436',
            currentItemStrokeColor: cor,
            currentItemRoughness: 0,
            currentItemFontFamily: 3,
          },
          scrollToContent: true,
        }}
        onChange={elementos => gravar(elementos)}
        /*
         * Voltar e nome entram pelo ponto de extensão DELES, e não como
         * uma barra flutuante nossa.
         *
         * Sobrepor era a primeira ideia e caiu em cima do menu-sanduíche,
         * que também mora no canto de cima. Aqui o layout do Excalidraw
         * cuida do espaçamento — e continua cuidando quando eles mudarem o
         * cromado de lugar.
         */
        renderTopRightUI={() => (
          <div className="flex min-w-0 items-center gap-1.5">
            {rascunho !== null ? (
              <input
                autoFocus
                onFocus={e => e.target.select()}
                value={rascunho}
                onChange={e => setRascunho(e.target.value)}
                onBlur={salvarNome}
                onKeyDown={e => {
                  if (e.key === 'Enter') salvarNome();
                  // Esc aqui é do campo, não do quadro: desiste da
                  // renomeação. Tratado no proprio input porque o
                  // Excalidraw corta a propagacao mais acima.
                  if (e.key === 'Escape') { e.stopPropagation(); setRascunho(null); }
                }}
                className="font-terminal hidden w-40 min-w-0 rounded-[3px] border-2 border-solid bg-bg-input px-2 py-1 text-[16px] leading-none text-text-primary focus:outline-none lg:block"
                style={{ borderColor: cor }}
              />
            ) : (
              <button
                onClick={() => setRascunho(nome)}
                title={`${nome} — clique para renomear`}
                /* Some abaixo de 1024px: a barra de ferramentas fica no
                   centro e o que sobra à direita não cabe nome inteiro
                   MAIS o botão de sair. Cortar o nome em "Pran…" dá um toco
                   sem função; o sair, sim, precisa estar sempre lá. Quem
                   quiser renomear numa tela estreita usa o lápis na lista. */
                className="font-terminal hidden max-w-[12rem] truncate rounded-[3px] px-1.5 py-1 text-[16px] leading-none text-text-secondary transition-colors hover:text-text-primary lg:block"
              >
                {nome}
              </button>
            )}
            <button
              onClick={() => {
                const v = !grade;
                localStorage.setItem(CHAVE_GRADE, v ? '1' : '0');
                setGrade(v);
              }}
              aria-label={grade ? 'Tirar o quadriculado' : 'Pôr o quadriculado'}
              title={grade ? 'Tirar o quadriculado' : 'Pôr o quadriculado'}
              className={[
                'flex flex-shrink-0 items-center rounded-[3px] border-2 border-solid p-1.5 transition-colors',
                grade
                  ? 'border-accent-dim bg-accent/20 text-accent-light'
                  : 'border-border bg-bg-card text-text-muted hover:text-text-primary',
              ].join(' ')}
            >
              {grade ? <Grid2x2 size={14} /> : <Grid2x2X size={14} />}
            </button>

            <button
              onClick={onFechar}
              aria-label="Voltar para os quadros"
              title="Voltar para os quadros"
              className="flex flex-shrink-0 items-center gap-1.5 rounded-[3px] border-2 border-solid border-border bg-bg-card px-2 py-1.5 text-text-muted transition-colors hover:text-text-primary"
            >
              <ArrowLeft size={14} />
              <span className="font-arcade text-[0.5rem] uppercase leading-none">Sair</span>
            </button>
          </div>
        )}
        UIOptions={{
          tools: { image: false },
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: true,
            export: false,
            toggleTheme: false,
            changeViewBackgroundColor: false,
          },
        }}
      />

      {cheio && (
        <p className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-[3px] border-2 border-solid border-danger bg-bg-card px-3 py-1.5 text-[11px] text-danger">
          A memória do app encheu — este desenho não foi salvo.
        </p>
      )}
    </div>,
    document.body
  );
}
