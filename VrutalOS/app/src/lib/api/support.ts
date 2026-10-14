import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { isArrayOf, isObj, isStr } from '../guards';
import type { Guard } from '../guards';
import type { Ticket, TicketMessage } from '../types';
import { ApiError } from './client';

const isTicket: Guard<Ticket> = (v): v is Ticket =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.subject) &&
  (v.status === 'open' || v.status === 'in_progress' || v.status === 'resolved' || v.status === 'closed') &&
  (v.priority === 'low' || v.priority === 'normal' || v.priority === 'high' || v.priority === 'urgent') &&
  isStr(v.created_at) &&
  isStr(v.updated_at);

const isTicketMessage: Guard<TicketMessage> = (v): v is TicketMessage =>
  isObj(v) &&
  isStr(v.id) &&
  (v.author_kind === 'client_admin' || v.author_kind === 'staff') &&
  isStr(v.author_label) &&
  isStr(v.body) &&
  isStr(v.created_at);

async function callFunction<T>(name: string, bodyIn: Record<string, unknown>, isData: Guard<T>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: bodyIn });
  if (!error) {
    if (!isData(data)) throw new ApiError('bad_shape', `Respuesta inesperada de ${name}`);
    return data;
  }
  let message = 'No se ha podido completar la operación.';
  const response: unknown = error instanceof FunctionsHttpError ? error.context : null;
  if (response instanceof Response) {
    const errBody: unknown = await response.json().catch(() => null);
    if (isObj(errBody) && isStr(errBody.error)) message = errBody.error;
  }
  throw new ApiError('service_message', message);
}

export async function listTickets(status?: string): Promise<Ticket[]> {
  const data = await callFunction(
    'support-ticket-list',
    { status },
    (v): v is { tickets: Ticket[] } => isObj(v) && isArrayOf(isTicket)(v.tickets),
  );
  return data.tickets;
}

export async function getTicketThread(ticketId: string): Promise<TicketMessage[]> {
  const data = await callFunction(
    'support-ticket-list',
    { ticket_id: ticketId },
    (v): v is { messages: TicketMessage[] } => isObj(v) && isArrayOf(isTicketMessage)(v.messages),
  );
  return data.messages;
}

export async function createTicket(subject: string, body: string, priority: string): Promise<string> {
  const data = await callFunction(
    'support-ticket-send',
    { subject, body, priority },
    (v): v is { id: string } => isObj(v) && isStr(v.id),
  );
  return data.id;
}

export async function replyTicket(ticketId: string, body: string): Promise<void> {
  await callFunction('support-ticket-send', { ticket_id: ticketId, body }, (v): v is Record<string, never> => isObj(v));
}
