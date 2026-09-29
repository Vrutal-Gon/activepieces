/** Fecha corta de la marca: 12·03·2026 (se muestra en mono). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}·${mm}·${d.getFullYear()}`;
}
