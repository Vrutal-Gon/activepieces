/* vrutal-block {
  "block": "Ordena · a ContentBrief",
  "kind": "normalize",
  "variant": {},
  "consumes": [],
  "produces": "ContentBrief@1",
  "inputs": { "sources": ["{{step_7.body}}"] }
} */
// Paso Code de Activepieces. Convierte la salida anterior en filas ContentBrief validadas.
// Fail-closed: si no queda ninguna fila valida, el paso falla y nada se escribe.
// Contrato: existente. Los campos son una PROPUESTA hasta que el founder los apruebe.

const FIELDS: { name: string; req: boolean; enum: string[] | null; default: string | null; sourced: boolean }[] = [{"name": "brief_id", "req": true, "enum": null, "default": null, "sourced": false}, {"name": "objective", "req": true, "enum": null, "default": null, "sourced": false}, {"name": "audience", "req": true, "enum": null, "default": null, "sourced": false}, {"name": "key_message", "req": true, "enum": null, "default": null, "sourced": false}, {"name": "evidence", "req": false, "enum": null, "default": null, "sourced": true}, {"name": "cta", "req": true, "enum": null, "default": null, "sourced": false}, {"name": "target_keyword", "req": true, "enum": null, "default": null, "sourced": false}, {"name": "channel", "req": true, "enum": null, "default": null, "sourced": false}];
const LOOKUP_KEY = null;
const MAX_ROWS = 200; // techo por ejecucion

const clean = (v: unknown, max = 2000) =>
  (Array.isArray(v) ? v.join(' | ') : String(v ?? ''))
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/^[=+\-@]/, "'$&") // anti formula: una celda nunca empieza por = + - @
    .trim()
    .slice(0, max);

// La respuesta de la API de Anthropic trae bloques (texto y, según el modelo, pensamiento).
// Se cogen TODOS los de tipo texto, no el primero: ese fue el fallo de la pieza piece-claude,
// que devolvía vacío cuando el primer bloque no era texto.
const textoDe = (v: unknown): unknown => {
  const bloques = (v as { content?: Array<{ type?: string; text?: string }> })?.content;
  if (!Array.isArray(bloques)) return v;
  return bloques.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
};

const usoDe = (fuentes: unknown[]) => {
  for (const f of fuentes) {
    const u = (f as { usage?: { input_tokens?: number; output_tokens?: number } })?.usage;
    if (u) return u;
  }
  return {} as { input_tokens?: number; output_tokens?: number };
};

const toList = (src: unknown): Record<string, unknown>[] => {
  let data: unknown = textoDe(src);
  if (typeof data === 'string') {
    const a = data.search(/[\[{]/);
    const last = Math.max(data.lastIndexOf('}'), data.lastIndexOf(']'));
    if (a < 0 || last <= a) return [];
    try { data = JSON.parse(data.slice(a, last + 1)); } catch { throw new Error('El JSON recibido no es valido'); }
  }
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : data && typeof data === 'object' ? [data] : [];
  return arr
    .map((x) => (x && typeof x === 'object' && 'values' in x ? (x as { values: unknown }).values : x))
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x));
};

export const code = async (inputs: { sources: unknown[]; lookup?: unknown }) => {
  const uso = usoDe(inputs.sources ?? []);
  const ranAt = new Date().toISOString();
  const day = ranAt.slice(0, 10);
  const records = (inputs.sources ?? []).flatMap((s) => toList(s));
  const lookupRows = LOOKUP_KEY ? toList(inputs.lookup) : [];
  const byKey = new Map(lookupRows.map((r) => [String(r[LOOKUP_KEY as string] ?? ''), r]));

  const rows: Record<string, string>[] = [];
  let discarded = 0;
  for (const rec of records) {
    const extra = LOOKUP_KEY ? byKey.get(String(rec[LOOKUP_KEY] ?? '')) ?? {} : {};
    const row: Record<string, string> = { fecha: day };
    let ok = true;
    for (const fd of FIELDS) {
      let v = clean(rec[fd.name] ?? extra[fd.name] ?? fd.default ?? '');
      if (fd.sourced && v && !/https?:\/\/|fuente:/i.test(v)) v = ''; // la prueba cita fuente o queda vacia
      if (v && fd.enum && !fd.enum.includes(v.toLowerCase())) { ok = false; break; }
      if (fd.enum && v) v = v.toLowerCase();
      if (fd.req && !v) { ok = false; break; }
      row[fd.name] = v;
    }
    if (!ok) { discarded++; continue; }
    rows.push(row);
    if (rows.length >= MAX_ROWS) break;
  }
  if (rows.length === 0) throw new Error('Ninguna fila valida para ContentBrief (' + discarded + ' descartadas)');
  return {
    rows,
    count: rows.length,
    discarded,
    ran_at: ranAt,
    rows_json: JSON.stringify(rows),
    tokens_in: uso.input_tokens ?? null,
    tokens_out: uso.output_tokens ?? null,
  };
};
