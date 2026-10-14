// Aviso entre la pantalla de Aprobaciones y la barra lateral (el contador de pendientes), sin estado compartido.
const EVENT = 'vrutalos:approvals-changed';

export const notifyApprovalsChanged = () => window.dispatchEvent(new Event(EVENT));

/** Se suscribe a los cambios; devuelve la función para darse de baja. */
export function onApprovalsChanged(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
