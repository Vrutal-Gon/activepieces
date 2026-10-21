const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

/** «5 oct 2026». Devuelve «—» si no hay fecha o no es válida. */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : DATE.format(d);
}

const USD = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' });
const INT = new Intl.NumberFormat('es-ES');
const COMPACT = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });

/** El coste se registra en dólares (run_log.cost_usd): se muestra tal cual, sin convertir. */
export const formatUsd = (n: number) => USD.format(n);
export const formatInt = (n: number) => INT.format(n);
/** «1,9 M» para cifras grandes de tokens; las pequeñas salen enteras. */
export const formatCompact = (n: number) => (n < 10_000 ? INT.format(n) : COMPACT.format(n));

const DATE_TIME = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** «5 oct, 14:32». */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : DATE_TIME.format(d);
}

const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * «20 oct 2026» a partir de una columna `date` (ISO sin hora). No usa `new Date()` a propósito:
 * `new Date('2026-10-20')` se interpreta en UTC y en un huso negativo devuelve el día anterior.
 * Si la cadena no tiene forma de fecha se devuelve tal cual: nunca se inventa una.
 */
export function formatDateOnly(iso: string | null): string {
  if (!iso) return '';
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!t) return iso;
  return `${Number(t[3])} ${MESES_CORTO[Number(t[2]) - 1]} ${t[1]}`;
}
