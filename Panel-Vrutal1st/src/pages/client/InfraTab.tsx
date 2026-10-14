import { useCallback, useState, type FormEvent } from 'react';
import { getTenantInstance, listOnboardingSteps, saveTenantInstance, setOnboardingStep, setTenantPostizKey } from '../../lib/api/instance';
import { errorMessage } from '../../lib/api/client';
import { useAsyncData } from '../../lib/hooks/useAsyncData';
import { formatDate } from '../../lib/format';
import { ONBOARDING_STEPS } from '../../lib/instanceCopy';
import { ErrorNotice, LoadingState } from '../../components/StatusViews';
import { ExternalLink } from '../../components/ExternalLink';
import { PendingValue } from '../../components/Pending';
import type { OnboardingStep, TenantDetail, TenantInstance, TenantInstanceEditable } from '../../lib/types';
import '../../styles/pages/catalog.css';

const HEARTBEAT = 'Pendiente del latido de la instancia (LAB08 Anexo B, paso 6)';

const DATA_PLANE: Record<string, { label: string; tone: string }> = {
  active: { label: 'activo', tone: 'pill--ok' },
  not_provisioned: { label: 'sin aprovisionar', tone: 'pill--warn' },
};

const INSTANCE_FIELDS: { key: keyof TenantInstanceEditable; label: string; placeholder?: string }[] = [
  { key: 'public_url', label: 'URL del cliente', placeholder: 'https://lab.<dominio>' },
  { key: 'host', label: 'Servidor', placeholder: 'proveedor / host' },
  { key: 'template_version', label: 'Plantilla', placeholder: 'v0.1 o commit' },
  { key: 'ap_version', label: 'Activepieces', placeholder: '0.82.0' },
  { key: 'app_version', label: 'App VrutalOS', placeholder: '0.1.0' },
];

