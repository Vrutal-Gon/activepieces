import { useEffect, type RefObject } from 'react';

/** Cierra un menú/popover al pulsar fuera o Esc (y devuelve el foco al disparador). */
export function useDismiss(
  open: boolean,
  close: () => void,
  rootRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (e.target instanceof Node && !rootRef.current?.contains(e.target)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close, rootRef, triggerRef]);
}
