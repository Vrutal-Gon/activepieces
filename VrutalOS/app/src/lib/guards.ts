// Validadores en runtime de lo que llega de las RPC. Comprueban lo que la UI necesita.
export type Guard<T> = (v: unknown) => v is T;

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const isStr = (v: unknown): v is string => typeof v === 'string';
export const isStrOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);

export const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

export const isArrayOf =
  <T>(g: Guard<T>): Guard<T[]> =>
  (v): v is T[] =>
    Array.isArray(v) && v.every(g);

export const isVoid = (v: unknown): v is null => v === null || v === undefined || v === '';
export const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
