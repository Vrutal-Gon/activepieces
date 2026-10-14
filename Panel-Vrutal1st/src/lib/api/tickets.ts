import type { StaffTicketMessage, StaffTicketRow } from '../types';
import { isArrayOf, isObj, isStr, isStrOrNull, isVoid } from '../guards';
import { rpc } from './client';

// Tickets de soporte. Toda RPC comprueba en servidor staff_can_access_tenant (cartera) —
// ver db/migrations/023_vrutal_support_tickets.sql.

const TICKET_STATUSES: readonly string[] = ['open', 'in_progress', 'resolved', 'closed'];
const TICKET_PRIORITIES: readonly string[] = ['low', 'normal', 'high', 'urgent'];

const isTicketRow = (v: unknown): v is StaffTicketRow =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.tenant_id) &&
  isStr(v.tenant_name) &&
  isStr(v.subject) &&
  isStr(v.status) &&
  TICKET_STATUSES.includes(v.status) &&
  isStr(v.priority) &&
  TICKET_PRIORITIES.includes(v.priority) &&
  isStr(v.created_by_label) &&
  isStrOrNull(v.assigned_to) &&
  isStrOrNull(v.assigned_to_name) &&
  isStr(v.created_at) &&
  isStr(v.updated_at) &&
  isStrOrNull(v.closed_at);

const isTicketMessage = (v: unknown): v is StaffTicketMessage =>
  isObj(v) &&
  isStr(v.id) &&
  (v.author_kind === 'client_admin' || v.author_kind === 'staff') &&
  isStr(v.author_label) &&
  isStr(v.body) &&
  isStr(v.created_at);

/** Cola global (sin tenantId) o la pestaña de un cliente (con tenantId). */
export function listTickets(tenantId: string | null, status: string | null, signal?: AbortSignal) {
  return rpc('staff_list_tickets', { p_tenant_id: tenantId, p_status: status }, isArrayOf(isTicketRow), signal);
}

export function listTicketMessages(ticketId: string, signal?: AbortSignal) {
  return rpc('staff_list_ticket_messages', { p_ticket_id: ticketId }, isArrayOf(isTicketMessage), signal);
}

export function replyTicket(ticketId: string, body: string) {
  return rpc('staff_reply_ticket', { p_ticket_id: ticketId, p_body: body }, isStr);
}

export function setTicketStatus(ticketId: string, status: string) {
  return rpc('staff_set_ticket_status', { p_ticket_id: ticketId, p_status: status }, isVoid);
}
