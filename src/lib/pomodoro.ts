import type { FocoEmAndamento } from '../types';

/**
 * Contas do cronômetro.
 *
 * Regra central: o tempo restante é SEMPRE derivado de `Date.now()` menos
 * o carimbo de início. Nunca de um contador que decrementa a cada tique.
 *
 * O motivo é que navegador estrangula temporizador de aba em segundo
 * plano — em celular a aba pode nem receber tique. Um contador que
 * decrementa iria atrasando, e um pomodoro de 25 minutos terminaria em 40
 * de relógio real. Derivando do carimbo, o tique é só para repintar a
 * tela: se ele falhar mil vezes, o número continua certo na volta.
 *
 * Pelo mesmo motivo o estado sobrevive a fechar o app: basta ter gravado
 * `inicioEm`.
 */

/** Quanto tempo o bloco realmente correu, em ms, descontando pausas. */
export function msDecorridos(foco: FocoEmAndamento, agora: number = Date.now()): number {
  const ateAqui = foco.pausadaEm ?? agora;
  return Math.max(0, ateAqui - foco.inicioEm - foco.msPausados);
}

/** Segundos que faltam para fechar o bloco. Nunca negativo. */
export function segundosRestantes(foco: FocoEmAndamento, agora: number = Date.now()): number {
  const total = foco.minutosPlanejados * 60_000;
  return Math.max(0, Math.ceil((total - msDecorridos(foco, agora)) / 1000));
}

export function terminou(foco: FocoEmAndamento, agora: number = Date.now()): boolean {
  return msDecorridos(foco, agora) >= foco.minutosPlanejados * 60_000;
}

/** Fração de 0 a 1 já cumprida do bloco. */
export function progresso(foco: FocoEmAndamento, agora: number = Date.now()): number {
  const total = foco.minutosPlanejados * 60_000;
  if (total <= 0) return 1;
  return Math.min(1, msDecorridos(foco, agora) / total);
}

/** `25:00`. Aceita passar de uma hora sem quebrar o formato. */
export function formatarRelogio(totalSegundos: number): string {
  const s = Math.max(0, Math.floor(totalSegundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  return h > 0
    ? `${h}:${doisDigitos(m)}:${doisDigitos(seg)}`
    : `${doisDigitos(m)}:${doisDigitos(seg)}`;
}

/** "1h 25min" — para totais do dia e da semana. */
export function formatarDuracao(totalSegundos: number): string {
  const min = Math.round(totalSegundos / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${h}h` : `${h}h ${resto}min`;
}

/**
 * A mesma duração em forma de leitor de painel: `1h40`, não `1h 40min`.
 *
 * Press Start 2P não tem versão estreita — cada glifo ocupa o mesmo bloco.
 * `148h 30min` são dez blocos e estoura a caixa do placar, onde o texto é
 * truncado e vira `148h 30m…`. A forma curta cabe em qualquer valor que o
 * app consiga produzir e é como mostrador de máquina escreve mesmo.
 */
export function formatarDuracaoCurta(totalSegundos: number): string {
  const min = Math.round(totalSegundos / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${h}h` : `${h}h${String(resto).padStart(2, '0')}`;
}

/**
 * Sons sintetizados na hora, sem carregar arquivo nenhum.
 *
 * Onda quadrada e frequências em cima da escala pentatônica: é o timbre de
 * chip de 8 bits, do mesmo lugar de onde vem o resto da identidade do app.
 * Uma senoide soaria como notificação de banco.
 *
 * Falha em silêncio de propósito: o navegador bloqueia áudio antes da
 * primeira interação da pessoa com a página, e o cronômetro não pode
 * quebrar por causa disso.
 */
type Nota = { hz: number; em: number; dur?: number };

function tocar(notas: Nota[], volume = 0.16): void {
  try {
    type JanelaComAudio = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext ?? (window as JanelaComAudio).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const t0 = ctx.currentTime;
    let fim = 0;

    notas.forEach(({ hz, em, dur = 0.12 }) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      // `square` é o que dá o corpo de arcade; `sine` sai fino demais.
      osc.type = 'square';
      osc.frequency.setValueAtTime(hz, t0 + em);
      osc.connect(vol);
      vol.connect(ctx.destination);

      // Envelope: sobe rápido e cai. Ganho ligado no talo estala o alto-falante.
      vol.gain.setValueAtTime(0.0001, t0 + em);
      vol.gain.exponentialRampToValueAtTime(volume, t0 + em + 0.012);
      vol.gain.exponentialRampToValueAtTime(0.0001, t0 + em + dur);

      osc.start(t0 + em);
      osc.stop(t0 + em + dur + 0.02);
      fim = Math.max(fim, em + dur);
    });

    window.setTimeout(() => ctx.close(), (fim + 0.4) * 1000);
  } catch {
    // sem som é aceitável; sem cronômetro não é
  }
}

/** Fim do bloco: três notas subindo, como fase concluída. */
export function tocarAviso(): void {
  tocar([
    { hz: 523.25, em: 0 },      // dó
    { hz: 659.25, em: 0.11 },   // mi
    { hz: 783.99, em: 0.22, dur: 0.22 }, // sol, segurando
  ]);
}

/** Tarefa concluída: dois toques curtos e secos, como catraca de placar. */
export function tocarConclusao(): void {
  tocar([
    { hz: 880, em: 0, dur: 0.07 },
    { hz: 1174.66, em: 0.075, dur: 0.11 },
  ], 0.13);
}

/** Começo de bloco: um toque grave curto, quase um "clique" de máquina. */
export function tocarInicio(): void {
  tocar([{ hz: 392, em: 0, dur: 0.09 }], 0.1);
}
