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
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { Page } from '../../types';
import Logo from '../ui/Logo';
import { useAutenticacao } from '../../lib/auth';
import BotaoInstalarPWA from '../ui/BotaoInstalarPWA';

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
  recolhida: boolean;
  onAlternarRecolhida: () => void;
}

/**
 * A navegação do desktop, em dois tamanhos.
 *
 * Recolhida ela vira uma régua de ícones, e não desaparece: esconder por
 * completo tiraria a navegação inteira e exigiria um botão flutuante para
 * trazê-la de volta. Encolher largura também é uma animação contínua —
 * sumir seria estalo.
 *
 * Os rótulos saem por opacidade E são cortados pelo `overflow-hidden` do
 * `aside`. Só opacidade deixaria o texto invisível ocupando lugar; só o
 * corte faria a palavra ser fatiada letra por letra durante a animação.
 */
export default function Sidebar({
  activePage, onNavigate, recolhida, onAlternarRecolhida,
}: SidebarProps) {
  const { email, sair } = useAutenticacao();

  return (
    <aside
      className={[
        'crt-scanlines fixed top-0 left-0 z-40 flex h-full flex-col overflow-hidden',
        'border-r border-border bg-bg-secondary',
        'transition-[width] duration-200 ease-out',
        recolhida ? 'w-14' : 'w-60',
      ].join(' ')}
    >
      {/* Cabeçalho: uma linha só nos dois estados, para a altura não pular.
          Recolhida, o que fica é o botão — entre marca e controle, o
          controle é o que se precisa alcançar. */}
      <div
        className={[
          'flex h-[66px] flex-shrink-0 items-center border-b border-border',
          recolhida ? 'justify-center px-2' : 'gap-2.5 px-5',
        ].join(' ')}
      >
        {!recolhida && (
          <>
            <Logo size={26} />
            <span className="flex-1 whitespace-nowrap text-lg font-semibold tracking-tight text-text-primary">
              Evolution
            </span>
          </>
        )}
        <button
          onClick={onAlternarRecolhida}
          aria-label={recolhida ? 'Expandir a barra' : 'Recolher a barra'}
          title={recolhida ? 'Expandir a barra' : 'Recolher a barra'}
          className="flex-shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
        >
          {recolhida ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`rolagem-limpa flex-1 py-3 ${recolhida ? 'px-2' : 'px-3'}`}>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ page, label, icon }) => {
            const isActive = activePage === page;
            return (
              <li key={page}>
                <button
                  onClick={() => onNavigate(page)}
                  title={recolhida ? label : undefined}
                  className={[
                    'flex w-full items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-150',
                    recolhida ? 'justify-center px-0' : 'gap-3 px-3',
                    isActive
                      ? 'bg-accent/15 text-accent-light'
                      : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary',
                  ].join(' ')}
                >
                  <span className={`flex-shrink-0 ${isActive ? 'text-accent-light' : 'text-text-muted'}`}>
                    {icon}
                  </span>
                  {!recolhida && (
                    <>
                      <span className="whitespace-nowrap">{label}</span>
                      {isActive && (
                        <span className="ml-auto h-4 w-1 flex-shrink-0 rounded-full bg-accent" />
                      )}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className={[
          'flex-shrink-0 border-t border-border py-4',
          recolhida ? 'px-2' : 'space-y-2.5 px-5',
        ].join(' ')}
      >
        {recolhida ? (
          // Régua: sobra o "Sair", que é o único aqui sem substituto em
          // outro lugar. Instalar o app e ver o e-mail esperam a barra
          // aberta — nenhum dos dois é gesto de pressa.
          email && (
            <button
              onClick={sair}
              aria-label="Sair"
              title={`Sair (${email})`}
              className="flex w-full items-center justify-center rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-danger"
            >
              <LogOut size={16} />
            </button>
          )
        ) : (
          <>
            <BotaoInstalarPWA />
            {/* E-mail e "Sair" na MESMA linha, o e-mail truncando e o botão sem
                encolher.

                Eram duas linhas, e o botão carregava um `ml-auto` que o jogava
                para a direita — ele existia para separá-lo do "Resincronizar" que
                ficava à esquerda. Com aquele removido, sobrou um botão solto no
                canto direito debaixo de um e-mail alinhado à esquerda, sem nada
                explicando o vão entre os dois. */}
            {email && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="min-w-0 flex-1 truncate text-[11px] text-text-muted" title={email}>{email}</p>
                <button
                  onClick={sair}
                  className="flex flex-shrink-0 items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-danger"
                >
                  <LogOut size={12} />
                  Sair
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
