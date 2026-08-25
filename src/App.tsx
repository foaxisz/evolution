import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Page } from './types';
import { ProvedorDeAutenticacao, useAutenticacao } from './lib/auth';
import { useSincronizacao } from './lib/usarSincronizacao';
import type { EstadoDaSincronizacao } from './lib/sincronizacao';
import LoginPage from './pages/LoginPage';
import Layout from './components/layout/Layout';
import TodayPage from './pages/TodayPage';
import DashboardPage from './pages/DashboardPage';
import HabitsPage from './pages/HabitsPage';
import ChallengesPage from './pages/ChallengesPage';
import ReviewsPage from './pages/ReviewsPage';
import CookieJarPage from './pages/CookieJarPage';
import ShoppingPage from './pages/ShoppingPage';
import ActionsPage from './pages/ActionsPage';
import FocusPage from './pages/FocusPage';

function App() {
  return (
    <ProvedorDeAutenticacao>
      <Portao />
    </ProvedorDeAutenticacao>
  );
}

/**
 * Decide entre login e app.
 *
 * Sem Supabase configurado, `exigeLogin` é falso e nada muda: o app roda
 * local como sempre rodou. Assim o projeto não depende de ter `.env.local`
 * para abrir.
 */
function Portao() {
  const { sessao, carregando, exigeLogin } = useAutenticacao();

  if (carregando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-primary">
        <Loader2 size={22} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (exigeLogin && !sessao) return <LoginPage />;

  return <AppInterno />;
}

function AppInterno() {
  const [activePage, setActivePage] = useState<Page>('today');
  const { sessao } = useAutenticacao();

  const { estado, versao, motivo, sincronizarAgora } = useSincronizacao(sessao?.user.id ?? null);

  const renderPage = () => {
    switch (activePage) {
      case 'today': return <TodayPage onNavigate={setActivePage} />;
      case 'focus': return <FocusPage />;
      case 'dashboard': return <DashboardPage />;
      case 'habits': return <HabitsPage />;
      case 'challenges': return <ChallengesPage />;
      case 'reviews': return <ReviewsPage />;
      case 'cookies': return <CookieJarPage />;
      case 'shopping': return <ShoppingPage />;
      case 'actions': return <ActionsPage />;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      <div key={versao} className="contents">{renderPage()}</div>
      <SeloDeSincronizacao estado={estado} motivo={motivo} aoTentarSubir={sincronizarAgora} />
    </Layout>
  );
}

/**
 * Só aparece quando FALHA.
 *
 * Havia também um "Sincronizando…" enquanto o ciclo corria. Saiu: o ciclo
 * roda a cada gravação, então contar tarefa ou somar água piscava o aviso a
 * cada clique — e sincronização que funcionou não é notícia. O lugar de
 * saber que deu certo é o dado estar lá.
 *
 * A falha continua na tela, e com o motivo escrito. Não é enfeite: foi a
 * ausência dessa frase que deixou um 404 de tabela inexistente passar por
 * três reescritas da lógica de sincronização.
 */
function SeloDeSincronizacao({
  estado,
  motivo,
  aoTentarSubir,
}: {
  estado: EstadoDaSincronizacao;
  motivo: string | null;
  aoTentarSubir: () => void;
}) {
  if (estado !== 'erro') return null;

  const falhou = true;
  return (
    <button
      type="button"
      onClick={aoTentarSubir}
      role="status"
      title={motivo ?? undefined}
      className={`fixed bottom-20 left-1/2 z-30 max-w-[92vw] -translate-x-1/2 rounded-2xl border px-3.5 py-1.5 text-[11px] font-medium transition-transform active:scale-95 md:bottom-4 md:max-w-md ${
        falhou ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{
        borderColor: falhou ? 'var(--color-danger)' : 'var(--color-border)',
        backgroundColor: 'var(--color-bg-card)',
        color: falhou ? 'var(--color-danger)' : 'var(--color-text-muted)',
      }}
    >
      <span className="block">{motivo ?? 'Sem sincronizar'}</span>
      <span className="block opacity-70">Toque para tentar de novo</span>
    </button>
  );
}

export default App;
