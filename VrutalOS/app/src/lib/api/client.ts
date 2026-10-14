export class ApiError extends Error {
  readonly code: string | undefined;
  constructor(code: string | undefined, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

// App de cliente: audiencia no técnica. Nunca se muestra el mensaje crudo del servidor.
// Única excepción: 'service_message', cuyo texto lo escribe una Edge Function nuestra (en español y sin detalle interno).
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.code === '42501') return 'No tienes permiso para hacer esto.';
  if (err instanceof ApiError && err.code === 'service_message') return err.message;
  return 'No se ha podido completar la operación. Inténtalo de nuevo.';
}
