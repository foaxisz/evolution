import { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { getCenaDeQuadro, salvarCenaDeQuadro } from '../../store';

/**
 * O quadro livre: tela infinita, desenho à mão, formas e setas.
 *
 * É o Excalidraw por dentro. Vestimos ele — tema escuro, a cor da frente
 * como cor padrão do traço, cantos retos, e a barra reduzida ao que serve
 * aqui. O que fica de fora é de propósito:
 *
 *   - Imagem: a cena mora no localStorage, e uma imagem colada vira base64
 *     dentro dela. Um print só estoura a cota dos 5MB do app inteiro.
 *   - Abrir/salvar arquivo e biblioteca: quem guarda é o app, e a cena
 *     sobe junto com o resto. Dois donos do mesmo dado é receita de perda.
 *
 * O PNG continua: exportar é levar para fora, não trocar de dono.
 */

/** Espera antes de gravar. Traço à mão dispara `onChange` a cada ponto. */
const ESPERA_MS = 700;

export default function QuadroLivre({ quadroId, cor }: { quadroId: string; cor: string }) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [cheio, setCheio] = useState(false);
  const relogio = useRef<number | null>(null);
  const inicial = useRef(getCenaDeQuadro(quadroId));

  const gravar = useCallback((elementos: readonly unknown[]) => {
    if (relogio.current) window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(() => {
      // `deleted` fica na cena para o desfazer funcionar; no disco é peso
      // morto que só cresce.
      const vivos = (elementos as { isDeleted?: boolean }[]).filter(e => !e.isDeleted);
      if (!salvarCenaDeQuadro(quadroId, vivos)) setCheio(true);
    }, ESPERA_MS);
  }, [quadroId]);

  // Gravação pendente não pode morrer com o componente: sair do quadro logo
  // depois de um traço é exatamente o caso comum.
  useEffect(() => () => {
    if (relogio.current) window.clearTimeout(relogio.current);
    const atual = api?.getSceneElements();
    if (atual) salvarCenaDeQuadro(quadroId, [...atual]);
  }, [api, quadroId]);

  return (
    <div className="quadro-livre" style={{ ['--cor-quadro' as string]: cor }}>
      {cheio && (
        <p className="mb-2 text-[11px] leading-relaxed text-danger">
          A memória do app encheu — este desenho não foi salvo. Apague algo
          antes de continuar.
        </p>
      )}

      <div className="tela-do-quadro">
        <Excalidraw
          excalidrawAPI={setApi}
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
          initialData={{
            elements: (inicial.current?.elementos ?? []) as never,
            appState: {
              // Fundo fixo e igual ao dos campos do app: a troca de fundo
              // está desligada, então ele também é o fundo do PNG exportado.
              viewBackgroundColor: '#0f0b1c',
              currentItemStrokeColor: cor,
              currentItemRoughness: 0,
              currentItemFontFamily: 3,
            },
            scrollToContent: true,
          }}
          onChange={elementos => gravar(elementos)}
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
      </div>
    </div>
  );
}
