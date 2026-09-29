import { isArrayOf, isObj, isStr } from '../guards';
import { rpc } from './client';

export interface RoleKeyEntry {
  key: string;
  name: string;
}

const isRoleKeyEntry = (v: unknown): v is RoleKeyEntry => isObj(v) && isStr(v.key) && isStr(v.name);

/** Catálogo de roles (superadmin/admin en servidor). */
export function listRoleKeys(signal?: AbortSignal) {
  return rpc('catalog_list_job_role_keys', undefined, isArrayOf(isRoleKeyEntry), signal);
}
