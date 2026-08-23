import {
  CalendarDays,
  BarChart3,
  Target,
  Trophy,
  BookOpen,
  Cookie,
  ShoppingBag,
  CheckSquare,
  Timer,
  LogOut,
} from 'lucide-react';
import type { Page } from '../../types';
import Logo from '../ui/Logo';
import { useAutenticacao } from '../../lib/auth';

interface NavItem {
  page: Page;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { page: 'today',      label: 'Hoje',               icon: <CalendarDays size={18} /> },
  { page: 'focus',      label: 'Foco',                icon: <Timer size={18} /> },
  { page: 'dashboard',  label: 'Dashboard',           icon: <BarChart3 size={18} /> },
  { page: 'habits',     label: 'Hábitos',             icon: <Target size={18} /> },
  { page: 'challenges', label: 'Desafios',            icon: <Trophy size={18} /> },
  { page: 'reviews',    label: 'Reviews',             icon: <BookOpen size={18} /> },
  { page: 'cookies',    label: 'Pote de Biscoitos',   icon: <Cookie size={18} /> },
  { page: 'shopping',   label: 'Compras',             icon: <ShoppingBag size={18} /> },
  { page: 'actions',    label: 'Ações',               icon: <CheckSquare size={18} /> },
];

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { email, sair } = useAutenticacao();

  return (
    <aside className="crt-scanlines fixed top-0 left-0 h-full w-60 bg-bg-secondary border-r border-border flex flex-col z-40">
      {/* App name */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <Logo size={26} />
        <span className="text-lg font-semibold tracking-tight text-text-primary">
          Evolution
        </span>
      </div>

      {/* Navigation */}
      <nav className="rolagem-limpa flex-1 py-3 px-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ page, label, icon }) => {
            const isActive = activePage === page;
            return (
              <li key={page}>
                <button
                  onClick={() => onNavigate(page)}
                  className={[
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-accent/15 text-accent-light'
                      : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary',
                  ].join(' ')}
                >
                  <span className={isActive ? 'text-accent-light' : 'text-text-muted'}>
                    {icon}
                  </span>
                  {label}
                  {isActive && (
                    <span className="ml-auto w-1 h-4 rounded-full bg-accent" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-5 py-4">
        {/* Sem o e-mail: o app é de uso pessoal, num aparelho só seu — ver
            o próprio endereço a cada tela não informa nada e ainda deixa
            um dado à mostra para quem olhar por cima do ombro. A condição
            continua sendo `email`, porque é ela que diz se há sessão. */}
        {email && (
          <button
            onClick={sair}
            className="mb-3 flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-danger"
          >
            <LogOut size={12} />
            Sair
          </button>
        )}
        <p className="text-xs text-text-muted">Versão 1.0.0</p>
      </div>
    </aside>
  );
}
