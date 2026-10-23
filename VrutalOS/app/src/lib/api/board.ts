import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { isNumOrNull, isObj, isStr, isStrArray, isStrOrNull } from '../guards';
import type { Board, BoardCard, BoardColumn, BoardComment, BoardOrigin, BoardPriority } from '../types';
import { ApiError } from './client';

// El tablero que se lee aquí es un ESPEJO de Kaneo, la herramienta donde el equipo de Vrutal
// gestiona el trabajo. El cliente nunca ve esa interfaz (mismo criterio que con Postiz): ve
// estas tablas, que solo puede LEER — escribir va por la Edge Function `board-write`.

const PRIORIDADES: BoardPriority[] = ['no-priority', 'low', 'medium', 'high', 'urgent'];

function toColumn(v: unknown): BoardColumn | null {
  if (!isObj(v) || !isStr(v.slug) || !isStr(v.name) || typeof v.position !== 'number') return null;
  return { slug: v.slug, name: v.name, position: v.position, is_final: v.is_final === true };
}

function toCard(v: unknown): BoardCard | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.project_id) || !isStr(v.specialist_id)) return null;
  if (!isStr(v.title) || !isStr(v.status)) return null;
  if (!isNumOrNull(v.number ?? null) || !isStrOrNull(v.description ?? null)) return null;
  return {
    id: v.id,
    project_id: v.project_id,
    specialist_id: v.specialist_id,
    number: isNumOrNull(v.number) ? v.number : null,
    title: v.title,
    description: isStrOrNull(v.description) ? v.description : null,
    status: v.status,
    priority: PRIORIDADES.find((p) => p === v.priority) ?? null,
    assignee_name: isStrOrNull(v.assignee_name) ? v.assignee_name : null,
    labels: isStrArray(v.labels) ? v.labels : [],
    due_date: isStrOrNull(v.due_date) ? v.due_date : null,
    position: isNumOrNull(v.position) ? v.position : null,
    origin: (v.origin === 'cliente' ? 'cliente' : 'vrutal') as BoardOrigin,
  };
}

function toComment(v: unknown): BoardComment | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.author_name) || !isStr(v.body)) return null;
  return {
    id: v.id,
    author_name: v.author_name,
    body: v.body,
    kaneo_created_at: isStrOrNull(v.kaneo_created_at) ? v.kaneo_created_at : null,
  };
}

/**
 * El tablero: las columnas y las tarjetas de TODOS los agentes que esta persona puede ver.
 *
 * Se cargan juntos a propósito (decisión 2026-10-23): el cliente quiere ver de un vistazo en qué
 * anda su equipo entero, y el agente es un filtro de la pantalla, no una pantalla distinta.
 *
 * Qué se ve lo decide el servidor (`can_access_specialist`), no esta consulta. Sin ningún
 * proyecto dado de alta devuelve un tablero vacío, que no es un error: es que todavía no hay.
 */
