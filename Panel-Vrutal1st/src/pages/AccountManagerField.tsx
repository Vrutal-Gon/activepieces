import { useCallback, useState } from 'react';
import { listStaff, setTenantAccountManager } from '../lib/api/staff';
import { errorMessage } from '../lib/api/client';
import { useAsyncData } from '../lib/hooks/useAsyncData';

interface AccountManagerFieldProps {
  tenantId: string;
  currentProfileId: string | null;
  onChanged: () => void;
}

export function AccountManagerField({ tenantId, currentProfileId, onChanged }: AccountManagerFieldProps) {
  const load = useCallback((signal: AbortSignal) => listStaff(signal), []);
  const { state } = useAsyncData(load);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  async function handleChange(value: string) {
    setSaving(true);
    setSaveError(null);
    try {
      await setTenantAccountManager(tenantId, value || null);
      onChanged(); // la fuente de verdad es el servidor
    } catch (e) {
      setSaveError(e);
    } finally {
      setSaving(false);
    }
  }

  if (state.status === 'loading') return <span className="field-value">Cargando…</span>;
  if (state.status === 'error') return <span className="error">{errorMessage(state.error)}</span>;

  return (
    <>
      <select
        aria-label="Gestor de cuenta"
        value={currentProfileId ?? ''}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">Sin asignar</option>
        {state.data.map((m) => (
          <option key={m.profile_id} value={m.profile_id}>
            {m.full_name || m.email}
          </option>
        ))}
      </select>
      {saveError !== null && <span className="error">{errorMessage(saveError)}</span>}
    </>
  );
}
