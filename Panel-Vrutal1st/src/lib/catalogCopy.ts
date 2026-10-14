// Cómo se explica el catálogo en el panel. Voz Vrutal (LAB 03): una frase, una idea; palabra corta.
// Un único ejemplo recorre todo: el especialista que registra facturas de proveedor.
import type { BlockKind } from './types';

/** Qué hace cada tipo de bloque, en un verbo y una frase. */
export const KIND_COPY: Record<BlockKind, { verb: string; line: string; example: string }> = {
  intake: { verb: 'Recibe', line: 'Por dónde entra el trabajo.', example: 'Llega un email con una factura.' },
  normalize: { verb: 'Ordena', line: 'Convierte lo recibido en datos limpios.', example: 'Saca proveedor, importe y fecha del PDF.' },
  context: { verb: 'Consulta', line: 'Trae lo que el especialista necesita saber.', example: 'Busca al proveedor en el ERP.' },
  decide: { verb: 'Decide', line: 'Aplica reglas o criterio.', example: '¿Cuadra con el pedido?' },
  gate: { verb: 'Pide permiso', line: 'Una persona aprueba antes de seguir.', example: 'Si supera el límite del cliente, firma un humano.' },
  act: { verb: 'Ejecuta', line: 'Escribe en los sistemas del cliente.', example: 'Registra la factura en el ERP.' },
  audit: { verb: 'Deja rastro', line: 'Registra qué hizo y por qué.', example: 'Guarda la decisión y su motivo.' },
};

export const kindLabel = (k: string | null | undefined) =>
  k && k in KIND_COPY ? `${KIND_COPY[k as BlockKind].verb} · ${k}` : '— sin tipo —';

/** Patrón de ejecución de una tarea o composición. */
export const PATTERN_COPY: Record<string, string> = {
  WORKFLOW: 'Pasos fijos, siempre el mismo camino.',
  AGENT: 'El especialista razona y elige cómo resolver.',
  MULTI_AGENT: 'Varios especialistas coordinados.',
  RULES: 'Reglas explícitas, sin modelo.',
  SCRIPT: 'Código determinista.',
  API: 'Una llamada a un sistema.',
  LLM: 'Una llamada a un modelo de lenguaje.',
  RAG: 'Responde con la memoria organizativa.',
  ML: 'Modelo entrenado (clasificar, predecir).',
  PROMPT: 'Una instrucción al modelo, sin más.',
  HUMAN: 'Lo hace una persona.',
};

export const CATALOG_GLOSSARY = {
  block: 'Bloque: una pieza que hace una sola cosa y la hace siempre igual.',
  contract: 'Contrato: la forma exacta del dato que un bloque entrega al siguiente.',
  composition: 'Composición: la secuencia de bloques con la que un especialista resuelve una tarea. Siempre en línea, sin desvíos.',
  variant: 'Variante: el mismo bloque para otro stack. Recibir por Gmail y recibir por IMAP son dos bloques del mismo tipo que entregan el mismo contrato.',
  immutable: 'Lo publicado no se toca. Para cambiarlo, se crea la versión siguiente.',
  exampleTask: 'Registrar una factura de proveedor',
  exampleContract: 'EmailEvent: remitente, asunto, adjuntos. El bloque que recibe lo entrega; el que ordena lo espera.',
};
