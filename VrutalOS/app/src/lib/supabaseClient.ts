import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Nombre de la empresa de esta instancia. Nunca va en el código: lo pone cada despliegue. */
export const TENANT_NAME = import.meta.env.VITE_TENANT_NAME ?? '';
