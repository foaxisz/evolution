interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Marca do Evolution: linha ascendente com ponto de destaque no topo.
 * Fundo transparente de propósito — o favicon antigo tinha fundo quase
 * preto e desaparecia contra a barra escura do navegador.
 */
export default function Logo({ size = 26, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="Evolution"
    >
      <defs>
        <linearGradient id="evo-logo-grad" x1="4" y1="26" x2="27" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="55%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#c88cff" />
        </linearGradient>
      </defs>

      {/* rastro esmaecido — dá profundidade sem poluir em 16px */}
      <path
        d="M5 25 L12 15 L18 19 L26 7"
        stroke="url(#evo-logo-grad)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.14"
      />

      <path
        d="M5 25 L12 15 L18 19 L26 7"
        stroke="url(#evo-logo-grad)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="26" cy="7" r="4.6" fill="#c88cff" opacity="0.22" />
      <circle cx="26" cy="7" r="2.6" fill="#c88cff" />
    </svg>
  );
}
