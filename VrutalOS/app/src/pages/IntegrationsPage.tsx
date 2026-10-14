import { useState, type FormEvent } from 'react';
import {
  connectSocialProvider,
  listEnabledProviders,
  listIntegrations,
  saveIntegrationKey,
  saveSocialApp,
  setIntegrationPaused,
  type SyncedProvider,
} from '../lib/api/integrations';
import { errorMessage } from '../lib/api/client';
import { formatDate } from '../lib/format';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import {
  PROVIDERS,
  SOCIAL_APPS,
  SOCIAL_PROVIDERS,
  socialPublicBaseUrl,
  type ProviderInfo,
  type SocialAppInfo,
} from '../lib/providers';
import type { Integration } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import '../styles/pages/integrations.css';

/** Estado que se enseña, en palabras del cliente. El error va primero: es lo que hay que arreglar. */
function describe(row: Integration | undefined): { label: string; tone: 'ok' | 'warn' | 'bad' | 'pending'; detail: string | null } {
  if (!row) return { label: 'No conectada', tone: 'pending', detail: null };
  if (row.status === 'revoked') return { label: 'Revocada', tone: 'bad', detail: 'Hay que conectarla con una clave nueva.' };
  if (row.last_error) return { label: 'Error', tone: 'bad', detail: row.last_error };
  if (row.status === 'paused') return { label: 'En pausa', tone: 'warn', detail: null };
  return { label: 'Validada', tone: 'ok', detail: null };
}

const load = async (signal: AbortSignal) => {
  const [integrations, syncedProviders] = await Promise.all([
    listIntegrations(signal),
    listEnabledProviders(signal),
  ]);
  return { integrations, syncedProviders };
};

const CATEGORY_LABEL: Record<string, string> = { llm: 'Inteligencia artificial', crm: 'CRM' };

/**
 * Qué tarjetas de clave (no las sociales, ver D-06 nota en migración 025) se enseñan: una
 * por cada sistema que el Stack de este cliente en Vrutal1st habilitó. Si ya hay código a
 * medida en PROVIDERS (label, ayuda de dónde sacar la clave, prueba real), se usa; si no
 * — p. ej. un proveedor de LLM nuevo que solo existe como fila del Stack — se construye una
 * tarjeta genérica a partir de lo que llegó sincronizado, sin esperar a que alguien escriba
 * código para cada proveedor uno a uno. Las que ya están conectadas de antes nunca
 * desaparecen solas si alguien quita el sistema del Stack sin pensarlo.
 */
function visibleProviders(syncedProviders: SyncedProvider[], integrations: Integration[]): ProviderInfo[] {
  const cards: ProviderInfo[] = [];
  const seen = new Set<string>();
  for (const synced of syncedProviders) {
    const bespoke = PROVIDERS.find((p) => p.provider === synced.provider_key);
    cards.push(
      bespoke ?? {
        provider: synced.provider_key,
        label: synced.system_name,
        kind: CATEGORY_LABEL[synced.system_category] ?? synced.system_category,
        keyHelp: `Clave de API de ${synced.system_name}. Pégala tal cual la copies de su panel — no se comprueba contra su servidor todavía.`,
      },
    );
    seen.add(synced.provider_key);
  }
  for (const row of integrations) {
    if (seen.has(row.provider)) continue;
    const bespoke = PROVIDERS.find((p) => p.provider === row.provider);
    if (bespoke) {
      cards.push(bespoke);
      seen.add(row.provider);
    }
  }
  return cards;
}

