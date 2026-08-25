import { Play } from 'lucide-react';
import type { Action } from '../../types';
import { corDaPrioridade, rotuloDeVencimento, hojeISO } from '../../lib/tarefas';
import { formatarDuracao } from '../../lib/pomodoro';
import CaixaDeMarcar from './CaixaDeMarcar';

/** Onde a linha arrastada cairia, em relação a esta. */
export type Indicador = 'acima' | 'abaixo' | null;

/**
 * Uma tarefa na lista da frente de propósito.
 *
 * Saiu do `FocusPage.tsx` quando ganhou menu de contexto, selo de
 * vencimento, tintura por prioridade e arrasto: mais quatro
 * responsabilidades num arquivo de 53KB tornariam impossível achar
 * qualquer coisa lá.
 */
export default function LinhaDeTarefa({
  acao, cor, focando, segundosFocados, arrastada, indicador,
  onAlternar, onFocar, onMenu,
  onIniciarArrasto, onArrastarSobre, onSoltar, onTerminarArrasto,
}: {
  acao: Action;
  cor: string;
  focando: boolean;
  segundosFocados: number;
  arrastada: boolean;
  indicador: Indicador;
  onAlternar: () => void;
  onFocar: () => void;
  onMenu: (x: number, y: number) => void;
  onIniciarArrasto: () => void;
  onArrastarSobre: () => void;
  onSoltar: () => void;
  onTerminarArrasto: () => void;
}) {
  const corPrioridade = corDaPrioridade(acao.prioridade);
  const vencimento = acao.dueDate ? rotuloDeVencimento(acao.dueDate, hojeISO()) : null;

  return (
    // O espaçamento vive AQUI, no invólucro, não na fileira de dentro.
    // Estava na de dentro e `last:mb-0` passou a valer sempre: envolvida, a
    // fileira é sempre filha única, logo sempre `:last-child` — e a lista
    // inteira ficou sem respiro entre as tarefas.
    <div className="relative mb-2 last:mb-0">
      {/* O fio de onde a linha cairia. Fora do bloco arrastável e em
          `absolute` para não empurrar a lista e fazer tudo pular a cada
          pixel do arrasto. */}
      {indicador && (
        <span
          className="pointer-events-none absolute left-0 right-0 z-10 h-0.5 rounded-full"
          style={{ backgroundColor: cor, [indicador === 'acima' ? 'top' : 'bottom']: -5 }}
          aria-hidden
        />
      )}

      <div
        draggable
        onDragStart={e => {
          // Necessário no Firefox: sem `setData` o arrasto não começa.
          e.dataTransfer.setData('text/plain', acao.id);
          e.dataTransfer.effectAllowed = 'move';
          onIniciarArrasto();
        }}
        onDragOver={e => { e.preventDefault(); onArrastarSobre(); }}
        onDrop={e => { e.preventDefault(); onSoltar(); }}
        onDragEnd={onTerminarArrasto}
        onContextMenu={e => {
          e.preventDefault();
          onMenu(e.clientX, e.clientY);
        }}
        // Cursor normal, sem mãozinha de agarrar: a tarefa é uma linha de
        // texto que também se arrasta, não uma alça. Trocar o cursor em toda
        // a fileira anunciava o arrasto como se fosse a ação principal dela.
        className={`group flex select-none items-center gap-3 rounded-xl border-solid bg-bg-card px-4 py-2 transition-[border-color,background-color,opacity] duration-200 hover:bg-bg-card-hover ${arrastada ? 'opacity-40' : ''}`}
        style={{
          // 2px em vez de 1: o fio de 1px sumia contra o fundo escuro.
          //
          // Sem prioridade, borda neutra — inclusive na tarefa em foco, onde
          // quem sinaliza é só o play aceso. Com prioridade, a borda vai
          // para a cor da bandeira, mas MISTURADA com a neutra: na cor cheia
          // a fileira inteira virava um retângulo vermelho e a lista lia
          // como uma sequência de alarmes.
          borderWidth: 2,
          borderColor: corPrioridade
            ? `color-mix(in oklab, ${corPrioridade} 45%, var(--color-border))`
            : 'var(--color-border)',
        }}
      >
        <CaixaDeMarcar
          marcada={acao.completed}
          // O check na cor cheia da prioridade: é uma peça pequena, então
          // aqui a cor pode ser inteira sem dominar a fileira.
          cor={corPrioridade ?? cor}
          // Com prioridade, a cor aparece já em repouso: ela é informação
          // permanente da tarefa, e não a dica de "isto é clicável" que a
          // borda neutra normalmente reserva para o hover.
          realcada={corPrioridade !== null}
          rotulo={acao.completed ? 'Reabrir tarefa' : 'Concluir tarefa'}
          onAlternar={onAlternar}
        />

        <span className={`font-terminal min-w-0 flex-1 truncate text-[17px] leading-[1.35] ${acao.completed ? 'text-text-muted line-through' : 'text-text-primary'}`}>
          {acao.name}
        </span>

        {vencimento && (
          <span
            className="font-arcade flex-shrink-0 text-[0.5rem] leading-none"
            style={{
              // O mesmo vermelho da bandeira alta: atrasado e urgente são o
              // mesmo alarme, e dois vermelhos diferentes na mesma fileira
              // fariam parecer que significam coisas diferentes.
              color: vencimento.atrasado ? 'var(--color-prio-alta)' : 'var(--color-text-muted)',
            }}
            title={`Vence em ${acao.dueDate}`}
          >
            {vencimento.texto}
          </span>
        )}

        {segundosFocados > 0 && (
          <span className="flex-shrink-0 font-arcade text-[0.5rem] text-text-muted" title="tempo já focado nesta tarefa">
            {formatarDuracao(segundosFocados)}
          </span>
        )}

        {!acao.completed && (
          <button
            onClick={onFocar}
            aria-label={`Focar em ${acao.name}`}
            title={focando ? 'Abrir o foco em tela cheia' : 'Focar nesta tarefa'}
            // 24px: é a caixa de linha do nome (17px × 1,35 ≈ 23). Com 30 o
            // botão era mais alto que o texto e ditava sozinho a altura da
            // fileira. `.alvo-toque` mantém a área de toque grande sem que o
            // desenho cresça junto.
            className="alvo-toque flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-[background-color,color] duration-200"
            style={{
              // Redondo, sem contorno. A caixa quadrada com borda ficava do
              // lado do quadrado do checkbox e a linha virava duas caixinhas
              // iguais; o círculo separa as duas ações na hora.
              backgroundColor: focando ? cor : `color-mix(in oklab, ${cor} 16%, transparent)`,
              color: focando ? 'var(--color-bg-primary)' : cor,
            }}
          >
            {/* 1px à direita: o triângulo tem o peso na base, então centrado
                pelo retângulo que o envolve ele parece encostado na esquerda. */}
            <Play size={13} fill="currentColor" strokeWidth={0} className="translate-x-px" />
          </button>
        )}
      </div>
    </div>
  );
}
