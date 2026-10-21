import { supabase } from '../supabaseClient';
import { isArrayOf, isBool, isNum, isNumOrNull, isObj, isStr, isStrOrNull } from '../guards';
import type { Guard } from '../guards';
import type {
  MktChannelTarget,
  MktCompetitor,
  MktFocusProduct,
  MktInputField,
  MktInputKey,
  MktInputValue,
  MktSemStrategy,
} from '../types';
import { ApiError } from './client';

// Scope de negocio. Todo pasa por la sesión de quien mira: lo que puede leer y escribir lo decide
// RLS en el servidor (escribir exige is_admin_or_marketing() y solo alcanza source = 'cliente').
// Nunca se usa service_role desde el navegador.

const INPUT_KEYS: MktInputKey[] = ['icp', 'brand_voice', 'strategy'];
const isInputKey = (v: unknown): v is MktInputKey => INPUT_KEYS.some((k) => k === v);
const isSource = (v: unknown): v is 'vrutal' | 'cliente' => v === 'vrutal' || v === 'cliente';

const isField: Guard<MktInputField> = (v): v is MktInputField =>
  isObj(v) && isInputKey(v.input_key) && isStr(v.field_key) && isStr(v.label) && isBool(v.multi) && isNum(v.position) && isStrOrNull(v.help);

const isValue: Guard<MktInputValue> = (v): v is MktInputValue =>
  isObj(v) && isStr(v.id) && isInputKey(v.input_key) && isStr(v.field_key) && isStr(v.value) && isSource(v.source) && isNum(v.position);

const isTarget: Guard<MktChannelTarget> = (v): v is MktChannelTarget =>
  isObj(v) && isStr(v.id) && isStr(v.channel) && isStr(v.metric) && isStr(v.target) && isStrOrNull(v.period) && isSource(v.source);

const isCompetitor: Guard<MktCompetitor> = (v): v is MktCompetitor =>
  isObj(v) && isStr(v.id) && isStr(v.name) && isStrOrNull(v.website) && isStrOrNull(v.notes) && isNum(v.priority) && isSource(v.source);

const isProduct: Guard<MktFocusProduct> = (v): v is MktFocusProduct =>
  isObj(v) && isStr(v.id) && isStr(v.name) && isStrOrNull(v.description) && isStrOrNull(v.price_note) && isNum(v.priority) && isStr(v.status) && isSource(v.source);

// `budget_monthly` es `numeric` y PostgREST lo puede servir como número o como cadena según la
// versión: se acepta cualquiera de las dos y se normaliza a número al leer.
const isNumLike = (v: unknown): v is number | string | null => isNumOrNull(v) || isStr(v);

const isSemStrategy: Guard<MktSemStrategy> = (v): v is MktSemStrategy =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.objective) &&
  isStr(v.starts_on) &&
  isStrOrNull(v.ends_on) &&
  isNumLike(v.budget_monthly) &&
  isStr(v.currency) &&
  isStrOrNull(v.focus_product_id) &&
  isStrOrNull(v.geo) &&
  isStrOrNull(v.landing_url) &&
  isStr(v.status) &&
  isStrOrNull(v.notes) &&
  isSource(v.source);