export function IntegrationsPage() {
  const { state, reload, refresh } = useAsyncData(load);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function togglePause(row: Integration) {
    setBusy(true);
    setNotice(null);
    try {
      const done = await setIntegrationPaused(row.id, row.status !== 'paused');
      if (!done) setNotice({ kind: 'error', text: 'No se ha podido aplicar el cambio. Puede que no tengas permiso.' });
    } catch (err) {
      setNotice({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  return (
    <section>
      <PageHead crumbs={[{ label: 'Administración' }]} title="Integraciones" />
      <p className="notice notice--info" style={{ marginBottom: 'var(--space-5)' }}>
        Las claves se prueban antes de guardarse y se guardan cifradas. Una vez guardada, <strong>no se vuelve a mostrar</strong>:
        solo se puede sobrescribir.
      </p>

      {notice && (
        <p className={`notice notice--${notice.kind === 'ok' ? 'info' : 'error'}`} role={notice.kind === 'ok' ? 'status' : 'alert'} style={{ marginBottom: 'var(--space-4)' }}>
          {notice.text}
        </p>
      )}
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && (
        <>
          <div className="cards">
            {visibleProviders(state.data.syncedProviders, state.data.integrations).map((p) => {
              const row = state.data.integrations.find((r) => r.provider === p.provider);
              return (
                <IntegrationCard
                  key={p.provider}
                  info={p}
                  row={row}
                  editing={editing === p.provider}
                  busy={busy}
                  onEdit={() => {
                    setNotice(null);
                    setEditing(p.provider);
                  }}
                  onCancel={() => setEditing(null)}
                  onPause={() => row && togglePause(row)}
                  onSaved={() => {
                    setEditing(null);
                    setNotice({ kind: 'ok', text: `Clave de ${p.label} validada y guardada.` });
                    refresh();
                  }}
                  onFailed={refresh}
                />
              );
            })}
          </div>

          <h2 style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>Apps de redes sociales</h2>
          <p className="muted small" style={{ marginBottom: 'var(--space-4)' }}>
            Para publicar en una red hace falta una app de tu empresa en su portal de desarrolladores. La creas tú —
            publica con tu marca y en tu página— y aquí pegas sus credenciales. Antes, copia en el portal las URLs de
            redirección que te damos: sin ellas la autorización falla.
          </p>
          <div className="cards">
            {SOCIAL_APPS.map((app) => (
              <SocialAppCard
                key={app.network}
                app={app}
                row={state.data.integrations.find((r) => r.provider === `social-app:${app.network}`)}
                editing={editing === `social-app:${app.network}`}
                busy={busy}
                onEdit={() => {
                  setNotice(null);
                  setEditing(`social-app:${app.network}`);
                }}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  setNotice({
                    kind: 'ok',
                    text: `Credenciales de ${app.label} guardadas. Tardan hasta un minuto en activarse; después ya puedes conectar la cuenta.`,
                  });
                  refresh();
                }}
                onFailed={(text) => setNotice({ kind: 'error', text })}
              />
            ))}
          </div>

          <h2 style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>Redes sociales</h2>
          <p className="muted small" style={{ marginBottom: 'var(--space-4)' }}>
            "Conectar" abre una pestaña nueva para autorizar la cuenta real (LinkedIn, Discord…). No hay ninguna clave que pegar aquí.
          </p>
          <div className="cards">
            {SOCIAL_PROVIDERS.map((p) => {
              const row = state.data.integrations.find((r) => r.provider === p.provider);
              // Si esta conexión depende de una app que el cliente aún no ha configurado, no se
              // deja pulsar "Conectar": Postiz generaría una URL con un client_id vacío y
              // LinkedIn devolvería un error que no dice nada.
              const app = SOCIAL_APPS.find((a) => a.covers.includes(p.provider));
              const appMissing =
                app !== undefined &&
                !state.data.integrations.some(
                  (r) => r.provider === `social-app:${app.network}` && r.status === 'active',
                );
              return (
                <SocialIntegrationCard
                  key={p.provider}
                  info={p}
                  row={row}
                  busy={busy}
                  blockedBy={appMissing ? (app?.label ?? null) : null}
                  onPause={() => row && togglePause(row)}
                  onFailed={(text) => setNotice({ kind: 'error', text })}
                  setBusy={setBusy}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

interface IntegrationCardProps {
  info: ProviderInfo;
  row: Integration | undefined;
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onPause: () => void;
  onSaved: () => void;
  onFailed: () => void;
}

function IntegrationCard({ info, row, editing, busy, onEdit, onCancel, onPause, onSaved, onFailed }: IntegrationCardProps) {
  const status = describe(row);
  const connected = row !== undefined && row.status !== 'revoked';
  return (
    <article className="integ">
      <div className="integ__head">
        <span className="integ__avatar" aria-hidden="true">
          {info.label[0]}
        </span>
        <div>
          <h2 className="integ__name">{info.label}</h2>
          <span className="muted small">{info.kind}</span>
        </div>
      </div>
      <div>
        <span className={`pill pill--${status.tone}`}>{status.label}</span>
        {row?.validated_at && !row.last_error && <span className="muted small"> · {formatDate(row.validated_at)}</span>}
        {status.detail && <p className="integ__detail">{status.detail}</p>}
      </div>

      {editing ? (
        <KeyForm info={info} onCancel={onCancel} onSaved={onSaved} onFailed={onFailed} />
      ) : (
        <div className="integ__actions">
          <button
            type="button"
            className={`btn btn--sm ${status.tone === 'bad' || !row ? 'btn--primary' : 'btn--ghost'}`}
            onClick={onEdit}
            disabled={busy}
          >
            {row ? 'Sobrescribir clave' : 'Conectar'}
          </button>
          {connected && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onPause} disabled={busy}>
              {row.status === 'paused' ? 'Reanudar' : 'Pausar'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

interface KeyFormProps {
  info: ProviderInfo;
  onCancel: () => void;
  onSaved: () => void;
  onFailed: () => void;
}

function KeyForm({ info, onCancel, onSaved, onFailed }: KeyFormProps) {
  // La clave solo vive en este estado, y solo mientras el formulario está abierto.
  const [key, setKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await saveIntegrationKey(info.provider, key);
      setKey('');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
      onFailed(); // el servidor puede haber anotado el error en la integración
    }
  }

  return (
    <form className="integ__form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label className="form-field__label" htmlFor={`key-${info.provider}`}>
          Clave de {info.label}
        </label>
        <input
          id={`key-${info.provider}`}
          className="text-input"
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={submitting}
          required
        />
        <span className="form-field__hint">{info.keyHelp}</span>
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="integ__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={submitting || key.trim() === ''}>
          {submitting ? `Probando con ${info.label}…` : 'Probar y guardar'}
        </button>
      </div>
    </form>
  );
}

interface SocialIntegrationCardProps {
  info: ProviderInfo;
  row: Integration | undefined;
  busy: boolean;
  /** Nombre de la app que falta configurar, si esta conexión depende de una. */
  blockedBy: string | null;
  onPause: () => void;
  onFailed: (text: string) => void;
  setBusy: (busy: boolean) => void;
}

function SocialIntegrationCard({ info, row, busy, blockedBy, onPause, onFailed, setBusy }: SocialIntegrationCardProps) {
  const status = describe(row);
  const connected = row !== undefined && row.status !== 'revoked';

  async function handleConnect() {
    setBusy(true);
    try {
      const url = await connectSocialProvider(info.provider);
      // Pestaña nueva: el Admin autoriza ahí (LinkedIn, Discord…) y vuelve cuando quiera.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      onFailed(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="integ">
      <div className="integ__head">
        <span className="integ__avatar" aria-hidden="true">
          {info.label[0]}
        </span>
        <div>
          <h2 className="integ__name">{info.label}</h2>
          <span className="muted small">{info.kind}</span>
        </div>
      </div>
      <div>
        <span className={`pill pill--${status.tone}`}>{status.label}</span>
        {row?.validated_at && !row.last_error && <span className="muted small"> · {formatDate(row.validated_at)}</span>}
        {status.detail && <p className="integ__detail">{status.detail}</p>}
        {!connected && blockedBy !== null && (
          <p className="integ__detail">Configura antes la app de {blockedBy}, arriba.</p>
        )}
      </div>
      <div className="integ__actions">
        {!connected && (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={handleConnect}
            disabled={busy || blockedBy !== null}
          >
            Conectar
          </button>
        )}
        {connected && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onPause} disabled={busy}>
            {row.status === 'paused' ? 'Reanudar' : 'Pausar'}
          </button>
        )}
      </div>
    </article>
  );
}

interface SocialAppCardProps {
  app: SocialAppInfo;
  row: Integration | undefined;
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onFailed: (text: string) => void;
}

function SocialAppCard({ app, row, editing, busy, onEdit, onCancel, onSaved, onFailed }: SocialAppCardProps) {
  const base = socialPublicBaseUrl();
  const configured = row !== undefined && row.status === 'active';

  return (
    <article className="integ">
      <div className="integ__head">
        <span className="integ__avatar" aria-hidden="true">
          {app.label[0]}
        </span>
        <div>
          <h2 className="integ__name">App de {app.label}</h2>
          <span className="muted small">Credenciales de tu app</span>
        </div>
      </div>

      <div>
        <span className={`pill pill--${configured ? 'ok' : 'pending'}`}>
          {configured ? 'Configurada' : 'Sin configurar'}
        </span>
        {configured && row.validated_at && <span className="muted small"> · {formatDate(row.validated_at)}</span>}
        <p className="integ__detail">{app.help}</p>
      </div>

      <div>
        <h3 className="integ__name" style={{ fontSize: '0.95rem' }}>
          URLs de redirección
        </h3>
        {base === '' ? (
          <p className="integ__detail">
            No se puede calcular la URL pública de esta instancia desde aquí. Pídesela a Vrutal antes de crear la app:
            copiar una URL equivocada hace que la autorización falle sin explicar por qué.
          </p>
        ) : (
          <>
            <p className="muted small">Pega estas dos en el portal del proveedor, en el apartado de redirect URLs:</p>
            <ul className="integ__redirects">
              {app.redirectPaths.map((path) => (
                <li key={path}>
                  <code>{`${base}${path}`}</code>
                  <CopyButton value={`${base}${path}`} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {editing ? (
        <SocialAppForm app={app} onCancel={onCancel} onSaved={onSaved} onFailed={onFailed} />
      ) : (
        <div className="integ__actions">
          <button type="button" className="btn btn--sm btn--primary" onClick={onEdit} disabled={busy}>
            {configured ? 'Sustituir credenciales' : 'Pegar credenciales'}
          </button>
        </div>
      )}
    </article>
  );
}

/** El portapapeles puede no estar disponible (contexto no seguro, permiso denegado): en ese
 * caso no se finge que ha funcionado — la URL está ahí al lado para seleccionarla a mano. */
function CopyButton({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('done');
    } catch {
      setState('failed');
    }
  }

  return (
    <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
      {state === 'done' ? 'Copiada' : state === 'failed' ? 'Cópiala a mano' : 'Copiar'}
    </button>
  );
}

interface SocialAppFormProps {
  app: SocialAppInfo;
  onCancel: () => void;
  onSaved: () => void;
  onFailed: (text: string) => void;
}

function SocialAppForm({ app, onCancel, onSaved, onFailed }: SocialAppFormProps) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await saveSocialApp(app.network, clientId.trim(), clientSecret.trim());
      setClientId('');
      setClientSecret('');
      onSaved();
    } catch (err) {
      const text = errorMessage(err);
      setError(text);
      setSubmitting(false);
      onFailed(text);
    }
  }

  return (
    <form className="integ__form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label className="form-field__label" htmlFor={`app-id-${app.network}`}>
          {app.idLabel}
        </label>
        <input
          id={`app-id-${app.network}`}
          className="text-input"
          autoComplete="off"
          spellCheck={false}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={submitting}
          required
        />
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor={`app-secret-${app.network}`}>
          {app.secretLabel}
        </label>
        <input
          id={`app-secret-${app.network}`}
          className="text-input"
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          disabled={submitting}
          required
        />
        <span className="form-field__hint">
          Se guardan cifradas y no se vuelven a mostrar: solo se pueden sustituir. Tardan hasta un minuto en activarse.
        </span>
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="integ__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={submitting}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn--primary btn--sm"
          disabled={submitting || clientId.trim() === '' || clientSecret.trim() === ''}
        >
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
