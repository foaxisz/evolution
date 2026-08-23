interface PaginaProps {
  children: React.ReactNode;
  /** classe de largura máxima; use `max-w-none` para ocupar tudo */
  largura?: string;
  className?: string;
}

/**
 * Container padrão das páginas. O Layout não limita mais a largura —
 * cada página escolhe a sua, e uma página de desafio pode ocupar a tela
 * inteira sem brigar com o container do app.
 */
export default function Pagina({ children, largura = 'max-w-5xl', className = '' }: PaginaProps) {
  return (
    <div className={`mx-auto w-full flex-1 p-4 md:p-6 lg:p-8 ${largura} ${className}`}>
      {children}
    </div>
  );
}
