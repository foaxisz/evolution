import { useEffect, useState } from 'react';
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

  // `versao` sobe quando a sincronização traz dado de outro aparelho. Como
  // as páginas leem o store na montagem, remontá-las pela `key` é o jeito
  // mais simples de refletir o que chegou sem espalhar estado por todas.
  const { estado, versao } = useSincronizacao(!!sessao);

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
      <SeloDeSincronizacao estado={estado} />
    </Layout>
  );
}

/** Quanto tempo a sincronização precisa demorar para valer um aviso. */
const ESPERA_PARA_AVISAR = 900;

/**
 * Selo de sincronização.
 *
 * Só aparece quando há o que dizer, e o "enviando" ainda espera quase um
 * segundo antes de surgir: a carga normal termina em poucas centenas de
 * milissegundos, e mostrar "sincronizando" em toda atualização treinava a
 * pessoa a ignorar o aviso — aí ele não serve nem quando importa.
 *
 * Erro aparece na hora. Esse não é rotina, e esperar para avisar que algo
 * falhou é o contrário do que um aviso existe para fazer.
 */
function SeloDeSincronizacao({ estado }: { estado: EstadoDaSincronizacao }) {
  const [demorou, setDemorou] = useState(false);

  useEffect(() => {
    if (estado !== 'enviando') { setDemorou(false); return; }
    const t = setTimeout(() => setDemorou(true), ESPERA_PARA_AVISAR);
    return () => clearTimeout(t);
  }, [estado]);

  if (estado === 'ocioso' || estado === 'desligada') return null;
  if (estado === 'enviando' && !demorou) return null;

  const falhou = estado === 'erro';
  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full border px-3 py-1.5 text-[11px] md:bottom-4"
      style={{
        borderColor: falhou ? 'var(--color-danger)' : 'var(--color-border)',
        backgroundColor: 'var(--color-bg-card)',
        color: falhou ? 'var(--color-danger)' : 'var(--color-text-muted)',
      }}
    >
      {falhou ? 'Sem sincronizar — tentando de novo' : 'Sincronizando…'}
    </div>
  );
}

export default App;
