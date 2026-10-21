/* vrutal-block {
  "block": "Extrae · texto de la respuesta",
  "kind": "normalize",
  "variant": {"source": "anthropic_api"},
  "consumes": [],
  "produces": null,
  "inputs": { "respuesta": "{{step_N.body}}", "acumula": "{{step_M}}" }
} */
// Paso Code de Activepieces. Saca el texto de una respuesta de la API de Anthropic para poder
// encadenarla en otro prompt, y arrastra el consumo de las llamadas anteriores.
//
// Por qué existe: la pieza piece-claude devolvía solo `content[0].text` y se quedaba vacía
// cuando el primer bloque no era texto. Aquí se cogen TODOS los bloques de tipo texto. Y como
// un flujo puede llamar a la API varias veces (F1 redacta y luego revisa la voz), `acumula`
// recibe la salida del extractor anterior y suma sus tokens: así el rastro de run_log cuenta
// el consumo entero de la ejecución, no solo el de la última llamada.
//
// Fail-closed: sin ningún bloque de texto, el paso falla y nada sigue adelante.

export const code = async (inputs: { respuesta: unknown; acumula?: unknown }) => {
  const bloques = (inputs.respuesta as { content?: Array<{ type?: string; text?: string }> })?.content;
  if (!Array.isArray(bloques)) throw new Error('La respuesta no tiene bloques de contenido');

  const texto = bloques
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!texto) throw new Error('La API no devolvió ningún bloque de texto');

  const uso = (inputs.respuesta as { usage?: { input_tokens?: number; output_tokens?: number } })?.usage ?? {};
  const antes = (inputs.acumula as { tokens_in?: number; tokens_out?: number }) ?? {};
  const modelo = (inputs.respuesta as { model?: string })?.model ?? null;

  return {
    texto,
    model_name: modelo,
    tokens_in: (uso.input_tokens ?? 0) + (antes.tokens_in ?? 0),
    tokens_out: (uso.output_tokens ?? 0) + (antes.tokens_out ?? 0),
  };
};
