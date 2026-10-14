// Convierte lo que propone un especialista (JSON libre) en algo que un cliente pueda leer.
// La solución de fondo es un contrato: que el flujo ya mande un resumen y sus campos en claro (ver README de VrutalOS).
// Esto es la red de seguridad para cualquier otro payload: nunca se enseña JSON crudo como contenido principal.
import { formatInt } from './format';

export interface PayloadField {
  label: string;
  value: string;
}

export interface PayloadView {
  /** Qué quiere hacer, en una línea, si el flujo la manda. Nunca sale del catálogo de Vrutal. */
  title: string | null;
  summary: string | null;
  fields: PayloadField[];
}

// Claves frecuentes. Las que no estén aquí se humanizan («tipo_de_pago» → «Tipo de pago»).
const LABELS: Record<string, string> = {
  accion: 'Acción',
  action: 'Acción',
  asunto: 'Asunto',
  subject: 'Asunto',
  cantidad: 'Cantidad',
  cliente: 'Cliente',
  contacto: 'Contacto',
  contactos: 'Contactos',
  correo: 'Correo',
  email: 'Correo',
  empresa: 'Empresa',
  company: 'Empresa',
  estado: 'Estado',
  fecha: 'Fecha',
  importe: 'Importe',
  amount: 'Importe',
  mensaje: 'Mensaje',
  message: 'Mensaje',
  motivo: 'Motivo',
  reason: 'Motivo',
  nombre: 'Nombre',
  name: 'Nombre',
  origen: 'Origen',
  source: 'Origen',
  proveedor: 'Proveedor',
  sistema: 'Sistema',
  system: 'Sistema',
  telefono: 'Teléfono',
  phone: 'Teléfono',
  tarea: 'Tarea',
  destinatario: 'Destinatario',
  factura: 'Factura',
};

const TITLE_KEYS = ['titulo', 'title'];
const SUMMARY_KEYS = ['resumen', 'summary', 'descripcion', 'description'];
const MAX_TEXT = 400;
const MAX_FIELDS = 30;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function humanize(key: string): string {
  const text = key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return text ? text[0].toUpperCase() + text.slice(1) : key;
}

const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s);

/** Un valor suelto, como texto corto. Los anidados se resumen, no se vuelcan. */
function formatValue(v: unknown, depth = 0): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string') return clip(v);
  if (typeof v === 'number') return Number.isFinite(v) ? formatInt(v) : '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    if (v.every((x) => x === null || ['string', 'number', 'boolean'].includes(typeof x))) {
      return clip(v.map((x) => formatValue(x, depth + 1)).join(', '));
    }
    return `${formatInt(v.length)} elementos`;
  }
  if (isObj(v)) {
    if (depth >= 1) return 'Varios datos';
    const parts = Object.entries(v)
      .slice(0, 6)
      .map(([k, x]) => `${LABELS[k] ?? humanize(k)}: ${formatValue(x, depth + 1)}`);
    return clip(parts.join(' · '));
  }
  return '—';
}

/** Campos ya preparados por el flujo: [{ etiqueta|label, valor|value }]. */
function explicitFields(v: unknown): PayloadField[] | null {
  if (!Array.isArray(v)) return null;
  const out: PayloadField[] = [];
  for (const item of v) {
    if (!isObj(item)) return null;
    const label = item.etiqueta ?? item.label;
    if (typeof label !== 'string') return null;
    out.push({ label: clip(label), value: formatValue(item.valor ?? item.value) });
  }
  return out;
}

export function describePayload(payload: unknown): PayloadView {
  if (typeof payload === 'string') return { title: null, summary: payload.trim() ? clip(payload) : null, fields: [] };
  if (!isObj(payload)) return { title: null, summary: null, fields: [] };

  const titleKey = TITLE_KEYS.find((k) => typeof payload[k] === 'string' && (payload[k] as string).trim() !== '');
  const title = titleKey ? clip(payload[titleKey] as string) : null;
  const summaryKey = SUMMARY_KEYS.find((k) => typeof payload[k] === 'string' && (payload[k] as string).trim() !== '');
  const summary = summaryKey ? clip(payload[summaryKey] as string) : null;

  const prepared = explicitFields(payload.campos ?? payload.fields);
  if (prepared) return { title, summary, fields: prepared.slice(0, MAX_FIELDS) };

  const fields = Object.entries(payload)
    .filter(([k]) => k !== summaryKey && k !== titleKey)
    .slice(0, MAX_FIELDS)
    .map(([k, v]) => ({ label: LABELS[k] ?? humanize(k), value: formatValue(v) }));
  return { title, summary, fields };
}
