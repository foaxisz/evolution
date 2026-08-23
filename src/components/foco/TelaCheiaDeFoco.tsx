import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Play, Pause, Square } from 'lucide-react';
import type { FocoEmAndamento, Action, CategoriaDeFoco } from '../../types';
import { segundosRestantes, progresso, formatarRelogio, formatarDuracao } from '../../lib/pomodoro';
import ProgressRing from '../ui/ProgressRing';
import HabitIcon from '../ui/HabitIcon';
import RelogioArcade from './RelogioArcade';
import Duracao from './Duracao';
import CaixaDeMarcar from './CaixaDeMarcar';

interface TelaCheiaDeFocoProps {
  aberta: boolean;
  categoria: CategoriaDeFoco;
  foco: FocoEmAndamento | null;
  minutosPadrao: number;
  /** Nome do que está sendo focado agora. */
  alvo: string | null;
  tarefas: Action[];
  /** Tarefa em foco, para destacar na lista. */
  actionIdAtual?: string;
  segundosHoje: number;
  recordeSegundos: number;
  onFechar: () => void;
  onIniciar: (actionId?: string) => void;
  onPausar: () => void;
  onRetomar: () => void;
  onParar: () => void;
  onAlternarTarefa: (id: string) => void;
}

const COR_PAUSA = 'var(--color-success)';

/**
 * Cabine de foco em tela cheia.
 *
 * Portal para o `body` pelo mesmo motivo do Modal e do Toast: qualquer
 * ancestral com `transform` vira bloco de contenção e o `position: fixed`
 * passa a se posicionar pela div da página em vez da janela.
 *
 * `z-[120]`: acima do Toast (110) e abaixo do `.crt-overlay` global do
 * Layout (200) — assim as listras de TV caem por cima da cabine de graça.
 */
