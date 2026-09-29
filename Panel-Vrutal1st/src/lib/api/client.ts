import { supabase } from '../supabaseClient';
import type { Guard } from '../guards';

export class ApiError extends Error {
  readonly code: string | undefined;
  constructor(code: string | undefined, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export async function rpc<T>(
  fn: string,
  args: Record<string, unknown> | undefined,
  guard: Guard<T>,
  signal?: AbortSignal,
): Promise<T> {
  const req = supabase.rpc(fn, args);
  const { data, error } = await (signal ? req.abortSignal(signal) : req);
  if (error) throw new ApiError(error.code, error.message);
  if (!guard(data)) throw new ApiError('bad_shape', `Respuesta inesperada de ${fn}`);
  return data;
}

// Panel interno de staff: se puede mostrar el detalle del error (ver security-checklist §6).
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === '42501') return 'No tienes permiso para hacer esto.';
    return err.message;
  }
  return 'No se ha podido completar la operación. Inténtalo de nuevo.';
}
