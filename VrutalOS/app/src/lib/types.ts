export type ProfileRole = 'client_admin' | 'client_marketing_admin' | 'client_user';

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

// ── Scope de negocio (lo completa el Admin de Marketing; los flujos lo leen) ──────────────
/** Origen de una fila: lo que empuja Vrutal desde su auditoría o lo que añade el cliente. */
export type MktSource = 'vrutal' | 'cliente';

/** Bloques de campo/valor. La lista de campos la define Vrutal (`mkt_input_field`). */
export type MktInputKey = 'icp' | 'brand_voice' | 'strategy';

export interface MktInputField {
  input_key: MktInputKey;
  field_key: string;
  label: string;
  /** Si es true, el campo admite varias filas (p. ej. `dolor`); si no, una sola. */
  multi: boolean;
  position: number;
  help: string | null;
}

export interface MktInputValue {
  id: string;
  input_key: MktInputKey;
  field_key: string;
  value: string;
  source: MktSource;
  position: number;
}

export type MktChannel = 'seo' | 'sem' | 'email' | 'linkedin' | 'social' | 'web' | 'other';
export type MktPeriod = 'semanal' | 'mensual' | 'trimestral';

export interface MktChannelTarget {
  id: string;
  channel: MktChannel;
  metric: string;
  target: string;
  period: MktPeriod | null;
  source: MktSource;
}

export interface MktCompetitor {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  priority: number;
  source: MktSource;
}

export interface MktFocusProduct {
  id: string;
  name: string;
  description: string | null;
  price_note: string | null;
  priority: number;
  status: 'activo' | 'pausado';
  source: MktSource;
}

/**
 * Estrategia SEM: lista cerrada de objetivos PPC genéricos, no texto libre. Sustituye al campo
 * `strategy.foco_sem` (cambio 2026-10-20_mkt_sem_strategy.sql). Aquí no hay métrica a propósito:
 * la métrica y el número viven en `mkt_channel_target`.
 */
export type MktSemObjective =
  | 'crecimiento_marca'
  | 'generar_leads'
  | 'incrementar_roi'
  | 'incrementar_ctr'
  | 'reducir_cac'
  | 'empuje_producto';

export type MktSemStatus = 'planificada' | 'activa' | 'pausada';
export type MktCurrency = 'EUR' | 'USD' | 'GBP';

export interface MktSemStrategy {
  id: string;
  objective: MktSemObjective;
  /** Vigencia, en ISO (AAAA-MM-DD). `ends_on` nulo = abierta. */
  starts_on: string;
  ends_on: string | null;
  budget_monthly: number | null;
  currency: MktCurrency;
  /** Obligatorio cuando el objetivo es `empuje_producto` (lo exige un check en la base). */
  focus_product_id: string | null;
  geo: string | null;
  landing_url: string | null;
  status: MktSemStatus;
  notes: string | null;
  source: MktSource;
}

// ── Tablero (espejo de Kaneo) ───────────────────────────────────────────────
/** Las columnas las define Kaneo; el `status` de una tarjeta es el `slug` de su columna. */
export interface BoardColumn {
  slug: string;
  name: string;
  position: number;
  is_final: boolean;
}

export type BoardPriority = 'no-priority' | 'low' | 'medium' | 'high' | 'urgent';
/** `cliente` = la pidió alguien del cliente desde esta pantalla. */
export type BoardOrigin = 'vrutal' | 'cliente';

export interface BoardCard {
  id: string;
  project_id: string;
  /** De qué agente es la tarjeta: el tablero los muestra todos juntos. */
  specialist_id: string;
  /** Se enseña como <slug del proyecto>-<number>, p. ej. MKT-12. */
  number: number | null;
  title: string;
  description: string | null;
  status: string;
  priority: BoardPriority | null;
  /** Un nombre, nunca un correo: el cliente no recibe el directorio del equipo de Vrutal. */
  assignee_name: string | null;
  labels: string[];
  due_date: string | null;
  position: number | null;
  origin: BoardOrigin;
}

export interface BoardComment {
  id: string;
  author_name: string;
  body: string;
  kaneo_created_at: string | null;
}

export interface Board {
  /** Prefijo de la referencia corta, por proyecto. */
  projectSlug: Record<string, string>;
  /** Agentes que de verdad tienen tablero. A los demás no se les puede pedir una tarea. */
  withBoard: string[];
  columns: BoardColumn[];
  cards: BoardCard[];
}
