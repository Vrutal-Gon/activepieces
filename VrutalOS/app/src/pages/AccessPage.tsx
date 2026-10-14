import { useState } from 'react';
import { accessKey, listAccess, setAccess } from '../lib/api/access';
import { errorMessage } from '../lib/api/client';
import { listSpecialists } from '../lib/api/specialists';
import { listTeam } from '../lib/api/team';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import type { Profile } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import '../styles/pages/access.css';

async function loadAccess(signal: AbortSignal) {
  const [team, specialists, access] = await Promise.all([listTeam(signal), listSpecialists(signal), listAccess(signal)]);
  return {
    // Las cuentas desactivadas no usan nada: no tiene sentido habilitarles especialistas.
    members: team.filter((m) => m.is_active),
    specialists: specialists.filter((s) => s.status !== 'retired'),
    access,
  };
}

export function AccessPage({ profile }: { profile: Profile }) {
  const { state, reload, refresh } = useAsyncData(loadAccess);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function toggle(profileId: string, specialistId: string, enabled: boolean) {
    const key = accessKey(profileId, specialistId);
    setBusyKey(key);
    setNotice(null);
    try {
      const done = await setAccess(profileId, specialistId, enabled, profile.id);
      if (!done) setNotice('No se ha podido aplicar el cambio. Puede que no tengas permiso para hacerlo.');
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setBusyKey(null);
      refresh(); // siempre se vuelve a leer: la pantalla enseña lo que hay en el servidor, no lo que se esperaba
    }
  }

  return (
    <section>
      <PageHead crumbs={[{ label: 'Administración' }]} title="Accesos a especialistas" />
      <p className="lead">
        Marca qué especialistas puede usar cada persona. Los administradores ven siempre todos. Los cambios se guardan
        al marcar.
      </p>

      {notice && (
        <p className="notice notice--error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {notice}
        </p>
      )}
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && state.data.specialists.length === 0 && (
        <div className="empty-state">
          <h2 className="empty-state__title">Todavía no hay especialistas</h2>
          <p className="empty-state__body">Cuando Vrutal active el primero, podrás habilitarlo aquí.</p>
        </div>
      )}
      {state.status === 'ready' && state.data.specialists.length > 0 && (
        <div className="table-card">
          <table className="data-table matrix">
            <thead>
              <tr>
                <th>Persona</th>
                {state.data.specialists.map((s) => (
                  <th key={s.id}>{s.display_name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.data.members.map((m) => {
                const label = m.full_name || m.email || 'Sin nombre';
                const isAdmin = m.role === 'client_admin';
                return (
                  <tr key={m.id}>
                    <td>
                      <span className="data-table__primary">{label}</span>
                      <span className="data-table__secondary">{isAdmin ? 'Administrador · ve todos' : (m.email ?? '')}</span>
                    </td>
                    {state.data.specialists.map((s) => {
                      const key = accessKey(m.id, s.id);
                      return (
                        <td key={s.id}>
                          <input
                            type="checkbox"
                            className="check"
                            aria-label={`${label} · ${s.display_name}`}
                            checked={isAdmin || state.data.access.has(key)}
                            disabled={isAdmin || busyKey !== null}
                            onChange={(e) => toggle(m.id, s.id, e.target.checked)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
