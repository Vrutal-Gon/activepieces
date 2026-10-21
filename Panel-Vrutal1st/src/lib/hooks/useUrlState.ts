import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Filtros y selección viven en la URL, no en useState.
 *
 * Es la diferencia entre poder mandar a alguien «mira esto» y tener que explicarle siete
 * clics. También es lo que hace que el botón atrás y recargar devuelvan al mismo sitio:
 * antes, salvo en la lista de tareas, los dos perdían el sitio.
 */
export function useUrlState() {
  const [params, setParams] = useSearchParams();

  const get = useCallback((key: string) => params.get(key), [params]);

  /** Escribe un parámetro. Cualquier cambio que no sea de página vuelve a la página 1. */
  const set = useCallback(
    (key: string, value: string | null) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'p') next.delete('p');
        return next;
      });
    },
    [setParams],
  );

  const clear = useCallback(
    (keys: string[]) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const k of keys) next.delete(k);
        next.delete('p');
        return next;
      });
    },
    [setParams],
  );

  return { params, get, set, clear };
}

/**
 * Un campo de texto que escribe en la URL con retardo: se teclea fluido y el historial no
 * se llena con una entrada por letra (por eso el `replace`).
 */
export function useDebouncedParam(key: string, delayMs = 300) {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? '';
  const [draft, setDraft] = useState(value);

  // Si la URL cambia desde fuera (atrás, otro enlace), el campo la sigue.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const handle = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (draft.trim()) next.set(key, draft.trim());
          else next.delete(key);
          next.delete('p');
          return next;
        },
        { replace: true },
      );
    }, delayMs);
    return () => clearTimeout(handle);
  }, [draft, value, key, delayMs, setParams]);

  return [draft, setDraft, value] as const;
}
