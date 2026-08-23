import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface StatDeltaProps {
  rotulo: string;
  valor: string | number;
  /** variação vs período anterior; ausente = não mostra seta */
  delta?: number;
  /** sufixo do delta: '%' ou 'pp' (pontos percentuais) */
  sufixoDelta?: string;
  /** quando true, delta negativo é bom (ex: dias perdidos) */
  inverterCores?: boolean;
  contexto?: string;
}

export default function StatDelta({
  rotulo, valor, delta, sufixoDelta = '', inverterCores, contexto,
}: StatDeltaProps) {
  const neutro = delta === undefined || Math.abs(delta) < 0.5;
  const positivo = inverterCores ? (delta ?? 0) < 0 : (delta ?? 0) > 0;

  const cor = neutro
    ? 'var(--color-text-muted)'
    : positivo
    ? 'var(--color-success)'
    : 'var(--color-danger)';

  const Icone = neutro ? Minus : (delta ?? 0) > 0 ? ArrowUp : ArrowDown;

  return (
    <div>
      <p className="text-xs text-text-muted">{rotulo}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums text-text-primary">{valor}</span>
        {delta !== undefined && (
          <span className="flex items-center gap-0.5 text-xs font-semibold tabular-nums" style={{ color: cor }}>
            <Icone size={12} strokeWidth={3} />
            {neutro ? '—' : `${Math.abs(delta).toFixed(0)}${sufixoDelta}`}
          </span>
        )}
      </div>
      {contexto && <p className="mt-0.5 text-[11px] text-text-muted">{contexto}</p>}
    </div>
  );
}
