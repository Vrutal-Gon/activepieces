export type ProfileRole = 'client_admin' | 'client_manager' | 'client_user';

export interface Profile {
  id: string;
  full_name: string | null;
  role: ProfileRole;
  is_active: boolean;
}

export interface TeamMember extends Profile {
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export type IntegrationStatus = 'active' | 'paused' | 'revoked';

export interface Integration {
  id: string;
  integration_type: string;
  provider: string;
  status: IntegrationStatus;
  validated_at: string | null;
  last_error: string | null;
  created_at: string;
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Ticket {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  author_kind: 'client_admin' | 'staff';
  author_label: string;
  body: string;
  created_at: string;
}

export interface UsageRow {
  specialist_id: string;
  runs: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  specialist_id: string;
  task_key: string | null;
  /** Lo que el especialista quiere hacer. Contenido libre: se muestra como texto, nunca como HTML. */
  payload: unknown;
  status: ApprovalStatus;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  assigned_to: string | null;
}

export type WorkColumnType = 'text' | 'number' | 'date' | 'badge' | 'url';

/** Cómo se dibuja una columna de una pestaña. La describe Vrutal al definir la colección. */
export interface WorkColumn {
  key: string;
  label: string;
  type: WorkColumnType;
}

/** Una pestaña de un especialista, con cuántas filas hay en cada estado. */
export interface WorkCollection {
  id: string;
  specialist_id: string;
  collection_key: string;
  label: string;
  approvable: boolean;
  columns: WorkColumn[];
  proposed: number;
  approved: number;
  rejected: number;
  delivered: number;
}

export type WorkStatus = 'proposed' | 'approved' | 'rejected' | 'delivered';

export interface WorkItem {
  id: string;
  /** Contenido libre de la fila: claves = `key` de las columnas. Se muestra siempre como texto. */
  data: Record<string, unknown>;
  status: WorkStatus;
  created_at: string;
  decided_at: string | null;
}

export interface Specialist {
  id: string;
  display_name: string;
  job_role_key: string;
  phase: string;
  autonomy_level: string;
  status: string;
}
