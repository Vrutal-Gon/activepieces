import { useCallback, useRef, useState } from 'react';
import { useDismiss } from '../lib/hooks/useDismiss';

// Las notificaciones nacerán del latido de los VPS (errores, aprobaciones bloqueadas…).
// Hasta entonces el menú existe con su diseño y lo dice.
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, rootRef, triggerRef);

  return (
    <div className="popover" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-button"
        aria-label="Notificaciones"
        aria-expanded={open}
        aria-controls="notifications-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 20a2 2 0 0 0 4 0" />
        </svg>
      </button>
      {open && (
        <div id="notifications-panel" className="popover__panel">
          <p className="popover__title">Notificaciones</p>
          <p className="popover__empty">
            Sin notificaciones. Se activarán con el latido de los VPS: flujos con error, VPS sin respuesta y
            aprobaciones bloqueadas.
          </p>
        </div>
      )}
    </div>
  );
}
