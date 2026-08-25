import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, exigirLogin, traduzirErroDeAuth } from './supabase';
import { recomecar } from './sincronizacao';

interface Autenticacao {
  /** `null` enquanto ainda não sabemos — evita piscar a tela de login. */
  sessao: Session | null;
  carregando: boolean;
  /** `false` em desenvolvimento e sem configuração: o app roda solto. */
  exigeLogin: boolean;
  email: string | null;
  entrar: (email: string, senha: string) => Promise<string | null>;
  cadastrar: (email: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
}

const Contexto = createContext<Autenticacao | null>(null);

export function ProvedorDeAutenticacao({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  // Só segura a renderização se a tela de login puder aparecer. Em
  // desenvolvimento o app não pode piscar um spinner esperando uma
  // sessão que ninguém vai usar.
  const [carregando, setCarregando] = useState(exigirLogin);

  useEffect(() => {
    if (!supabase) return;

    let vivo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setSessao(data.session);
      setCarregando(false);
    });

    // Cobre login, logout, renovação de token e troca em outra aba.
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, nova) => {
      if (!vivo) return;
      setSessao(nova);
      setCarregando(false);
    });

    return () => {
      vivo = false;
      assinatura.subscription.unsubscribe();
    };
  }, []);

  /** Devolve a mensagem de erro, ou `null` se deu certo. */
  const entrar = useCallback(async (email: string, senha: string) => {
    if (!supabase) return 'Sincronização não está configurada.';
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    return error ? traduzirErroDeAuth(error.message) : null;
  }, []);

  const cadastrar = useCallback(async (email: string, senha: string) => {
    if (!supabase) return 'Sincronização não está configurada.';
    const { error } = await supabase.auth.signUp({ email: email.trim(), password: senha });
    return error ? traduzirErroDeAuth(error.message) : null;
  }, []);

  const sair = useCallback(async () => {
    recomecar();
    await supabase?.auth.signOut();
  }, []);

  return (
    <Contexto.Provider
      value={{
        sessao,
        carregando,
        exigeLogin: exigirLogin,
        email: sessao?.user?.email ?? null,
        entrar,
        cadastrar,
        sair,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useAutenticacao(): Autenticacao {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useAutenticacao precisa estar dentro de <ProvedorDeAutenticacao>.');
  return ctx;
}
