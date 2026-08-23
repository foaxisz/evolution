import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger = false,
}: ConfirmDialogProps) {
  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="flex flex-col gap-4">
        {danger ? (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-danger-bg border border-danger/20">
            <AlertTriangle size={16} className="text-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-text-secondary">{message}</p>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">{message}</p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-card-hover rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              danger
                ? 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30'
                : 'bg-accent text-white hover:bg-accent-dim'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
