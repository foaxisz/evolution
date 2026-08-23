import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente do Supabase.
 *
 * O app precisa continuar de pé sem configuração nenhuma: enquanto as
 * variáveis não existirem, `supabase` é `null` e a interface segue no
 * modo local, sem tela de login. Sem isso, quem clonasse o repositório
 * sem `.env.local` só veria erro.
 *
 * A chave publishable aparece no JavaScript que o navegador baixa — isso
 * é esperado e não é vazamento. Quem protege os dados é a Row Level
 * Security no banco, não o sigilo da chave.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && chave);

/**
 * Se a tela de login aparece.
 *
 * Em desenvolvimento fica fora do caminho: `npm run dev` abre direto no
 * app, sem pedir nada. Ela entra sozinha no build de produção — ou seja,
 * quando o app for publicado.
 *
 * Para conferir a tela sem publicar, ponha no `.env.local`:
 *   VITE_EXIGIR_LOGIN=true
 */
export const exigirLogin =
  supabaseConfigurado &&
  (import.meta.env.PROD || import.meta.env.VITE_EXIGIR_LOGIN === 'true');

export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(url!, chave!, {
      auth: {
        // Mantém a sessão no localStorage e renova o token sozinho, para
        // não pedir login a cada abertura.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Mensagens do Supabase vêm em inglês e técnicas demais para a tela. */
export function traduzirErroDeAuth(mensagem: string): string {
  const m = mensagem.toLowerCase();

  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme o e-mail pelo link que enviamos antes de entrar.';
  if (m.includes('user already registered')) return 'Já existe uma conta com este e-mail. Tente entrar.';
  if (m.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'E-mail inválido.';
  if (m.includes('email rate limit') || m.includes('too many requests')) {
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  }
  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return 'Sem conexão com o servidor. Verifique a internet.';
  }

  return mensagem;
}
