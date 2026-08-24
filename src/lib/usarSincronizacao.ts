import { useCallback, useEffect, useRef, useState } from 'react';
import { observarGravacoes } from '../store';
import { supabase } from './supabase';
import {
  anotarGravacao, puxar, empurrar, primeiraCarga, assinarMudancas,
  type EstadoDaSincronizacao,
} from './sincronizacao';

/**
 * Espera antes de enviar.
 *
 * Curta, porque agora sair não custa quase nada: sobe só o registro que
 * mudou. Ela existe para juntar a rajada de gravações de uma mesma ação —
 * marcar um hábito grava a lista e o contador em sequência — e não para
 * poupar banda.
 */
const ESPERA_MS = 250;

/**
 * De quanto em quanto tempo perguntar ao servidor, com a tela à vista.
 *
 * A pergunta é "o que mudou desde o carimbo X?", que com o índice do banco
 * custa quase nada e quase sempre volta vazia. É a rede de segurança de
 * baixo do tempo real: se o Realtime não estiver ligado na tabela, ou o
 * websocket cair, a sincronização continua acontecendo sozinha.
 */
const VIGIA_MS = 8_000;

/**
 * Liga a sincronização ao ciclo de vida do app.
 *
 * Gatilhos, e cada um cobre um buraco do outro:
 *  - gravação local → anota o registro e agenda o envio
 *  - aviso do servidor (Realtime) → puxa na hora que o outro grava
 *  - vigia de 8s com a tela à vista → cobre Realtime desligado ou caído
 *  - entrada, volta ao foco, volta da rede → puxa
 *  - antes de fechar → última tentativa de esvaziar a fila
 *
 * Falha de rede não trava nada: o app é local primeiro, e o que não subiu
 * fica anotado no `localStorage` — sobrevive até a fechar o app.
 */
export function useSincronizacao(usuarioId: string | null) {
  const [estado, setEstado] = useState<EstadoDaSincronizacao>(
    supabase ? 'ocioso' : 'desligada'
  );
  const [versao, setVersao] = useState(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rodando = useRef(false);
  const denovo = useRef(false);

  /**
   * Um ciclo inteiro: puxa e envia.
   *
   * Puxar ANTES de enviar não é mais questão de segurança — enviar não
   * apaga nada agora — mas continua sendo a ordem certa: a tela mostra o
   * que o outro aparelho fez o quanto antes.
   *
   * A trava é necessária porque há quatro gatilhos e eles se sobrepõem; o
   * `denovo` garante que um aviso chegado no meio do ciclo não seja
   * perdido, só adiado até o fim dele.
   */
  const ciclo = useCallback(async (primeira = false) => {
    if (!usuarioId) return;
    if (rodando.current) { denovo.current = true; return; }

    rodando.current = true;
    try {
      setEstado('enviando');
      const mudadas = primeira ? await primeiraCarga() : await puxar();
      await empurrar();
      // Só redesenha se algo de fato chegou — bump à toa remonta a árvore
      // inteira e faz a tela piscar.
      if (mudadas.length > 0) setVersao(v => v + 1);
      setEstado('ocioso');
    } catch {
      setEstado('erro');
    } finally {
      rodando.current = false;
      if (denovo.current) { denovo.current = false; ciclo(); }
    }
  }, [usuarioId]);

  // Gravações locais viram registros pendentes.
  useEffect(() => {
    observarGravacoes((chave, anterior) => {
      if (!anotarGravacao(chave, anterior)) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(ciclo, ESPERA_MS);
    });
  }, [ciclo]);

  // Entrada no app.
  useEffect(() => {
    if (!usuarioId) return;
    ciclo(true);
  }, [usuarioId, ciclo]);

  // O servidor avisa quando o outro aparelho grava. É isto que faz marcar
  // no celular aparecer no PC sem tocar em nada.
  useEffect(() => {
    if (!usuarioId) return;
    return assinarMudancas(usuarioId, () => ciclo());
  }, [usuarioId, ciclo]);

  // Vigia por tempo, só com a tela à vista: em segundo plano o navegador
  // estrangula o timer de qualquer jeito, e gastar bateria perguntando por
  // dado que ninguém está olhando não paga.
  useEffect(() => {
    if (!usuarioId) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') ciclo();
    }, VIGIA_MS);
    return () => clearInterval(id);
  }, [usuarioId, ciclo]);

  useEffect(() => {
    if (!usuarioId) return;
    const aoVoltar = () => { if (document.visibilityState === 'visible') ciclo(); };
    const aoVoltarARede = () => ciclo();
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', aoVoltarARede);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', aoVoltarARede);
    };
  }, [usuarioId, ciclo]);

  // Última tentativa ao fechar. `pagehide` e não `beforeunload`: no celular
  // a aba costuma ser descartada sem passar pelo segundo.
  useEffect(() => {
    const aoSair = () => { empurrar().catch(() => {}); };
    window.addEventListener('pagehide', aoSair);
    return () => window.removeEventListener('pagehide', aoSair);
  }, []);

  const sincronizarAgora = useCallback(() => ciclo(), [ciclo]);

  return { estado, versao, sincronizarAgora };
}
