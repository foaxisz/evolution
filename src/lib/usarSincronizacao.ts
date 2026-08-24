import { useCallback, useEffect, useRef, useState } from 'react';
import { observarGravacoes } from '../store';
import { supabase } from './supabase';
import {
  CHAVES_SINCRONIZADAS, puxar, empurrarMuitas, assinarMudancas,
  type EstadoDaSincronizacao,
} from './sincronizacao';

/** Espera antes de enviar. Marcar cinco hábitos seguidos vira UM envio. */
const ESPERA_MS = 1200;

/**
 * De quanto em quanto tempo perguntar ao servidor, com a tela aberta.
 *
 * A pergunta é barata de propósito — só `chave, atualizado_em`, algumas
 * centenas de bytes — então 10s não pesa nem no 4G. É a rede de segurança
 * de baixo do tempo real: se o Realtime não estiver ligado na tabela, ou
 * cair o websocket, a sincronização continua acontecendo sozinha.
 */
const VIGIA_MS = 10_000;

/**
 * Liga a sincronização ao ciclo de vida do app.
 *
 * Gatilhos, e cada um cobre um buraco do outro:
 *  - gravação local → enfileira envio (com espera, para não ir a cada tecla)
 *  - aviso do servidor (Realtime) → puxa na hora que o outro aparelho grava
 *  - vigia de 10s com a tela aberta → cobre o Realtime desligado ou caído
 *  - entrada / aba volta ao foco / voltou a rede → puxa
 *  - antes de fechar → tenta esvaziar a fila
 *
 * Falha de rede não trava nada: o app é local primeiro, e o que não subiu
 * fica na fila para a próxima tentativa.
 */
export function useSincronizacao(usuarioId: string | null) {
  const [estado, setEstado] = useState<EstadoDaSincronizacao>(
    supabase ? 'ocioso' : 'desligada'
  );
  const [versao, setVersao] = useState(0);

  const fila = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enviando = useRef(false);
  const puxando = useRef(false);

  /**
   * Só libera envio depois da primeira puxada bem-sucedida.
   *
   * Enviar sobrescreve o documento INTEIRO no servidor. Antes de ter lido o
   * que o outro aparelho gravou, qualquer envio apaga o trabalho dele — e é
   * exatamente o que fazia a sincronização não funcionar em nenhuma direção.
   * Enquanto isto for falso a fila só acumula; nada se perde.
   */
  const podeEnviar = useRef(false);

  const esvaziar = useCallback(async () => {
    if (!podeEnviar.current) return;
    if (enviando.current || fila.current.size === 0 || !usuarioId) return;
    enviando.current = true;
    setEstado('enviando');

    const chaves = [...fila.current];
    fila.current.clear();
    try {
      await empurrarMuitas(chaves);
      setEstado('ocioso');
    } catch {
      // Devolve para a fila: o que não subiu tenta de novo na próxima
      // gravação ou quando a aba voltar ao foco.
      chaves.forEach(c => fila.current.add(c));
      setEstado('erro');
    } finally {
      enviando.current = false;
    }
  }, [usuarioId]);

  // Gravações locais alimentam a fila.
  useEffect(() => {
    observarGravacoes(chave => {
      if (!CHAVES_SINCRONIZADAS.includes(chave as typeof CHAVES_SINCRONIZADAS[number])) return;
      fila.current.add(chave);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(esvaziar, ESPERA_MS);
    });
  }, [esvaziar]);

  /**
   * Um ciclo: puxa, devolve a mescla para o servidor, redesenha se mudou.
   *
   * `completo` só na entrada — ver `puxar`. A trava `puxando` existe porque
   * agora há quatro gatilhos e eles se sobrepõem: Realtime e vigia podem
   * cair no mesmo instante, e dois ciclos ao mesmo tempo mesclariam em cima
   * um do outro.
   */
  const sincronizar = useCallback(async (completo = false) => {
    if (!usuarioId || puxando.current) return;
    puxando.current = true;
    try {
      setEstado('enviando');
      const { mudadas, aEnviar } = await puxar(completo);
      podeEnviar.current = true;
      // O resultado da mescla precisa VOLTAR para o servidor. Sem isto o
      // lado que recebeu fica completo, mas o servidor segue com a versão
      // pobre e o outro aparelho nunca vê o conjunto inteiro.
      aEnviar.forEach(c => fila.current.add(c));
      await esvaziar();
      // Só redesenha se algo de fato chegou — bump à toa remonta a árvore
      // inteira e faz a tela piscar.
      if (mudadas.length > 0) setVersao(v => v + 1);
      setEstado('ocioso');
    } catch {
      setEstado('erro');
    } finally {
      puxando.current = false;
    }
  }, [usuarioId, esvaziar]);

  const sincronizarAgora = useCallback(() => sincronizar(false), [sincronizar]);

  // Primeira carga: PUXA antes de enviar.
  //
  // A ordem inversa parecia proteger o histórico local ("a conta nova
  // nasceria vazia"), mas não protegia nada: `puxar` mescla, e servidor
  // vazio não apaga o local — só não traz nada. Já enviar primeiro
  // sobrescrevia no servidor tudo o que o outro aparelho tinha gravado.
  //
  // Puxando primeiro, o envio seguinte sobe o conjunto JÁ mesclado, que é
  // o único estado seguro de publicar.
  useEffect(() => {
    // Sessão nova (ou troca de conta) recomeça travado: só se envia depois
    // de ler o que já está lá.
    podeEnviar.current = false;
    if (!usuarioId) return;
    sincronizar(true);
  }, [usuarioId, sincronizar]);

  // O servidor avisa quando o outro aparelho grava. É isto que faz marcar
  // no celular aparecer no PC sem tocar em nada.
  useEffect(() => {
    if (!usuarioId) return;
    return assinarMudancas(usuarioId, () => sincronizar(false));
  }, [usuarioId, sincronizar]);

  // Vigia por tempo, só com a tela à vista: em segundo plano o navegador
  // estrangula o timer de qualquer jeito, e gastar bateria para perguntar
  // por dado que ninguém está olhando não paga.
  useEffect(() => {
    if (!usuarioId) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') sincronizar(false);
    }, VIGIA_MS);
    return () => clearInterval(id);
  }, [usuarioId, sincronizar]);

  // Aba volta ao foco: outro aparelho pode ter mexido enquanto isso.
  useEffect(() => {
    if (!usuarioId) return;
    const aoVoltar = () => { if (document.visibilityState === 'visible') sincronizarAgora(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', sincronizarAgora);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', sincronizarAgora);
    };
  }, [usuarioId, sincronizarAgora]);

  // Última tentativa ao fechar. `pagehide` e não `beforeunload`: no celular
  // a aba costuma ser descartada sem passar pelo segundo.
  useEffect(() => {
    const aoSair = () => { if (fila.current.size > 0) esvaziar(); };
    window.addEventListener('pagehide', aoSair);
    return () => window.removeEventListener('pagehide', aoSair);
  }, [esvaziar]);

  return { estado, versao, sincronizarAgora };
}
