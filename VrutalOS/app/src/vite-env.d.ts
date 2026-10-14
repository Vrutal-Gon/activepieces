/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Nombre de la empresa en la barra lateral. Cada despliegue de cliente pone el suyo. */
  readonly VITE_TENANT_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
