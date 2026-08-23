import { useCallback, useEffect, useRef, useState } from 'react';
import { observarGravacoes } from '../store';
import { supabase } from './supabase';
import {
  CHAVES_SINCRONIZADAS, puxar, empurrar, empurrarTudo,
  type EstadoDaSincronizacao,
} from './sincronizacao';

/** Espera antes de enviar. Marcar cinco hábitos seguidos vira UM envio. */
const ESPERA_MS = 1200;

/**
 * Liga a sincronização ao ciclo de vida do app.
 *
 * Três gatilhos, e cada um cobre um buraco do outro:
 *  - gravação local → enfileira envio (com espera, para não ir a cada tecla)
 *  - entrada / aba volta ao foco → puxa o que outro aparelho mudou
 *  - antes de fechar → tenta esvaziar a fila
 *
 * Falha de rede não trava nada: o app é local primeiro, e o que não subiu
 * fica na fila para a próxima tentativa.
 */
export function useSincronizacao(temSessao: boolean) {
  const [estado, setEstado] = useState<EstadoDaSincronizacao>(
    supabase ? 'ocioso' : 'desligada'
  );
  const [versao, setVersao] = useState(0);

  const fila = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enviando = useRef(false);

  const esvaziar = useCallback(async () => {
    if (enviando.current || fila.current.size === 0 || !temSessao) return;
    enviando.current = true;
    setEstado('enviando');

    const chaves = [...fila.current];
    fila.current.clear();
    try {
      for (const c of chaves) await empurrar(c);
      setEstado('ocioso');
    } catch {
      // Devolve para a fila: o que não subiu tenta de novo na próxima
      // gravação ou quando a aba voltar ao foco.
      chaves.forEach(c => fila.current.add(c));
      setEstado('erro');
    } finally {
      enviando.current = false;
    }
  }, [temSessao]);

  // Gravações locais alimentam a fila.
  useEffect(() => {
    observarGravacoes(chave => {
      if (!CHAVES_SINCRONIZADAS.includes(chave as typeof CHAVES_SINCRONIZADAS[number])) return;
      fila.current.add(chave);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(esvaziar, ESPERA_MS);
    });
  }, [esvaziar]);

  const sincronizarAgora = useCallback(async () => {
    if (!temSessao) return;
    try {
      setEstado('enviando');
      const mudadas = await puxar();
      await esvaziar();
      // Só redesenha se algo de fato chegou — bump à toa remonta a árvore
      // inteira e faz a tela piscar.
      if (mudadas.length > 0) setVersao(v => v + 1);
      setEstado('ocioso');
    } catch {
      setEstado('erro');
    }
  }, [temSessao, esvaziar]);

  // Primeira carga: sobe o que já existe aqui antes de puxar, senão a
  // conta nova nasceria vazia e a mescla apagaria o histórico local.
  useEffect(() => {
    if (!temSessao) return;
    let vivo = true;
    (async () => {
      try {
        setEstado('enviando');
        await empurrarTudo();
        const mudadas = await puxar();
        if (!vivo) return;
        if (mudadas.length > 0) setVersao(v => v + 1);
        setEstado('ocioso');
      } catch {
        if (vivo) setEstado('erro');
      }
    })();
    return () => { vivo = false; };
  }, [temSessao]);

  // Aba volta ao foco: outro aparelho pode ter mexido enquanto isso.
  useEffect(() => {
    if (!temSessao) return;
    const aoVoltar = () => { if (document.visibilityState === 'visible') sincronizarAgora(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', sincronizarAgora);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', sincronizarAgora);
    };
  }, [temSessao, sincronizarAgora]);

  // Última tentativa ao fechar. `pagehide` e não `beforeunload`: no celular
  // a aba costuma ser descartada sem passar pelo segundo.
  useEffect(() => {
    const aoSair = () => { if (fila.current.size > 0) esvaziar(); };
    window.addEventListener('pagehide', aoSair);
    return () => window.removeEventListener('pagehide', aoSair);
  }, [esvaziar]);

  return { estado, versao, sincronizarAgora };
}
