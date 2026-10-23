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

/** Cuántos tonos hay para distinguir agentes en el tablero. */
export const AGENT_TONES = 6;

/**
 * Tono estable de un agente, derivado de su `job_role_key`. Estable a propósito: si se
 * derivara de la posición en la lista, contratar un especialista nuevo le cambiaría el color a
 * todos los demás, y el color es justo lo que permite reconocerlos sin leer.
 */
export function agentTone(jobRoleKey: string): number {
  let h = 0;
  for (const ch of jobRoleKey) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h % AGENT_TONES;
}
