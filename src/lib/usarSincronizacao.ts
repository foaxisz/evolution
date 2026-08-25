import { useCallback, useEffect, useRef, useState } from 'react';
import { observarGravacoes } from '../store';
import { supabase } from './supabase';
import {
  anotarGravacao, empurrar, executarCiclo, assinarMudancas, diagnosticar,
  type EstadoDaSincronizacao,
} from './sincronizacao';

/**
 * Espera antes de enviar.
 */
const ESPERA_MS = 250;

/**
 * De quanto em quanto tempo perguntar ao servidor, com a tela à vista.
 */
const VIGIA_MS = 8_000;

/**
 * Liga a sincronização ao ciclo de vida do app.
 */
export function useSincronizacao(usuarioId: string | null) {
  const [estado, setEstado] = useState<EstadoDaSincronizacao>(
    supabase ? 'ocioso' : 'desligada'
  );
  const [versao, setVersao] = useState(0);
  const [motivo, setMotivo] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rodando = useRef(false);
  const denovo = useRef(false);

  /**
   * Um ciclo unificado (v3): ENVIAR pendentes locais -> PUXAR remotas -> RECONCILIAR.
   */
  const ciclo = useCallback(async () => {
    if (!usuarioId) return;
    if (rodando.current) { denovo.current = true; return; }

    rodando.current = true;
    try {
      setEstado('enviando');
      const mudadas = await executarCiclo();

      if (mudadas.length > 0) setVersao(v => v + 1);
      setMotivo(null);
      setEstado('ocioso');
    } catch (e) {
      console.error('[evo sync]', e);
      setMotivo(diagnosticar(e));
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
    ciclo();
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

  return { estado, versao, motivo, sincronizarAgora };
}
