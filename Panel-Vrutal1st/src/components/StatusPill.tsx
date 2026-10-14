// Estados del catálogo (roles, versiones, composiciones, madurez) como pastilla: punto + texto.
const TONE: Record<string, string> = {
  active: 'pill--ok',
  validated: 'pill--ok',
  production: 'pill--ok',
  draft: 'pill--warn',
  tested: 'pill--warn',
  prototype: 'pill--pending',
};

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${TONE[status] ?? ''}`}>{status}</span>;
}
