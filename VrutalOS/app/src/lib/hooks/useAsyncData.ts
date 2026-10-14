import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: T };

/** `load` debe ser estable (useCallback) o el efecto se repetirá en cada render. */
export function useAsyncData<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).then(
      (data) => {
        if (!ctrl.signal.aborted) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (!ctrl.signal.aborted) setState({ status: 'error', error });
      },
    );
    return () => ctrl.abort();
  }, [load, nonce]);

  /** Vuelve a cargar mostrando "Cargando…" (p. ej. tras un error). */
  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setNonce((n) => n + 1);
  }, []);

  /** Vuelve a cargar manteniendo los datos en pantalla hasta que llegan los nuevos (tras guardar). */
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { state, reload, refresh };
}
