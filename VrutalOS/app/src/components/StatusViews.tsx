import { errorMessage } from '../lib/api/client';

export function LoadingState() {
  return (
    <p className="loading-state" role="status">
      Cargando…
    </p>
  );
}

interface ErrorNoticeProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorNotice({ error, onRetry }: ErrorNoticeProps) {
  return (
    <div className="notice notice--error error-notice" role="alert">
      <span>{errorMessage(error)}</span>
      {onRetry && (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
