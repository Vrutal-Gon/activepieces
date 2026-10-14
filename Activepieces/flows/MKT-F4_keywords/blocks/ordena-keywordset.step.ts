/* vrutal-block {
  "block": "Ordena · a KeywordSet",
  "kind": "normalize",
  "variant": {},
  "consumes": ["texto de Claude con JSON"],
  "produces": "KeywordSet@1",
  "inputs": { "claudeText": "{{step_2}}", "runDate": "{{trigger.timestamp}}" }
} */
// Paso Code de Activepieces. Convierte la respuesta de Claude en filas KeywordSet válidas (es / en).
// Fail-closed: si la respuesta no trae JSON utilizable, el paso falla y nada se escribe en la hoja.

type Intent = 'informational' | 'commercial' | 'transactional';
type Idioma = 'es' | 'en';
const INTENTS: Intent[] = ['informational', 'commercial', 'transactional'];
const IDIOMAS: Idioma[] = ['es', 'en'];
const MAX_ROWS = 100; // techo por ejecución: evita que una respuesta desbocada llene la hoja

// Reglas de marca (LAB 10 cap. 2, LAB 11): nada de bots; la IA solo como miedo o riesgo (informational),
// nunca como solución que se compra o se implanta.
const BOTS = /\b(chatbots?|bots?)\b/i;
const IA = /\b(ia|ai|inteligencia artificial|artificial intelligence)\b/i;
const COMPRA_IA = /\b(implementar|implantar|implementaci[oó]n|contratar|comprar|adoptar|implement|implementation|adopt|hire|buy|software|herramientas?|tools?)\b/i;

const clean = (v: unknown, max = 200) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/^[=+\-@]/, "'$&") // anti fórmula: una celda nunca empieza por = + - @
    .trim()
    .slice(0, max);

export const code = async (inputs: { claudeText: unknown; runDate?: string }) => {
  const raw = typeof inputs.claudeText === 'string' ? inputs.claudeText : JSON.stringify(inputs.claudeText ?? '');
  // Claude a veces envuelve el JSON en ```json … ```: nos quedamos con el primer objeto.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('La respuesta de Claude no contiene JSON');

  let parsed: { keywords?: unknown };
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error('El JSON de Claude no es válido');
  }
  const list = Array.isArray(parsed.keywords) ? parsed.keywords : [];

  const seen = new Set<string>();
  const date = (inputs.runDate ? new Date(inputs.runDate) : new Date()).toISOString().slice(0, 10);
  const rows = [];
  let discarded = 0;
  for (const item of list as Record<string, unknown>[]) {
    const keyword = clean(item?.keyword, 120).toLowerCase();
    const idioma = String(item?.idioma ?? '').trim().toLowerCase() as Idioma;
    const intent = INTENTS.includes(item?.intent as Intent) ? (item.intent as Intent) : 'informational';
    const key = `${idioma}|${keyword}`;
    const breaksBrand =
      BOTS.test(keyword) || (IA.test(keyword) && (intent !== 'informational' || COMPRA_IA.test(keyword)));
    if (!keyword || !IDIOMAS.includes(idioma) || seen.has(key) || breaksBrand) {
      discarded++;
      continue;
    }
    seen.add(key);
    rows.push({
      fecha: date,
      keyword,
      icp_pain: clean(item?.icp_pain),
      intent,
      monthly_volume: '', // sin cuenta de Google Ads todavía: el volumen queda vacío
      difficulty: '',
      owner: intent === 'transactional' ? 'sem' : 'seo',
      estado: 'propuesta',
      idioma,
    });
    if (rows.length >= MAX_ROWS) break;
  }
  if (rows.length === 0) throw new Error('Claude no devolvió ninguna keyword utilizable');

  return { rows, count: rows.length, discarded, rows_json: JSON.stringify(rows) };
};