export async function listBoard(specialistIds: string[], signal: AbortSignal): Promise<Board> {
  if (specialistIds.length === 0) return { projectSlug: {}, withBoard: [], columns: [], cards: [] };

  const { data: proyectos, error: errorProyectos } = await supabase
    .from('board_project')
    .select('id, slug, position, specialist_id')
    .in('specialist_id', specialistIds)
    .order('position')
    .abortSignal(signal);
  if (errorProyectos) throw new ApiError(errorProyectos.code, errorProyectos.message);

  const filas = proyectos ?? [];
  if (!filas.every((p) => isObj(p) && isStr(p.id) && isStr(p.slug) && isStr(p.specialist_id))) {
    throw new ApiError('bad_shape', 'Respuesta inesperada de board_project');
  }
  if (filas.length === 0) return { projectSlug: {}, withBoard: [], columns: [], cards: [] };

  const ids = filas.map((p) => p.id as string);
  const projectSlug = Object.fromEntries(filas.map((p) => [p.id as string, p.slug as string]));
  const withBoard = [...new Set(filas.map((p) => p.specialist_id as string))];

  const [columnas, tarjetas] = await Promise.all([
    supabase
      .from('board_column')
      .select('slug, name, position, is_final')
      .in('project_id', ids)
      .order('position')
      .abortSignal(signal),
    supabase
      .from('board_card')
      .select(
        'id, project_id, specialist_id, number, title, description, status, priority, assignee_name, labels, due_date, position, origin',
      )
      .in('specialist_id', specialistIds)
      .order('position')
      .abortSignal(signal),
  ]);
  if (columnas.error) throw new ApiError(columnas.error.code, columnas.error.message);
  if (tarjetas.error) throw new ApiError(tarjetas.error.code, tarjetas.error.message);

  const cols = (columnas.data ?? []).map(toColumn);
  const cards = (tarjetas.data ?? []).map(toCard);
  if (cols.some((c) => c === null)) throw new ApiError('bad_shape', 'Respuesta inesperada de board_column');
  if (cards.some((c) => c === null)) throw new ApiError('bad_shape', 'Respuesta inesperada de board_card');

  // Las columnas se unifican por slug: cada agente tiene su proyecto en Kaneo, pero el tablero
  // que ve el cliente es UNO. Si dos proyectos comparten slug (lo normal: todos nacen con las
  // mismas cuatro columnas), se queda una, en la posición más temprana.
  const porSlug = new Map<string, BoardColumn>();
  for (const c of cols as BoardColumn[]) {
    const previa = porSlug.get(c.slug);
    if (!previa || c.position < previa.position) porSlug.set(c.slug, c);
  }

  return {
    projectSlug,
    withBoard,
    columns: [...porSlug.values()].sort((a, b) => a.position - b.position),
    cards: cards as BoardCard[],
  };
}

/** La conversación de una tarjeta, de la más antigua a la más reciente. */
export async function listCardComments(cardId: string, signal: AbortSignal): Promise<BoardComment[]> {
  const { data, error } = await supabase
    .from('board_comment')
    .select('id, author_name, body, kaneo_created_at')
    .eq('card_id', cardId)
    .order('kaneo_created_at')
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  const rows = (data ?? []).map(toComment);
  if (rows.some((r) => r === null)) throw new ApiError('bad_shape', 'Respuesta inesperada de board_comment');
  return rows as BoardComment[];
}

/** El texto que escribió nuestra propia Edge Function, o un mensaje genérico. */
async function mensajeDeFuncion(error: unknown, porDefecto: string): Promise<string> {
  const response: unknown = error instanceof FunctionsHttpError ? error.context : null;
  if (response instanceof Response) {
    const body: unknown = await response.json().catch(() => null);
    if (isObj(body) && isStr(body.error)) return body.error;
  }
  return porDefecto;
}

/**
 * Pide una tarea nueva. La escribe `board-write` en Kaneo (la fuente) y la refleja aquí, así
 * que aparece en pantalla sin esperar a la siguiente pasada del espejo.
 */
export async function createCard(specialistId: string, title: string, description: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('board-write', {
    body: { action: 'create_card', specialist_id: specialistId, title, description },
  });
  if (error) throw new ApiError('service_message', await mensajeDeFuncion(error, 'No se ha podido pedir la tarea.'));
  if (!isObj(data) || !isStr(data.card_id)) throw new ApiError('bad_shape', 'Respuesta inesperada de board-write');
  return data.card_id;
}

/** Comenta una tarjeta. El comentario llega a Kaneo con el nombre de quien lo escribe. */
export async function addCardComment(cardId: string, body: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('board-write', {
    body: { action: 'add_comment', card_id: cardId, body },
  });
  if (error) throw new ApiError('service_message', await mensajeDeFuncion(error, 'No se ha podido enviar el comentario.'));
  if (!isObj(data) || !isStr(data.comment_id)) throw new ApiError('bad_shape', 'Respuesta inesperada de board-write');
  return data.comment_id;
}
