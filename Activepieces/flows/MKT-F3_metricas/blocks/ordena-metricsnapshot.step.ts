/* vrutal-block {
  "block": "Ordena · a MetricsSnapshot (HubSpot)",
  "kind": "normalize",
  "variant": { "source": "hubspot" },
  "consumes": ["ReportWindow@1"],
  "produces": "MetricsSnapshot@1",
  "inputs": { "hubspot": "{{step_2.body}}", "period_start": "{{step_1.period_start}}", "period_end": "{{step_1.period_end}}" }
} */
// Paso Code de Activepieces. Convierte los contactos nuevos de HubSpot en filas MetricsSnapshot, una por canal.
// Fail-closed: si la respuesta no tiene el formato esperado, o hay más contactos de los que caben en una consulta,
// el paso falla y nada se escribe: una cifra truncada sería peor que ninguna.

type Channel = 'seo' | 'sem' | 'email' | 'linkedin' | 'social' | 'web' | 'other';
const CHANNELS: Channel[] = ['seo', 'sem', 'email', 'linkedin', 'social', 'web', 'other'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fuente original de HubSpot (hs_analytics_source) -> canal del contrato. Lo desconocido va a «other», nunca se inventa.
const channelOf = (source: unknown, drill: unknown): Channel => {
  switch (String(source ?? '').toUpperCase()) {
    case 'ORGANIC_SEARCH':
      return 'seo';
    case 'PAID_SEARCH':
      return 'sem';
    case 'EMAIL_MARKETING':
      return 'email';
    case 'SOCIAL_MEDIA':
    case 'PAID_SOCIAL':
      return /linkedin/i.test(String(drill ?? '')) ? 'linkedin' : 'social';
    case 'DIRECT_TRAFFIC':
      return 'web';
    default:
      return 'other';
  }
};

export const code = async (inputs: { hubspot: unknown; period_start: string; period_end: string }) => {
  if (!DAY_RE.test(inputs.period_start) || !DAY_RE.test(inputs.period_end)) throw new Error('El periodo no es válido');

  const body = (typeof inputs.hubspot === 'string' ? JSON.parse(inputs.hubspot) : inputs.hubspot) as {
    total?: unknown;
    results?: { properties?: Record<string, unknown> }[];
  } | null;
  if (!body || typeof body.total !== 'number' || !Array.isArray(body.results)) {
    throw new Error('La respuesta de HubSpot no tiene el formato esperado');
  }
  if (body.total > body.results.length) {
    throw new Error(`HubSpot devolvió ${body.results.length} de ${body.total} contactos: hay más de una página`);
  }

  const counts = new Map<Channel, number>(CHANNELS.map((c) => [c, 0]));
  for (const contact of body.results) {
    const p = contact?.properties ?? {};
    const ch = channelOf(p.hs_analytics_source, p.hs_analytics_source_data_1);
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }

  // Una fila por canal, también con 0: así la serie semanal no tiene huecos.
  const rows = CHANNELS.map((channel) => ({
    period_start: inputs.period_start,
    period_end: inputs.period_end,
    channel,
    metric: 'new_contacts',
    value: counts.get(channel) ?? 0,
    source: 'hubspot',
  }));

  return { rows, count: rows.length, total: body.results.length };
};
