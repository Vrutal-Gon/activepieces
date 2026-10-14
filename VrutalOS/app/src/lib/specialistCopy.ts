// Cómo se explica a un cliente lo que son los especialistas. Sin jerga de IT; una frase, una idea.

export const PHASE_LABEL: Record<string, string> = {
  '01_AUDIT': 'En auditoría',
  '02_PILOT': 'En piloto',
  '03_LIMITED': 'Autonomía limitada',
  '04_SUPERVISED': 'Supervisado',
  '05_LIVE': 'En producción',
};

export const PHASE_HINT: Record<string, string> = {
  '01_AUDIT': 'Observa cómo trabajáis y propone. No cambia nada.',
  '02_PILOT': 'Prueba con casos reales, con vuestra revisión.',
  '03_LIMITED': 'Actúa solo en lo acordado y avisa del resto.',
  '04_SUPERVISED': 'Trabaja con normalidad y vosotros supervisáis.',
  '05_LIVE': 'Trabaja con normalidad.',
};

/** Hasta dónde puede llegar el especialista. */
export const AUTONOMY_LABEL: Record<string, string> = {
  read_only: 'Solo leer',
  draft_for_approval: 'Propone y tú apruebas',
  auto_low_risk: 'Actúa solo en lo de bajo riesgo',
  full_autonomy: 'Actúa con total autonomía',
};

export const STATUS_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | '' }> = {
  active: { label: 'Activo', tone: 'ok' },
  paused: { label: 'En pausa', tone: 'warn' },
  retired: { label: 'Retirado', tone: '' },
};

/** Siglas para el avatar: «Data Entry Clerk» → «DE». */
export function specialistInitials(name: string): string {
  const letters = name.split(/\s+/).filter(Boolean).map((w) => w[0]);
  return (letters.slice(0, 2).join('') || '?').toUpperCase();
}

/** Etiqueta tolerante: si el servidor trae un valor nuevo que aún no conocemos, se muestra tal cual. */
export const labelOf = (map: Record<string, string>, key: string) => map[key] ?? key;
