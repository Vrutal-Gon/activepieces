import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { isArrayOf, isObj, isStr, isStrOrNull } from '../guards';
import type { Guard } from '../guards';
import type { Integration } from '../types';
import { ApiError } from './client';

// secret_ref no está aquí a propósito: el servidor tampoco deja leerlo. La clave nunca llega al navegador.
const COLUMNS = 'id, integration_type, provider, status, validated_at, last_error, created_at';

const isIntegration: Guard<Integration> = (v): v is Integration =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.integration_type) &&
  isStr(v.provider) &&
  (v.status === 'active' || v.status === 'paused' || v.status === 'revoked') &&
  isStrOrNull(v.validated_at) &&
  isStrOrNull(v.last_error) &&
  isStr(v.created_at);

export async function listIntegrations(signal: AbortSignal): Promise<Integration[]> {
  const { data, error } = await supabase.from('integrations').select(COLUMNS).abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  if (!isArrayOf(isIntegration)(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de integrations');
  return data;
}

export interface SyncedProvider {
  provider_key: string;
  system_category: string;
  system_name: string;
}

const isSyncedProvider: Guard<SyncedProvider> = (v): v is SyncedProvider =>
  isObj(v) && isStr(v.provider_key) && isStr(v.system_category) && isStr(v.system_name);

/**
 * Espejo de solo lectura de lo que el Stack de este cliente en Vrutal1st habilitó (sync cada
 * 15 min, migración `2026-10-11_integration_provider_sync.sql`). Puede no existir todavía en
 * clientes con una plantilla más vieja: en ese caso se trata como "ninguno sincronizado", no
 * como error — IntegrationsPage decide qué enseñar igual (ver `visibleProviders`).
 */
export async function listEnabledProviders(signal: AbortSignal): Promise<SyncedProvider[]> {
  const { data, error } = await supabase
    .from('integration_provider_ro')
    .select('provider_key, system_category, system_name')
    .abortSignal(signal);
  if (error) {
    if (error.code === '42P01') return [];
    throw new ApiError(error.code, error.message);
  }
  if (!isArrayOf(isSyncedProvider)(data)) return [];
  return data;
}

/** Pausa o reanuda. El servidor bloquea en silencio si no hay permiso, así que se pide la fila de vuelta. */
export async function setIntegrationPaused(id: string, paused: boolean): Promise<boolean> {
  const { data, error } = await supabase
    .from('integrations')
    .update({ status: paused ? 'paused' : 'active' })
    .eq('id', id)
    .select('id');
  if (error) throw new ApiError(error.code, error.message);
  return Array.isArray(data) && data.length === 1;
}

/**
 * Edge Function integration-save-key: prueba la clave contra el proveedor y, solo si funciona, la guarda cifrada.
 * La clave viaja una vez, por TLS, y no se devuelve nunca.
 */
export async function saveIntegrationKey(provider: string, key: string): Promise<void> {
  const { error } = await supabase.functions.invoke('integration-save-key', { body: { provider, key } });
  if (!error) return;
  // Los mensajes de la función son nuestros y están en español (incluye el motivo del proveedor).
  let message = 'No se ha podido guardar la clave.';
  const response: unknown = error instanceof FunctionsHttpError ? error.context : null;
  if (response instanceof Response) {
    const body: unknown = await response.json().catch(() => null);
    if (isObj(body) && isStr(body.error)) message = body.error;
  }
  throw new ApiError('service_message', message);
}

/**
 * Edge Function social-app-save: guarda las credenciales de la app OAuth que el cliente ha
 * creado en el portal del proveedor (p. ej. Client ID/Secret de su app de LinkedIn).
 *
 * No se prueban contra el proveedor: la prueba real es la propia autorización, que viene
 * después con "Conectar". Guardar no basta para que surtan efecto — Postiz las lee del
 * entorno al arrancar, así que el agente de la instancia lo reinicia (hasta un minuto).
 */
export async function saveSocialApp(network: string, clientId: string, clientSecret: string): Promise<void> {
  const { error } = await supabase.functions.invoke('social-app-save', {
    body: { network, client_id: clientId, client_secret: clientSecret },
  });
  if (!error) return;
  let message = 'No se han podido guardar las credenciales.';
  const response: unknown = error instanceof FunctionsHttpError ? error.context : null;
  if (response instanceof Response) {
    const body: unknown = await response.json().catch(() => null);
    if (isObj(body) && isStr(body.error)) message = body.error;
  }
  throw new ApiError('service_message', message);
}

/**
 * Edge Function integration-social-connect: pide a Postiz la URL real de autorización
 * de una red (LinkedIn, Discord...). No hay clave que pegar — el llamador abre la URL
 * devuelta en una pestaña nueva; el Admin autoriza ahí, nunca en una pantalla de Postiz.
 */
export async function connectSocialProvider(provider: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('integration-social-connect', { body: { provider } });
  if (!error && isObj(data) && isStr(data.url)) return data.url;
  let message = 'No se ha podido iniciar la conexión.';
  const response: unknown = error instanceof FunctionsHttpError ? error.context : null;
  if (response instanceof Response) {
    const body: unknown = await response.json().catch(() => null);
    if (isObj(body) && isStr(body.error)) message = body.error;
  }
  throw new ApiError('service_message', message);
}
