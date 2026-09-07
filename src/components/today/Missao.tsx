import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Anchor, X } from 'lucide-react';

/**
 * A missão: o combinado que não muda, atrás de um botão pequeno.
 *
 * É tela de briefing de máquina, e usa o idioma que a cabine de foco já
 * fala — cantoneiras, filete, scanlines, rótulo em bitmap. Nada aqui é
 * gráfico novo: se a cabine mudar de sotaque um dia, esta tela vai atrás.
 *
 * Fica FECHADA por padrão, e é o ponto todo. Uma lista de regras cravada
 * na aba Hoje viraria paisagem em dois dias — a pessoa passa a olhar sem
 * ler. Escondida atrás de uma âncora, ela só aparece quando alguém decide
 * se lembrar, que é quando a lista ainda tem força.
 *
 * O componente é fechado: o botão, o modal e o estado moram aqui. Quem usa
 * escreve `<Missao />` e não fica com meia máquina de estado na página.
 */

/*
 * O texto mora AQUI, cravado, e de propósito.
 *
 * A tentação era guardar no `localStorage` e dar uma tela de edição. Mas o
 * valor de um combinado é ele não se mexer: um campo de texto editável
 * transforma "sem café" em algo que se negocia numa terça-feira difícil,
 * e a lista deixa de ser âncora para virar rascunho. Mudar de missão é
 * mexer no código — atrito de propósito, e do tamanho certo.
 */
const JORNADA = [
  'Trabalhar 5 horas seg-sex',
  'Trabalhar 7 horas finais de semana',
];

const DISCIPLINA = [
  'Sem youtube',
  'Sem rede social',
  'Sem café',
  'Dormir às 23:30',
  'Sem jogo',
];

const LEMA = 'Nada aqui é abrir mão. É o preço que a gente já escolheu pagar pelo que quer construir.';

/** Tempo da animação de saída. Casado com `cabine-saindo` no CSS. */
const SAIDA_MS = 200;

/** Rótulo de seção: bitmap miúdo entre dois filetes, como a barra da cabine. */
function Secao({ children }: { children: string }) {
  return (
    <div className="mb-3 flex items-center gap-3 text-accent">
      <span className="font-arcade flex-shrink-0 text-[0.45rem] uppercase tracking-wider">
        {children}
      </span>
      <span className="filete flex-1" />
    </div>
  );
}

/**
 * Uma linha da missão.
 *
 * O marcador carrega o sentido, e por isso são dois desenhos e não um: o
 * quadrado cheio é o que se FAZ, o × é o que não se faz. Bate o olho e a
 * lista se divide sozinha, sem precisar ler o rótulo da seção de novo.
 */
function Linha({ texto, proibicao }: { texto: string; proibicao?: boolean }) {
  return (
    <li className="flex items-baseline gap-3">
      <span
        aria-hidden
        className="flex-shrink-0 font-arcade text-[0.5rem] leading-none"
        style={{ color: proibicao ? 'var(--color-danger)' : 'var(--color-accent-light)' }}
      >
        {proibicao ? '×' : '■'}
      </span>
      <span className="font-terminal text-lg leading-snug text-text-primary">{texto}</span>
    </li>
  );
}

export default function Missao() {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [saindo, setSaindo] = useState(false);

  /*
   * Mantém montado durante a saída. Desmontar no mesmo quadro em que
   * fecha faz a tela sumir de estalo, sem animação nenhuma.
   */
  useEffect(() => {
    if (aberto) { setMontado(true); setSaindo(false); return; }
    if (!montado) return;
    setSaindo(true);
    const t = window.setTimeout(() => { setMontado(false); setSaindo(false); }, SAIDA_MS);
    return () => window.clearTimeout(t);
  }, [aberto, montado]);

  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [aberto]);

  // Trava a rolagem do fundo enquanto a tela está montada — inclusive na
  // saída, senão a página dá um pulo no meio da animação.
  useEffect(() => {
    if (!montado) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, [montado]);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="alvo-toque font-arcade inline-flex items-center gap-2 rounded-[3px] border border-border-light bg-bg-card px-3 py-2 text-[0.45rem] uppercase tracking-wider text-text-secondary transition-colors hover:border-accent/50 hover:bg-bg-card-hover hover:text-accent-light"
      >
        <Anchor size={12} className="text-accent" />
        Missão
      </button>

      {montado && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          {/* Escurecer, e não desfocar: `backdrop-filter` repinta a árvore
              toda atrás a cada quadro e engasga a animação.

              Véu e painel animam SEPARADOS: o painel cresce e o véu só
              escurece. Animar os dois juntos no contêiner escalava o véu
              `inset-0` junto e mostrava uma tira de página acesa em volta. */}
          <div
            className={`absolute inset-0 bg-black/85 ${saindo ? 'veu-saindo' : 'veu-entrando'}`}
            onClick={() => setAberto(false)}
          />

          <div
            className={`relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-[3px] border border-border-light bg-bg-card shadow-2xl ${
              saindo ? 'cabine-saindo' : 'cabine-entrando'
            }`}
          >
            {/* Brilho de fósforo no topo: atmosfera de tubo, não holofote. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 80% 40% at 50% 0%, color-mix(in oklab, var(--color-accent) 12%, transparent), transparent 70%)',
              }}
            />
            <div aria-hidden className="crt-scanlines pointer-events-none absolute inset-0 opacity-40" />

            {/* Cantoneiras: a moldura de mira das telas de máquina. */}
            {[
              'left-2 top-2 border-l border-t',
              'right-2 top-2 border-r border-t',
              'bottom-2 left-2 border-b border-l',
              'bottom-2 right-2 border-b border-r',
            ].map(pos => (
              <div
                key={pos}
                aria-hidden
                className={`pointer-events-none absolute h-5 w-5 ${pos}`}
                style={{ borderColor: 'color-mix(in oklab, var(--color-accent) 45%, transparent)' }}
              />
            ))}

            <div className="relative flex items-center gap-3 px-6 pb-4 pt-5">
              <Anchor size={14} className="flex-shrink-0 text-accent glow" />
              <span className="font-arcade flex-1 text-[0.55rem] uppercase tracking-wider text-text-primary">
                Missão
              </span>
              {/* O ponto pulsando diz que a máquina está ligada — mesmo
                  detalhe da barra de status da cabine. */}
              <span
                aria-hidden
                className="ponto-status h-1.5 w-1.5 flex-shrink-0"
                style={{ background: 'var(--color-success)' }}
              />
              <button
                onClick={() => setAberto(false)}
                className="botao-icone flex-shrink-0 rounded-[3px] text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                aria-label="Fechar"
              >
                <X size={14} />
              </button>
            </div>

            <div className="rolagem-limpa relative min-h-0 flex-1 px-6 pb-5">
              <Secao>Jornada</Secao>
              <ul className="mb-6 space-y-2">
                {JORNADA.map(t => <Linha key={t} texto={t} />)}
              </ul>

              <Secao>Disciplina</Secao>
              <ul className="space-y-2">
                {DISCIPLINA.map(t => <Linha key={t} texto={t} proibicao={t.startsWith('Sem')} />)}
              </ul>
            </div>

            <div className="relative flex-shrink-0 border-t border-border px-6 py-4">
              <p className="font-terminal text-base leading-snug text-text-secondary">{LEMA}</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
