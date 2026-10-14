// Sistemas que el Admin puede conectar. Dos formas, nunca mezcladas en el mismo proveedor:
//  - clave: el Admin pega una clave propia; se prueba en integration-save-key y se guarda
//    en el Vault de este cliente. Solo para claves que el cliente paga/controla (HubSpot,
//    Anthropic) — nunca para infraestructura de Vrutal (Postiz: ver nota más abajo).
//  - social: "Conectar" pide la URL de autorización a integration-social-connect y se abre
//    en una pestaña nueva — el Admin nunca pega nada, nunca ve la interfaz de Postiz.
// Al añadir un proveedor de clave, hay que añadirlo también en integration-save-key (supabase/functions).
export interface ProviderInfo {
  provider: string;
  label: string;
  /** Para qué sirve, en palabras del cliente. */
  kind: string;
  /** 'key' (por defecto): formulario de clave. 'social': conectar por redirección, sin clave. */
  connect?: 'key' | 'social';
  /** Qué debe pegar y dónde lo consigue. Solo para connect: 'key'. */
  keyHelp?: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    provider: 'hubspot',
    label: 'HubSpot',
    kind: 'CRM',
    keyHelp: 'El token de una Service Key de HubSpot: Ajustes → Integraciones → Service Keys → Crear → scope mínimo "crm.objects.contacts.read" → copiar el token (las "Aplicaciones privadas" antiguas ya no se pueden crear).',
  },
  {
    provider: 'anthropic',
    label: 'Anthropic',
    kind: 'Inteligencia artificial',
    keyHelp: 'Una clave de API de Anthropic (console.anthropic.com → API keys).',
  },
  // Deliberadamente NO hay entrada "postiz" aquí (decisión 2026-10-10, migración 025 en
  // Vrutal1st): es infraestructura que Vrutal provisiona y gestiona, no una clave del cliente.
  // El staff la pone desde Panel-Vrutal1st → ficha del cliente → Infraestructura, nunca desde
  // aquí. Las redes sociales en sí (lo que el Admin SÍ conecta) están en SOCIAL_PROVIDERS abajo.
];

// ─────────────────────────────────────────────────────────────────────────────
// Apps OAuth de redes sociales: las crea el PROPIO CLIENTE en el portal de desarrolladores
// de cada red, porque son apps de su empresa (publican en su página, con su marca).
//
// Por qué el cliente y no Vrutal: lo normal en el sector (Buffer, Hootsuite) es que la
// plataforma tenga UNA app y el cliente solo autorice. Eso exige que LinkedIn apruebe la
// Community Management API a nombre de Vrutal, que hoy no es posible (sin entidad legal
// todavía). Decidido el 2026-10-13: cada cliente usa su app por ahora, y cuando la de Vrutal
// esté aprobada esta misma pantalla traerá las credenciales puestas y ocultará los campos.
//
// Las credenciales las guarda el Admin con social-app-save (Vault del propio cliente) y las
// consume el contenedor de Postiz al arrancar (social-app-env). Vrutal nunca las ve ni las
// pide por correo, y no hay ningún .env que tocar.
// ─────────────────────────────────────────────────────────────────────────────
export interface SocialAppInfo {
  /** Clave de la app, NO de la conexión: una app puede dar servicio a varias conexiones. */
  network: string;
  label: string;
  /** Los `provider` de SOCIAL_PROVIDERS que dependen de esta app. */
  covers: string[];
  /** Cómo se llaman los dos campos en el portal del proveedor, con sus palabras. */
  idLabel: string;
  secretLabel: string;
  /** Dónde se crea la app y qué hay que habilitar dentro. */
  help: string;
  /** Rutas de redirección a autorizar, relativas a la URL pública de Postiz. */
  redirectPaths: string[];
}

/** Solo LinkedIn: es la única cuyas rutas de redirección y nombres de campo están
 * comprobados contra el código de Postiz (2026-10-13). Las otras ocho que la instancia
 * cablea (X, Facebook, Threads, YouTube, TikTok, Reddit, Discord, Slack) se añaden aquí
 * cuando se verifique cada una — no se adivinan: una ruta mal puesta rompe la autorización
 * y el cliente no tiene forma de saber por qué. */
export const SOCIAL_APPS: SocialAppInfo[] = [
  {
    network: 'linkedin',
    label: 'LinkedIn',
    covers: ['linkedin', 'linkedin-page'],
    idLabel: 'Client ID',
    secretLabel: 'Client Secret',
    help: 'Crea una app en developer.linkedin.com → My apps → Create app, asociada a tu página de empresa. Dentro, en la pestaña Products, solicita "Share on LinkedIn" y "Sign In with LinkedIn using OpenID Connect"; para publicar en la página de empresa necesitas además "Community Management API". El Client ID y el Client Secret están en la pestaña Auth.',
    // Una sola app cubre perfil y página: linkedin.page.provider.ts hereda de
    // linkedin.provider.ts, con los mismos scopes (comprobado en el código de Postiz).
    redirectPaths: ['/integrations/social/linkedin', '/integrations/social/linkedin-page'],
  },
];

