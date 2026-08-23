interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, message, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
        <div className="text-accent-light">{icon}</div>
      </div>
      <p className="text-base font-medium text-text-primary mb-1">{message}</p>
      {subtitle && (
        <p className="text-sm text-text-muted max-w-xs">{subtitle}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-5 py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent-dim rounded-xl transition-colors shadow-lg shadow-accent/20"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