/** Los campos que existen, con su orden y su ayuda. Los define Vrutal: el cliente no los crea. */
export async function listFields(signal: AbortSignal): Promise<MktInputField[]> {
  const { data, error } = await supabase
    .from('mkt_input_field')
    .select('input_key, field_key, label, multi, position, help')
    .order('input_key')
    .order('position')
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  if (!isArrayOf(isField)(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de mkt_input_field');
  return data;
}

export async function listValues(signal: AbortSignal): Promise<MktInputValue[]> {
  const { data, error } = await supabase
    .from('mkt_input_value')
    .select('id, input_key, field_key, value, source, position')
    .order('position')
    .order('value')
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  if (!isArrayOf(isValue)(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de mkt_input_value');
  return data;
}

export async function listTargets(signal: AbortSignal): Promise<MktChannelTarget[]> {
  const { data, error } = await supabase
    .from('mkt_channel_target')
    .select('id, channel, metric, target, period, source')
    .order('channel')
    .order('metric')
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  if (!isArrayOf(isTarget)(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de mkt_channel_target');
  return data;
}

export async function listCompetitors(signal: AbortSignal): Promise<MktCompetitor[]> {
  const { data, error } = await supabase
    .from('mkt_competitor')
    .select('id, name, website, notes, priority, source')
    .order('priority')
    .order('name')
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  if (!isArrayOf(isCompetitor)(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de mkt_competitor');
  return data;
}

export async function listProducts(signal: AbortSignal): Promise<MktFocusProduct[]> {
  const { data, error } = await supabase
    .from('mkt_focus_product')
    .select('id, name, description, price_note, priority, status, source')
    .order('status')
    .order('priority')
    .order('name')
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  if (!isArrayOf(isProduct)(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de mkt_focus_product');
  return data;
}

/**
 * Estrategias SEM: objetivo de lista cerrada + vigencia. Sin métrica (eso es `mkt_channel_target`).
 *
 * Si el proyecto de este cliente todavía no tiene aplicado el cambio 2026-10-20_mkt_sem_strategy.sql,
 * la tabla no existe: se devuelve lista vacía en vez de tumbar la pantalla entera de Negocio. Los
 * cambios se aplican proyecto a proyecto y en fechas distintas (ver db/plantillas/cambios/README.md),
 * así que un cliente al día y otro atrasado conviven. Cualquier otro error sí sube.
 */
const TABLA_AUSENTE = ['42P01', 'PGRST205', 'PGRST204'];

export async function listSemStrategies(signal: AbortSignal): Promise<MktSemStrategy[]> {
  const { data, error } = await supabase
    .from('mkt_sem_strategy')
    .select('id, objective, starts_on, ends_on, budget_monthly, currency, focus_product_id, geo, landing_url, status, notes, source')
    .order('starts_on', { ascending: false })
    .abortSignal(signal);
  if (error && TABLA_AUSENTE.includes(error.code)) return [];
  if (error) throw new ApiError(error.code, error.message);
  if (!isArrayOf(isSemStrategy)(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de mkt_sem_strategy');
  return data.map((s) => ({
    ...s,
    budget_monthly: s.budget_monthly === null ? null : Number(s.budget_monthly),
  }));
}

export interface NegocioData {
  fields: MktInputField[];
  values: MktInputValue[];
  targets: MktChannelTarget[];
  competitors: MktCompetitor[];
  products: MktFocusProduct[];
  semStrategies: MktSemStrategy[];
}

/** Todo el scope de una vez: son tablas pequeñas y la cabecera necesita saber qué falta en cada bloque. */
export async function loadNegocio(signal: AbortSignal): Promise<NegocioData> {
  const [fields, values, targets, competitors, products, semStrategies] = await Promise.all([
    listFields(signal),
    listValues(signal),
    listTargets(signal),
    listCompetitors(signal),
    listProducts(signal),
    listSemStrategies(signal),
  ]);
  return { fields, values, targets, competitors, products, semStrategies };
}

export type Tabla =
  | 'mkt_input_value'
  | 'mkt_channel_target'
  | 'mkt_competitor'
  | 'mkt_focus_product'
  | 'mkt_sem_strategy';

/**
 * RLS bloquea en silencio (0 filas, sin error), así que se pide la fila de vuelta: si no llega, el
 * cambio no se hizo. `source` se fuerza a 'cliente' al crear: la política no deja otra cosa, y así
 * nadie puede escribir una fila haciéndola pasar por auditoría de Vrutal.
 */
export async function crear(tabla: Tabla, fila: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await supabase
    .from(tabla)
    .insert({ ...fila, source: 'cliente' })
    .select('id');
  if (error) throw new ApiError(error.code, error.message);
  return Array.isArray(data) && data.length === 1;
}

export async function editar(tabla: Tabla, id: string, cambio: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await supabase.from(tabla).update(cambio).eq('id', id).select('id');
  if (error) throw new ApiError(error.code, error.message);
  return Array.isArray(data) && data.length === 1;
}

export async function borrar(tabla: Tabla, id: string): Promise<boolean> {
  const { data, error } = await supabase.from(tabla).delete().eq('id', id).select('id');
  if (error) throw new ApiError(error.code, error.message);
  return Array.isArray(data) && data.length === 1;
}
