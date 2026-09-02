import { useState } from 'react';
import type { Page } from '../../types';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

interface LayoutProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

/**
 * Preferência de APARELHO, não de conta — por isso `localStorage` cru e
 * fora de `CHAVES_SINCRONIZADAS`. Recolher a barra no monitor grande não
 * deveria recolhê-la no notebook, do mesmo jeito que a sub-aba do Pote
 * não viaja entre aparelhos.
 */
const CHAVE = 'evo_sidebar_recolhida';

export default function Layout({ activePage, onNavigate, children }: LayoutProps) {
  const [recolhida, setRecolhida] = useState(
    () => localStorage.getItem(CHAVE) === '1'
  );

  function alternar() {
    setRecolhida(v => {
      localStorage.setItem(CHAVE, v ? '0' : '1');
      return !v;
    });
  }

  return (
    <div className="min-h-dvh bg-bg-primary text-text-primary">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar
          activePage={activePage}
          onNavigate={onNavigate}
          recolhida={recolhida}
          onAlternarRecolhida={alternar}
        />
      </div>

      {/* Main content */}
      <main
        className={[
          'flex-1 flex flex-col',
          // On desktop, offset content by sidebar width — e a margem anda
          // junto com a largura dela, senão o conteúdo salta enquanto a
          // barra desliza.
          'transition-[margin] duration-200 ease-out',
          recolhida ? 'md:ml-14' : 'md:ml-60',
          // On mobile, add bottom padding for nav bar
          'pb-16 md:pb-0',
        ].join(' ')}
      >
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
