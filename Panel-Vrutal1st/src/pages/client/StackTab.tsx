import { useCallback, useState } from 'react';
import {
  listSystemOptions,
  listTenantStack,
  removeTenantStackChoice,
  setTenantStackChoice,
} from '../../lib/api/tenants';
import { errorMessage } from '../../lib/api/client';
import { useAsyncData } from '../../lib/hooks/useAsyncData';
import { ErrorNotice, LoadingState } from '../../components/StatusViews';
import type { TenantStackChoice } from '../../lib/types';

/** Qué enseña Vrutal1st del lado de VrutalOS: solo lectura, nunca la clave en sí. */
function describeConfig(s: TenantStackChoice): { label: string; tone: 'ok' | 'warn' | 'bad' | 'pending' } | null {
  if (!s.provider_key) return null; // solo informativo, no hay nada que configurar en VrutalOS
  if (!s.integration_status) return { label: 'No configurada todavía', tone: 'pending' };
  if (s.integration_last_error) return { label: `Error: ${s.integration_last_error}`, tone: 'bad' };
  if (s.integration_status === 'revoked') return { label: 'Revocada', tone: 'bad' };
  if (s.integration_status === 'paused') return { label: 'En pausa', tone: 'warn' };
  return { label: 'Configurada y validada', tone: 'ok' };
}

export function StackTab({ tenantId }: { tenantId: string }) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [stack, options] = await Promise.all([listTenantStack(tenantId, signal), listSystemOptions(signal)]);
      return { stack, options };
    },
    [tenantId],
  );
  const { state, reload, refresh } = useAsyncData(load);
  const [pickCategory, setPickCategory] = useState('');
  const [pickOptionId, setPickOptionId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorNotice error={state.error} onRetry={reload} />;

  const { stack, options } = state.data;
  const categories = Array.from(new Set(options.map((o) => o.system_category))).sort();
  const filteredOptions = pickCategory ? options.filter((o) => o.system_category === pickCategory) : options;

  async function run(action: () => Promise<unknown>) {
    setSaving(true);
    setSaveError(null);
    try {
      await action();
      refresh();
    } catch (e) {
      setSaveError(e);
    } finally {
      setSaving(false);
    }
  }

  function add() {
    const option = options.find((o) => o.id === pickOptionId);
    if (!option) return;
    run(async () => {
      await setTenantStackChoice(tenantId, option);
      setPickOptionId('');
    });
  }

  return (
    <>
      <p className="client__summary">
        Qué sistemas usa el cliente, por categoría — una categoría puede tener varios (p. ej. varios proveedores de
        LLM a la vez, no uno excluyente). Determina qué componente se despliega en cada tarea de sus especialistas.
        Si su sistema no aparece, añádelo antes en <strong>Stack / Sistemas</strong>.
      </p>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Sistema</th>
              <th>Configuración en VrutalOS</th>
              <th>
                <span className="visually-hidden">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {stack.map((s) => {
              const config = describeConfig(s);
              return (
              <tr key={s.system_option_id}>
                <td className="eyebrow">{s.system_category}</td>
                <td>
                  <span className="data-table__primary">{s.system_name}</span>
                  {s.version && <span className="data-table__secondary">{s.version}</span>}
                </td>
                <td>
                  {config ? <span className={`pill pill--${config.tone}`}>{config.label}</span> : <span className="muted small">—</span>}
                </td>
                <td className="data-table__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={saving}
                    onClick={() => run(() => removeTenantStackChoice(tenantId, s.system_option_id))}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
              );
            })}
            {stack.length === 0 && (
              <tr>
                <td colSpan={4} className="data-table__empty">
                  Sin stack definido todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="table-card__foot">
          <label className="inline-field">
            <span>Categoría</span>
            <select
              value={pickCategory}
              onChange={(e) => {
                setPickCategory(e.target.value);
                setPickOptionId('');
              }}
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>Sistema</span>
            <select value={pickOptionId} onChange={(e) => setPickOptionId(e.target.value)}>
              <option value="">— elegir —</option>
              {filteredOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  [{o.system_category}] {o.name}
                  {o.version ? ` (${o.version})` : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--primary" onClick={add} disabled={!pickOptionId || saving}>
            Añadir
          </button>
        </div>
        {saveError !== null && (
          <p className="notice notice--error table-card__error" role="alert">
            {errorMessage(saveError)}
          </p>
        )}
      </div>
    </>
  );
}
