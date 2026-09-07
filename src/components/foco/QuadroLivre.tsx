import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Grid2x2, Grid2x2X, Sun, Moon } from 'lucide-react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { getCenaDeQuadro, salvarCenaDeQuadro } from '../../store';

/**
 * O quadro livre: tela infinita, desenho à mão, formas e setas.
 *
 * É o Excalidraw por dentro, e a COR é dele: tema claro ou escuro, no
 * botão, sem repintura nossa. Nosso ficam a forma (canto reto), a
 * tipografia e o que a barra mostra. O que fica de fora é de propósito:
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

/** Claro ou escuro, pela mesma razão da grade: é jeito de trabalhar. Nasce
 *  escuro porque o app é escuro — abrir um quadro em tela cheia não deveria
 *  ser um estouro de branco na cara de quem estava no escuro. */
const CHAVE_TEMA = 'evo_quadro_tema';

/** Grava a preferência e atualiza a tela, na mesma batida. */
function trocar<T extends string | boolean>(
  chave: string, valor: T, aplicar: (v: T) => void,
): void {
  localStorage.setItem(chave, typeof valor === 'boolean' ? (valor ? '1' : '0') : valor);
  aplicar(valor);
}

/**
 * Os botões nossos, pintados com as variáveis DELE.
 *
 * Assim eles seguem o tema escolhido sem repetir a paleta aqui: no claro
 * ficam claros, no escuro ficam escuros, e uma versão nova do Excalidraw
 * que reequilibre as cores leva os nossos botões junto.
 */
function estiloDeBotao(ativo: boolean): React.CSSProperties {
  return ativo
    ? { background: 'var(--color-primary)', color: 'var(--color-icon-white, #fff)' }
    : { background: 'var(--island-bg-color)', color: 'var(--color-on-surface)' };
}

export default function QuadroLivre({
  quadroId, nome, onFechar, onRenomear,
}: {
  quadroId: string;
  nome: string;
  onFechar: () => void;
  onRenomear: (nome: string) => void;
}) {
  const [cheio, setCheio] = useState(false);
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [grade, setGrade] = useState(() => localStorage.getItem(CHAVE_GRADE) === '1');
  const [tema, setTema] = useState<'claro' | 'escuro'>(
    () => (localStorage.getItem(CHAVE_TEMA) === 'claro' ? 'claro' : 'escuro')
  );
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
      // A moldura acompanha a prancheta: enquanto o Excalidraw monta, é
      // este fundo que aparece, e a cor errada aqui é um flash na entrada.
      style={{ backgroundColor: tema === 'claro' ? '#ffffff' : '#121212' }}
    >
      <Excalidraw
        /*
         * O tema é o DELE, claro ou escuro, e nenhum dos dois é repintado.
         *
         * Houve aqui um tema roxo montado à mão por cima. Ele custava caro:
         * o escuro do Excalidraw não troca cores, joga um `filter: invert()`
         * na tela inteira, então qualquer cor nossa saía trocada — e a
         * grade, que é desenhada no canvas e não lê CSS, precisava ser
         * repintada na hora de compilar. Nos dois temas nativos nada disso
         * é preciso: a paleta deles já foi calibrada para cada um.
         *
         * Sem `viewBackgroundColor` também de propósito: o padrão deles é
         * branco, que no escuro o filtro inverte para o quase-preto certo.
         */
        theme={tema === 'claro' ? 'light' : 'dark'}
        langCode="pt-BR"
        gridModeEnabled={grade}
        initialData={{
          elements: (inicial.current?.elementos ?? []) as never,
          appState: {
            // Traço reto e fonte de máquina: não são cor, não brigam com
            // tema nenhum, e são o que ainda diz que este quadro é daqui.
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
                className="font-terminal hidden w-40 min-w-0 rounded-[3px] px-2 py-1 text-[16px] leading-none focus:outline-none lg:block"
                style={{
                  background: 'var(--input-bg-color)',
                  color: 'var(--text-primary-color)',
                  border: '1px solid var(--color-primary)',
                }}
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
                className="font-terminal hidden max-w-[12rem] truncate rounded-[3px] px-1.5 py-1 text-[16px] leading-none opacity-70 transition-opacity hover:opacity-100 lg:block"
                style={{ color: 'var(--color-on-surface)' }}
              >
                {nome}
              </button>
            )}

            <button
              onClick={() => trocar(CHAVE_GRADE, !grade, setGrade)}
              aria-label={grade ? 'Tirar o quadriculado' : 'Pôr o quadriculado'}
              title={grade ? 'Tirar o quadriculado' : 'Pôr o quadriculado'}
              className="flex flex-shrink-0 items-center rounded-[3px] p-1.5"
              style={estiloDeBotao(grade)}
            >
              {grade ? <Grid2x2 size={14} /> : <Grid2x2X size={14} />}
            </button>

            <button
              onClick={() => trocar(CHAVE_TEMA, tema === 'claro' ? 'escuro' : 'claro', setTema)}
              aria-label={tema === 'claro' ? 'Prancheta escura' : 'Prancheta clara'}
              title={tema === 'claro' ? 'Prancheta escura' : 'Prancheta clara'}
              className="flex flex-shrink-0 items-center rounded-[3px] p-1.5"
              style={estiloDeBotao(false)}
            >
              {tema === 'claro' ? <Moon size={14} /> : <Sun size={14} />}
            </button>

            <button
              onClick={onFechar}
              aria-label="Voltar para os quadros"
              title="Voltar para os quadros"
              className="flex flex-shrink-0 items-center gap-1.5 rounded-[3px] px-2 py-1.5"
              style={estiloDeBotao(false)}
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