export function InfraTab({ tenant }: { tenant: TenantDetail }) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [instance, steps] = await Promise.all([
        getTenantInstance(tenant.id, signal),
        listOnboardingSteps(tenant.id, signal),
      ]);
      return { instance, steps };
    },
    [tenant.id],
  );
  const { state, reload, refresh } = useAsyncData(load);
  const plane = DATA_PLANE[tenant.data_plane_status ?? ''];

  return (
    <div className="info-sheet">
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && (
        <>
          <Checklist tenantId={tenant.id} steps={state.data.steps} onChanged={refresh} />
          <InstanceSection
            tenantId={tenant.id}
            instance={state.data.instance}
            canEdit={tenant.can_edit}
            onSaved={refresh}
          />
          <PostizKeySection
            tenantId={tenant.id}
            keySet={state.data.instance?.postiz_key_set ?? false}
            canEdit={tenant.can_edit}
            onSaved={refresh}
          />
        </>
      )}

      <section className="info-sheet__section">
        <h2 className="eyebrow">Datos del cliente · Supabase</h2>
        <dl className="info-sheet__grid">
          <div>
            <dt>Estado</dt>
            <dd>
              <span className={`pill ${plane?.tone ?? 'pill--warn'}`}>
                {plane?.label ?? tenant.data_plane_status ?? 'desconocido'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Proyecto</dt>
            <dd className="mono">{tenant.supabase_project_ref ?? '—'}</dd>
          </div>
          <div>
            <dt>Nombre</dt>
            <dd>{tenant.supabase_project_name ?? '—'}</dd>
          </div>
          <div>
            <dt>Región</dt>
            <dd className="mono">{tenant.supabase_project_region ?? '—'}</dd>
          </div>
          <div>
            <dt>Último latido</dt>
            <dd className="mono">
              <PendingValue hint={HEARTBEAT} />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

interface ChecklistProps {
  tenantId: string;
  steps: OnboardingStep[];
  onChanged: () => void;
}

/** Los 7 pasos de alta. Solo se puede marcar el siguiente, y nunca sin evidencia. */
function Checklist({ tenantId, steps, onChanged }: ChecklistProps) {
  const [evidence, setEvidence] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const done = steps.filter((s) => s.done_at).length;
  const next = steps.find((s) => s.can_complete);

  async function mark(step: OnboardingStep, isDone: boolean) {
    setSaving(true);
    setError(null);
    try {
      await setOnboardingStep(tenantId, step.step_key, isDone, isDone ? evidence : null);
      setEvidence('');
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="table-card">
      <div className="table-card__head role-sheet__head">
        <h2 className="table-card__title">Alta de la instancia · {done} de {steps.length}</h2>
        <span className="catalog-note">Orden fijo (LAB12). Ningún paso sin evidencia ni sin el anterior.</span>
      </div>
      <ol className="checklist">
        {steps.map((s) => {
          const copy = ONBOARDING_STEPS[s.step_key];
          const isNext = next?.step_key === s.step_key;
          return (
            <li key={s.step_key} className="checklist__step" data-state={s.done_at ? 'done' : isNext ? 'next' : 'todo'}>
              <span className="side-nav__step">{s.ord}</span>
              <div className="checklist__body">
                <span className="data-table__primary">{copy?.title ?? s.step_key}</span>
                <span className="catalog-note">{copy?.line}</span>
                {s.done_at && (
                  <span className="data-table__secondary">
                    {formatDate(s.done_at)} · {s.done_by_name ?? '—'} · {s.evidence}
                  </span>
                )}
                {isNext && (
                  <form
                    className="inline-form checklist__form"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      mark(s, true);
                    }}
                  >
                    <input
                      className="text-input"
                      placeholder={copy?.evidence ?? 'Evidencia'}
                      aria-label={`Evidencia de ${copy?.title ?? s.step_key}`}
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      required
                      minLength={3}
                    />
                    <button type="submit" className="btn btn--sm btn--primary" disabled={saving}>
                      Marcar hecho
                    </button>
                  </form>
                )}
              </div>
              {s.can_reopen && (
                <button type="button" className="btn-link" disabled={saving} onClick={() => mark(s, false)}>
                  reabrir
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {error !== null && (
        <p className="notice notice--error table-card__error" role="alert">
          {errorMessage(error)}
        </p>
      )}
    </section>
  );
}

interface InstanceSectionProps {
  tenantId: string;
  instance: TenantInstance | null;
  canEdit: boolean;
  onSaved: () => void;
}

function toDraft(i: TenantInstance | null): TenantInstanceEditable {
  return {
    host: i?.host ?? null,
    public_url: i?.public_url ?? null,
    template_version: i?.template_version ?? null,
    ap_version: i?.ap_version ?? null,
    app_version: i?.app_version ?? null,
    notes: i?.notes ?? null,
  };
}

/** Qué instancia tiene el cliente. Sin secretos: aquí no se guarda ninguna clave. */
function InstanceSection({ tenantId, instance, canEdit, onSaved }: InstanceSectionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TenantInstanceEditable>(() => toDraft(instance));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveTenantInstance(tenantId, draft);
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="table-card">
      <div className="table-card__head role-sheet__head">
        <h2 className="table-card__title">Instancia</h2>
        {canEdit && !editing && (
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => {
              setDraft(toDraft(instance));
              setEditing(true);
            }}
          >
            {instance ? 'Editar' : 'Registrar instancia'}
          </button>
        )}
      </div>

      {!editing ? (
        instance ? (
          <dl className="fields-grid">
            {INSTANCE_FIELDS.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd className="mono">
                  {f.key === 'public_url' && instance.public_url ? (
                    <ExternalLink url={instance.public_url} label={instance.public_url} />
                  ) : (
                    (instance[f.key] ?? '—')
                  )}
                </dd>
              </div>
            ))}
            {instance.notes && (
              <div className="fields-grid__wide">
                <dt>Notas</dt>
                <dd>{instance.notes}</dd>
              </div>
            )}
            <div className="fields-grid__wide">
              <dt>Última actualización</dt>
              <dd className="mono">
                {formatDate(instance.updated_at)} · {instance.updated_by_name ?? '—'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="table-card__foot catalog-note">
            Sin instancia registrada. Un cliente es una instancia Docker con URL propia (LAB08 Anexo B).
          </p>
        )
      ) : (
        <form className="fields-grid" onSubmit={save}>
          {INSTANCE_FIELDS.map((f) => (
            <label key={f.key} className="inline-field">
              {f.label}
              <input
                className="text-input"
                type={f.key === 'public_url' ? 'url' : 'text'}
                placeholder={f.placeholder}
                value={draft[f.key] ?? ''}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value || null })}
              />
            </label>
          ))}
          <label className="inline-field fields-grid__wide">
            Notas (nunca secretos)
            <textarea
              className="text-input"
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })}
            />
          </label>
          {error !== null && (
            <p className="notice notice--error fields-grid__wide" role="alert">
              {errorMessage(error)}
            </p>
          )}
          <div className="inline-form fields-grid__wide">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

interface PostizKeySectionProps {
  tenantId: string;
  keySet: boolean;
  canEdit: boolean;
  onSaved: () => void;
}

/** La API key de la instancia de Postiz de este cliente. Solo el staff la pone — el cliente
 * nunca la gestiona ni la ve desde VrutalOS (decisión 2026-10-10, migración 025). Igual que
 * secret_ref en integrations: una vez guardada, no se vuelve a leer en claro, solo se sobrescribe. */
function PostizKeySection({ tenantId, keySet, canEdit, onSaved }: PostizKeySectionProps) {
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await setTenantPostizKey(tenantId, key.trim());
      setKey('');
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="table-card">
      <div className="table-card__head role-sheet__head">
        <h2 className="table-card__title">Postiz (redes sociales)</h2>
        {canEdit && !editing && (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditing(true)}>
            {keySet ? 'Sobrescribir clave' : 'Poner clave'}
          </button>
        )}
      </div>
      {!editing ? (
        <p className="table-card__foot catalog-note">
          {keySet
            ? 'Clave guardada. No se vuelve a mostrar — solo se sobrescribe.'
            : 'Sin clave todavía. El cliente no la gestiona ni la ve desde VrutalOS.'}
        </p>
      ) : (
        <form className="inline-form" onSubmit={save}>
          <input
            className="text-input"
            type="password"
            autoComplete="new-password"
            placeholder="API key de la instancia de Postiz"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={saving}
            required
          />
          {error !== null && (
            <p className="notice notice--error" role="alert">
              {errorMessage(error)}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--sm" disabled={saving || !key.trim()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(false)} disabled={saving}>
            Cancelar
          </button>
        </form>
      )}
    </section>
  );
}
