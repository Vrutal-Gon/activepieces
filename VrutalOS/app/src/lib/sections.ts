// Secciones del diseño aprobado (VrutalOS/diseno) que aún no se han construido.
// Se van quitando de aquí a medida que tienen su pantalla.
export interface PendingSection {
  path: string;
  adminOnly: boolean;
  eyebrow: string;
  title: string;
  source: string;
}

export const PENDING_SECTIONS: PendingSection[] = [
  { path: '', adminOnly: false, eyebrow: 'Mi trabajo', title: 'Inicio', source: 'approval_requests, conversations, specialists, report_output' },
  { path: 'conversaciones', adminOnly: false, eyebrow: 'Mi trabajo', title: 'Conversaciones', source: 'conversations, conversation_participants, messages' },
  { path: 'reportes', adminOnly: false, eyebrow: 'Mi trabajo', title: 'Reportes', source: 'report_output, user_report_subscription (nunca el catálogo de Vrutal)' },
  { path: 'admin', adminOnly: true, eyebrow: 'Administración', title: 'Resumen de la empresa', source: 'integrations, run_log, approval_requests, profiles' },
  { path: 'admin/personalizacion', adminOnly: true, eyebrow: 'Administración', title: 'Personalización', source: 'sin tabla: specialist_prompts no existe en el esquema' },
  { path: 'admin/delegaciones', adminOnly: true, eyebrow: 'Administración', title: 'Delegaciones', source: 'approval_delegation' },
  { path: 'admin/auditoria', adminOnly: true, eyebrow: 'Administración', title: 'Auditoría', source: 'audit_log' },
];
