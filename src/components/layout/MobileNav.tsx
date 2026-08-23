import { useState } from 'react';
import {
  CalendarDays, BarChart3, Target, Trophy,
  BookOpen, Cookie, ShoppingBag, CheckSquare,
  MoreHorizontal, X, LogOut, Timer,
} from 'lucide-react';
import type { Page } from '../../types';
import { useAutenticacao } from '../../lib/auth';

interface NavItem {
  page: Page;
  label: string;
  icon: React.ReactNode;
}

// Cinco slots na barra de baixo (quatro + "Mais"); mais que isso e o
// rótulo de 10px não cabe em 375px. Como o número é fixo, incluir uma
// página aqui sempre significa mandar outra para "Mais".
const PRINCIPAIS: NavItem[] = [
  { page: 'today',      label: 'Hoje',      icon: <CalendarDays size={22} /> },
  { page: 'reviews',    label: 'Reviews',   icon: <BookOpen size={22} /> },
  { page: 'habits',     label: 'Hábitos',   icon: <Target size={22} /> },
  { page: 'dashboard',  label: 'Dashboard', icon: <BarChart3 size={22} /> },
];

// Foco abre o primeiro item da gaveta por ser o mais usado dos que ficaram
// de fora — quem desce da barra principal não deve cair no fim da lista.
const OUTRAS: NavItem[] = [
  { page: 'focus',      label: 'Foco',             icon: <Timer size={20} /> },
  { page: 'challenges', label: 'Desafios',         icon: <Trophy size={20} /> },
  { page: 'cookies',    label: 'Pote de Biscoitos', icon: <Cookie size={20} /> },
  { page: 'shopping',   label: 'Compras',           icon: <ShoppingBag size={20} /> },
  { page: 'actions',    label: 'Ações',             icon: <CheckSquare size={20} /> },
];

interface MobileNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export default function MobileNav({ activePage, onNavigate }: MobileNavProps) {
  const [maisAberto, setMaisAberto] = useState(false);
  const maisAtivo = OUTRAS.some(i => i.page === activePage);
  const { email, sair } = useAutenticacao();

  function ir(page: Page) {
    onNavigate(page);
    setMaisAberto(false);
  }

  return (
    <>
      {/* Backdrop e gaveta ficam sempre montados e animam por opacidade e
          transform — antes apareciam/sumiam de um frame pro outro. */}
      <div
        onClick={() => setMaisAberto(false)}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 md:hidden ${
          maisAberto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        className={`fixed bottom-16 left-0 right-0 z-50 mx-3 mb-2 overflow-hidden rounded-2xl border border-border bg-bg-card shadow-xl transition-[opacity,transform] duration-200 ease-out md:hidden ${
          maisAberto
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium text-text-secondary">Mais páginas</span>
            <button
              onClick={() => setMaisAberto(false)}
              aria-label="Fechar"
              className="alvo-toque text-text-muted transition-colors hover:text-text-primary"
            >
              <X size={18} />
            </button>
          </div>
          <ul className="py-2">
            {OUTRAS.map(({ page, label, icon }) => {
              const ativo = activePage === page;
              return (
                <li key={page}>
                  <button
                    onClick={() => ir(page)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                      ativo
                        ? 'bg-accent/10 text-accent-light'
                        : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                    }`}
                  >
                    <span className={ativo ? 'text-accent-light' : 'text-text-muted'}>{icon}</span>
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Só o botão. O e-mail saiu junto com o da barra lateral. */}
          {email && (
            <div className="border-t border-border px-4 py-3">
              <button
                onClick={() => { setMaisAberto(false); sair(); }}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-danger"
              >
                <LogOut size={13} />
                Sair
              </button>
            </div>
          )}
      </div>

      <nav className="crt-scanlines fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-bg-secondary md:hidden">
        <ul className="flex items-center">
          {PRINCIPAIS.map(({ page, label, icon }) => {
            const ativo = activePage === page;
            return (
              <li key={page} className="flex-1">
                <button
                  onClick={() => ir(page)}
                  className={`flex w-full flex-col items-center justify-center gap-1 py-3 transition-colors ${
                    ativo ? 'text-accent-light' : 'text-text-muted'
                  }`}
                >
                  {icon}
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </button>
              </li>
            );
          })}

          <li className="flex-1">
            <button
              onClick={() => setMaisAberto(v => !v)}
              className={`flex w-full flex-col items-center justify-center gap-1 py-3 transition-colors ${
                maisAtivo || maisAberto ? 'text-accent-light' : 'text-text-muted'
              }`}
            >
              <MoreHorizontal size={22} />
              <span className="text-[10px] font-medium leading-none">Mais</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