/** URL pública de Postiz de esta instancia, de donde salen las rutas de redirección que el
 * cliente copia en el portal del proveedor.
 *
 * Se deduce del propio host: la instancia sirve VrutalOS en `<slug>.<dominio>` y Postiz en
 * `<slug>-social.<dominio>` (las dos reglas de Traefik de docker-compose.yml). En desarrollo,
 * donde la app corre en `localhost:5173` y no hay slug del que deducirlo, hace falta
 * VITE_SOCIAL_PUBLIC_URL: antes que enseñar una URL inventada, no se enseña ninguna — una
 * ruta mal copiada en LinkedIn falla de una forma que el cliente no puede diagnosticar. */
export function socialPublicBaseUrl(): string {
  const override = import.meta.env.VITE_SOCIAL_PUBLIC_URL;
  if (typeof override === 'string' && override.trim() !== '') return override.trim().replace(/\/+$/, '');

  const { protocol, hostname, port } = window.location;
  const dot = hostname.indexOf('.');
  if (dot <= 0) return '';
  const host = `${hostname.slice(0, dot)}-social${hostname.slice(dot)}`;
  return `${protocol}//${host}${port ? `:${port}` : ''}`;
}

// Las 36 redes que soporta Postiz. El identificador es el real de Postiz (comprobado en su
// código, no el nombre del archivo: p. ej. dev.to -> 'devto', farcaster -> 'wrapcast').
// 'mastodon-custom' no está: necesita la URL de la instancia (externalUrl), que la API
// pública de Postiz no soporta todavía (ver integration-social-connect) — se deja fuera
// hasta que haya un camino para pedir ese dato antes de conectar.
export const SOCIAL_PROVIDERS: ProviderInfo[] = [
  { provider: 'linkedin', label: 'LinkedIn (perfil)', kind: 'Red social', connect: 'social' },
  { provider: 'linkedin-page', label: 'LinkedIn (página de empresa)', kind: 'Red social', connect: 'social' },
  { provider: 'x', label: 'X', kind: 'Red social', connect: 'social' },
  { provider: 'facebook', label: 'Facebook', kind: 'Red social', connect: 'social' },
  { provider: 'instagram', label: 'Instagram', kind: 'Red social', connect: 'social' },
  { provider: 'instagram-standalone', label: 'Instagram (independiente)', kind: 'Red social', connect: 'social' },
  { provider: 'threads', label: 'Threads', kind: 'Red social', connect: 'social' },
  { provider: 'tiktok', label: 'TikTok', kind: 'Red social', connect: 'social' },
  { provider: 'tiktok-business', label: 'TikTok Business', kind: 'Red social', connect: 'social' },
  { provider: 'youtube', label: 'YouTube', kind: 'Red social', connect: 'social' },
  { provider: 'pinterest', label: 'Pinterest', kind: 'Red social', connect: 'social' },
  { provider: 'reddit', label: 'Reddit', kind: 'Red social', connect: 'social' },
  { provider: 'discord', label: 'Discord', kind: 'Red social', connect: 'social' },
  { provider: 'slack', label: 'Slack', kind: 'Red social', connect: 'social' },
  { provider: 'telegram', label: 'Telegram', kind: 'Red social', connect: 'social' },
  { provider: 'mastodon', label: 'Mastodon', kind: 'Red social', connect: 'social' },
  { provider: 'bluesky', label: 'Bluesky', kind: 'Red social', connect: 'social' },
  { provider: 'devto', label: 'DEV', kind: 'Red social', connect: 'social' },
  { provider: 'hashnode', label: 'Hashnode', kind: 'Red social', connect: 'social' },
  { provider: 'medium', label: 'Medium', kind: 'Red social', connect: 'social' },
  { provider: 'tumblr', label: 'Tumblr', kind: 'Red social', connect: 'social' },
  { provider: 'wordpress', label: 'WordPress', kind: 'Red social', connect: 'social' },
  { provider: 'vk', label: 'VK', kind: 'Red social', connect: 'social' },
  { provider: 'nostr', label: 'Nostr', kind: 'Red social', connect: 'social' },
  { provider: 'lemmy', label: 'Lemmy', kind: 'Red social', connect: 'social' },
  { provider: 'wrapcast', label: 'Farcaster', kind: 'Red social', connect: 'social' },
  { provider: 'kick', label: 'Kick', kind: 'Red social', connect: 'social' },
  { provider: 'twitch', label: 'Twitch', kind: 'Red social', connect: 'social' },
  { provider: 'dribbble', label: 'Dribbble', kind: 'Red social', connect: 'social' },
  { provider: 'gmb', label: 'Google Business', kind: 'Red social', connect: 'social' },
  { provider: 'mewe', label: 'MeWe', kind: 'Red social', connect: 'social' },
  { provider: 'moltbook', label: 'Moltbook', kind: 'Red social', connect: 'social' },
  { provider: 'skool', label: 'Skool', kind: 'Red social', connect: 'social' },
  { provider: 'whop', label: 'Whop', kind: 'Red social', connect: 'social' },
  { provider: 'listmonk', label: 'Listmonk', kind: 'Red social', connect: 'social' },
];
