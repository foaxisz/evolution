import type { Page } from '../../types';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { BannerInstalarPWA } from '../ui/BotaoInstalarPWA';

interface LayoutProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

export default function Layout({ activePage, onNavigate, children }: LayoutProps) {
  return (
    <div className="min-h-dvh bg-bg-primary text-text-primary">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar activePage={activePage} onNavigate={onNavigate} />
      </div>

      {/* Main content */}
      <main
        className={[
          'flex-1 flex flex-col',
          // On desktop, offset content by sidebar width
          'md:ml-60',
          // On mobile, add bottom padding for nav bar
          'pb-16 md:pb-0',
        ].join(' ')}
      >
        <BannerInstalarPWA />
        {/* Sem container aqui: cada página define a própria largura e o
            próprio respiro. Assim uma página pode ocupar a tela inteira. */}
        {children}
      </main>

      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <MobileNav activePage={activePage} onNavigate={onNavigate} />
      </div>

      {/* A vinheta de CRT que ficava aqui saiu: ela escurecia os cantos e
          deixava o centro claro, e por cima do fundo preto de um modal isso
          virava um borrão claro no meio da tela. Um efeito global em z-200
          não tem como saber o que está embaixo dele. */}
    </div>
  );
}