export default function TelaCheiaDeFoco({
  aberta, categoria, foco, minutosPadrao, alvo, tarefas, actionIdAtual,
  segundosHoje, recordeSegundos, onFechar, onIniciar, onPausar, onRetomar,
  onParar, onAlternarTarefa,
}: TelaCheiaDeFocoProps) {
  const [montada, setMontada] = useState(aberta);
  const [saindo, setSaindo] = useState(false);

  // Mantém montada durante a saída — desmontar no mesmo quadro faria a
  // cabine sumir de estalo, sem animação nenhuma.
  useEffect(() => {
    if (aberta) { setMontada(true); setSaindo(false); return; }
    if (!montada) return;
    setSaindo(true);
    const t = window.setTimeout(() => { setMontada(false); setSaindo(false); }, 220);
    return () => window.clearTimeout(t);
  }, [aberta, montada]);

  // Esc fecha a cabine, mas NÃO para o bloco: sair da tela cheia é um
  // gesto de navegação, não de desistência.
  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberta, onFechar]);

  // Trava a rolagem do fundo enquanto a cabine está aberta.
  useEffect(() => {
    if (!montada) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, [montada]);

  if (!montada) return null;

  const cor = categoria.cor;
  const emPausa = foco?.tipo === 'pausa';
  const rodando = !!foco && foco.pausadaEm === null;
  const pausado = !!foco && foco.pausadaEm !== null;
  const corAtual = emPausa ? COR_PAUSA : cor;
  const segundos = foco ? segundosRestantes(foco) : minutosPadrao * 60;
  const pct = foco ? progresso(foco) * 100 : 0;
  const estado = !foco ? 'pronto' : pausado ? 'pausado' : emPausa ? 'pausa' : 'focando';

  const pendentes = tarefas.filter(t => !t.completed);

  return createPortal(
    <div
      className={`fixed inset-0 z-[120] rolagem-limpa bg-bg-primary ${saindo ? 'cabine-saindo' : 'cabine-entrando'}`}
    >
      {/* Brilho de fósforo na cor da frente */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          // Atmosfera, não holofote: 18% virava uma mancha colorida no topo.
          background: `radial-gradient(ellipse 70% 45% at 50% 0%, color-mix(in oklab, ${corAtual} 9%, transparent), transparent 68%)`,
        }}
      />
      <div aria-hidden className="crt-scanlines pointer-events-none fixed inset-0 opacity-40" />

      <div className="relative flex min-h-full flex-col px-5 py-5 lg:flex-row lg:gap-8 lg:px-10 lg:py-8">
        {/* ── Coluna principal ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Barra de sistema */}
          <div className="mb-8 flex items-center gap-3">
            <button
              onClick={onFechar}
              aria-label="Fechar tela cheia"
              className="alvo-toque font-arcade flex flex-shrink-0 items-center gap-2 text-[0.45rem] uppercase text-text-muted transition-colors hover:text-text-primary"
            >
              <ChevronDown size={14} />
              <span className="hidden sm:inline">recolher</span>
            </button>

            <span className="hidden flex-1 items-center gap-3 sm:flex" style={{ color: cor }}>
              <span className="filete flex-1" />
              <span className="font-arcade flex items-center gap-2 text-[0.45rem] uppercase text-text-secondary">
                <HabitIcon name={categoria.icone} size={11} color={cor} />
                {categoria.nome}
              </span>
              <span className="filete flex-1" />
            </span>

            <span className="font-arcade flex flex-shrink-0 items-center gap-2 text-[0.45rem] uppercase" style={{ color: corAtual }}>
              <span
                className={`h-1.5 w-1.5 ${rodando ? 'ponto-status' : ''}`}
                style={{
                  background: rodando ? corAtual : 'var(--color-border-light)',
                  boxShadow: rodando ? `0 0 8px ${corAtual}` : 'none',
                }}
              />
              {estado}
            </span>
          </div>

          {/* Núcleo */}
          <div className="relative flex flex-1 flex-col items-center justify-center py-4">
            {/* cantos de moldura, como visor de máquina */}
            <div className="pointer-events-none absolute left-0 top-0 h-7 w-7 border-l border-t" style={{ borderColor: `color-mix(in oklab, ${cor} 40%, transparent)` }} />
            <div className="pointer-events-none absolute right-0 top-0 h-7 w-7 border-r border-t" style={{ borderColor: `color-mix(in oklab, ${cor} 40%, transparent)` }} />
            <div className="pointer-events-none absolute bottom-0 left-0 h-7 w-7 border-b border-l" style={{ borderColor: `color-mix(in oklab, ${cor} 40%, transparent)` }} />
            <div className="pointer-events-none absolute bottom-0 right-0 h-7 w-7 border-b border-r" style={{ borderColor: `color-mix(in oklab, ${cor} 40%, transparent)` }} />

            <div className="lg:hidden">
              <AnelDoRelogio tamanho={244} pct={pct} cor={corAtual} segundos={segundos} escala={1.5} />
            </div>
            <div className="hidden lg:block">
              <AnelDoRelogio tamanho={368} pct={pct} cor={corAtual} segundos={segundos} escala={2.3} />
            </div>

            {/* O alvo, abaixo do mostrador e sem caixa.
                Era uma etiqueta emoldurada ACIMA do anel: mais uma borda
                competindo com o aro logo abaixo, e ela carregava texto de
                recheio ("escolha uma tarefa ao lado") quando não havia
                bloco. Agora só existe quando há algo para dizer, e usa o
                mesmo filete da barra de sistema em vez de moldura nova. */}
            {foco && !emPausa && alvo && (
              <div className="mt-7 flex w-full max-w-md items-center gap-3" style={{ color: corAtual }}>
                <span className="filete flex-1" />
                <span className="font-arcade break-words text-center text-[0.5rem] uppercase leading-[1.6]">
                  {alvo}
                </span>
                <span className="filete flex-1" />
              </div>
            )}

            <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
              {!foco ? (
                <BotaoGrande onClick={() => onIniciar()} cor={cor}>
                  <Play size={17} fill="currentColor" /> Começar
                </BotaoGrande>
              ) : rodando ? (
                <>
                  <BotaoGrande onClick={onPausar} cor={corAtual}>
                    <Pause size={17} fill="currentColor" /> Pausar
                  </BotaoGrande>
                  <BotaoDiscreto onClick={onParar}><Square size={13} /> Encerrar</BotaoDiscreto>
                </>
              ) : (
                <>
                  <BotaoGrande onClick={onRetomar} cor={corAtual}>
                    <Play size={17} fill="currentColor" /> Retomar
                  </BotaoGrande>
                  <BotaoDiscreto onClick={onParar}><Square size={13} /> Encerrar</BotaoDiscreto>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Painel lateral ── */}
        <aside className="mt-8 w-full flex-shrink-0 space-y-3 lg:mt-0 lg:w-72">
          {/* "Foco hoje" e "Recorde num dia" eram dois módulos. Um número
              e o número contra o qual ele se compara pertencem ao mesmo
              instrumento — separados, viravam duas caixas dizendo a mesma
              coisa em metade da tela cada. */}
          <Modulo titulo="Foco hoje" cor={cor}>
            <Duracao segundos={segundosHoje} cor={cor} />
            {recordeSegundos > 0 && (
              <>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-[1px] bg-bg-input">
                  <div
                    className="h-full transition-[width] duration-500"
                    style={{
                      width: `${Math.min(100, (segundosHoje / recordeSegundos) * 100)}%`,
                      backgroundColor: cor,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-text-muted">
                  recorde <span className="tabular-nums">{formatarDuracao(recordeSegundos)}</span>
                </p>
              </>
            )}
          </Modulo>

          <Modulo titulo="Tarefas" cor={cor}>
            {pendentes.length === 0 ? (
              <p className="text-xs text-text-muted">Nenhuma tarefa aberta.</p>
            ) : (
              // Sem o `-mx-1` que havia aqui: a margem negativa deixava o
              // conteúdo mais largo que o pai e nascia uma barra horizontal
              // que não rolava nada.
              <div className="rolagem-limpa max-h-64">
                {pendentes.map(t => {
                  const focando = actionIdAtual === t.id;
                  return (
                    // Sem fundo tingido na tarefa em foco: a faixa colorida
                    // atrás do texto lê como marca-texto, não como estado.
                    // Quem sinaliza é o triângulo à direita — o mesmo
                    // símbolo do play, agora dizendo "é esta que está
                    // rodando".
                    <div
                      key={t.id}
                      className="mb-1 flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors last:mb-0"
                    >
                      <CaixaDeMarcar
                        marcada={false}
                        cor={cor}
                        rotulo={`Concluir ${t.name}`}
                        onAlternar={() => onAlternarTarefa(t.id)}
                      />
                      <span
                        className="font-terminal min-w-0 flex-1 truncate text-[16px] leading-[1.35]"
                        style={{ color: focando ? cor : 'var(--color-text-secondary)' }}
                      >
                        {t.name}
                      </span>

                      {focando && (
                        <span
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center"
                          style={{ color: cor }}
                          title="em foco agora"
                          aria-label="em foco agora"
                        >
                          <Play size={10} fill="currentColor" strokeWidth={0} className="translate-x-px" />
                        </span>
                      )}

                      {!focando && !foco && (
                        <button
                          onClick={() => onIniciar(t.id)}
                          aria-label={`Focar em ${t.name}`}
                          // Mesmo play da lista da frente: redondo, cheio
                          // de leve, sem contorno.
                          className="alvo-toque flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-200"
                          style={{ backgroundColor: `color-mix(in oklab, ${cor} 16%, transparent)`, color: cor }}
                        >
                          <Play size={10} fill="currentColor" strokeWidth={0} className="translate-x-px" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Modulo>
        </aside>
      </div>
    </div>,
    document.body,
  );
}

/**
 * O mostrador.
 *
 * Traços mais grossos e em menor número (40 em vez de 60): com 60 finos o
 * anel virava um pontilhado delicado, e no começo do bloco — quando quase
 * nada está aceso — parecia um círculo cinza sem função.
 *
 * O aro externo e o interno fecham o mostrador como bisel de máquina; sem
 * eles os traços flutuam soltos no escuro.
 */
function AnelDoRelogio({
  tamanho, pct, cor, segundos, escala,
}: { tamanho: number; pct: number; cor: string; segundos: number; escala: number }) {
  const raio = tamanho / 2;
  return (
    <div className="relative" style={{ width: tamanho, height: tamanho }}>
      <svg
        width={tamanho}
        height={tamanho}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <circle
          cx={raio} cy={raio} r={raio - 1}
          fill="none"
          stroke={`color-mix(in oklab, ${cor} 22%, transparent)`}
          strokeWidth={1}
        />
        <circle
          cx={raio} cy={raio} r={raio - Math.round(tamanho * 0.085)}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1}
        />
      </svg>

      <ProgressRing
        value={pct}
        size={tamanho}
        strokeWidth={Math.round(tamanho * 0.07)}
        ticks={40}
        color={cor}
        centro={<RelogioArcade tempo={formatarRelogio(segundos)} cor={cor} tamanho={escala} />}
      />
    </div>
  );
}

/** Módulo do painel lateral: retângulo seco com marca de canal à esquerda,
 *  como instrumento montado em rack. Sem `backdrop-blur`, que embaçava o
 *  fundo e deixava tudo com aspecto de vidro fosco de app de celular. */
function Modulo({ titulo, cor, children }: { titulo: string; cor: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: 'var(--color-border)',
        borderTopColor: `color-mix(in oklab, ${cor} 45%, var(--color-border))`,
        backgroundColor: 'var(--color-bg-card)',
        backgroundImage: `linear-gradient(180deg, color-mix(in oklab, ${cor} 7%, transparent), transparent 45%)`,
        boxShadow: `inset 0 1px 0 color-mix(in oklab, ${cor} 18%, transparent)`,
      }}
    >
      <h2 className="mb-2.5 text-[9px] uppercase tracking-[0.28em] text-text-muted">{titulo}</h2>
      {children}
    </div>
  );
}

/**
 * Comando principal.
 *
 * Sem halo colorido e sem `scale` no hover: o brilho de 30px em volta e o
 * pulinho faziam a peça parecer botão de joguinho. A hierarquia agora vem
 * do preenchimento cheio e da tipografia, não da luz — e o retângulo de
 * canto curto lê como painel, não como bolha.
 */
function BotaoGrande({ onClick, children, cor }: { onClick: () => void; children: React.ReactNode; cor: string }) {
  return (
    <button
      onClick={onClick}
      className="font-arcade flex items-center gap-3 rounded-lg px-8 py-4 text-[0.5rem] uppercase leading-[1.5] transition-[filter] duration-200 hover:brightness-110"
      style={{ backgroundColor: cor, color: 'var(--color-bg-primary)' }}
    >
      {children}
    </button>
  );
}

/**
 * Comando secundário.
 *
 * A hierarquia vem do TIPO, não só do tamanho: o principal está na fonte
 * de bitmap, este na mono do resto do app. Antes os dois tinham o mesmo
 * corpo e o mesmo `py-3`, e a fileira parecia três botões iguais entre os
 * quais era preciso ler para escolher.
 */
function BotaoDiscreto({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors hover:border-border-light hover:text-text-primary"
    >
      {children}
    </button>
  );
}
