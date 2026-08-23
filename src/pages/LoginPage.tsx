import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import Logo from '../components/ui/Logo';
import { useAutenticacao } from '../lib/auth';

type Modo = 'entrar' | 'cadastrar';

/** Mínimo do Supabase. Repetido aqui para avisar antes de ir na rede. */
const MIN_SENHA = 6;

export default function LoginPage() {
  const { entrar, cadastrar } = useAutenticacao();

  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const senhaValida = senha.length >= MIN_SENHA;
  const podeEnviar = emailValido && senhaValida && !enviando;

  function trocarModo() {
    setModo(m => (m === 'entrar' ? 'cadastrar' : 'entrar'));
    setErro(null);
    setAviso(null);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;

    setEnviando(true);
    setErro(null);
    setAviso(null);

    const falha = modo === 'entrar'
      ? await entrar(email, senha)
      : await cadastrar(email, senha);

    if (falha) {
      setErro(falha);
    } else if (modo === 'cadastrar') {
      // Com confirmação de e-mail ligada no Supabase, a sessão só existe
      // depois do clique no link — sem este aviso a tela ficaria parada
      // sem explicar nada.
      setAviso('Conta criada. Se pedirmos confirmação, o link está no seu e-mail.');
    }

    setEnviando(false);
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg-primary px-5 py-10">
      {/* mesmo brilho de topo usado no resto do app */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          backgroundImage:
            'radial-gradient(55% 100% at 50% 0%, color-mix(in oklab, var(--color-accent) 13%, transparent), transparent 70%)',
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-text-primary">Evolution</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            {modo === 'entrar'
              ? 'Entre para acessar em qualquer aparelho'
              : 'Crie sua conta para começar'}
          </p>
        </div>

        <form
          onSubmit={enviar}
          className="rounded-2xl border border-border bg-bg-card p-6 shadow-2xl"
        >
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            E-mail
          </label>
          <div className="relative mb-4">
            <Mail
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErro(null); }}
              placeholder="voce@exemplo.com"
              autoComplete="email"
              autoFocus
              className="entrada pl-9"
            />
          </div>

          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Senha
          </label>
          <div className="relative">
            <Lock
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type={verSenha ? 'text' : 'password'}
              value={senha}
              onChange={e => { setSenha(e.target.value); setErro(null); }}
              placeholder={`Pelo menos ${MIN_SENHA} caracteres`}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              className="entrada pl-9 pr-11"
            />
            {/* Área de toque por PADDING, não por `.alvo-toque`.
                Aquela classe declara `position: relative`, e como ela vem
                depois das utilities do Tailwind na cascata, com a mesma
                especificidade, ela vencia o `absolute` daqui: o botão
                saía do campo e ia parar fora dele, embaixo e à esquerda.
                Com uma caixa de 36px de verdade, o alvo continua grande e
                o posicionamento não briga com ninguém. */}
            <button
              type="button"
              onClick={() => setVerSenha(v => !v)}
              aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
            >
              {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Só cobra o tamanho depois que a pessoa começou a digitar —
              avisar de cara sobre campo vazio é ruído. */}
          {senha.length > 0 && !senhaValida && (
            <p className="mt-2 text-xs text-text-muted">
              Faltam {MIN_SENHA - senha.length} caracteres.
            </p>
          )}

          {erro && (
            <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {erro}
            </p>
          )}

          {aviso && (
            <p className="mt-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
              {aviso}
            </p>
          )}

          <button
            type="submit"
            disabled={!podeEnviar}
            className="btn-grad mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {enviando && <Loader2 size={15} className="animate-spin" />}
            {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-text-secondary">
          {modo === 'entrar' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
          <button
            onClick={trocarModo}
            className="alvo-toque font-semibold text-accent-light transition-colors hover:text-accent"
          >
            {modo === 'entrar' ? 'Criar uma' : 'Entrar'}
          </button>
        </p>
      </div>
    </div>
  );
}
