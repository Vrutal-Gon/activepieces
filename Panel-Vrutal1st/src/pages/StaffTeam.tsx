import { useCallback, useState, type FormEvent } from 'react';
import { inviteStaff, listPlatformRoles, listStaff } from '../lib/api/staff';
import { errorMessage } from '../lib/api/client';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import type { PlatformRole } from '../lib/types';
import '../styles/pages/catalog.css';

export function StaffTeam() {
  const loadStaff = useCallback((signal: AbortSignal) => listStaff(signal), []);
  const staff = useAsyncData(loadStaff);
  const loadRoles = useCallback((signal: AbortSignal) => listPlatformRoles(signal), []);
  const roles = useAsyncData(loadRoles);

  const roleName = (key: string) =>
    roles.state.status === 'ready' ? (roles.state.data.find((r) => r.key === key)?.name ?? key) : key;

  return (
    <section className="catalog-stack">
      <PageHead crumbs={[{ label: 'Administración' }]} title="Equipo Vrutal" />

      {roles.state.status === 'loading' && <LoadingState />}
      {roles.state.status === 'error' && <ErrorNotice error={roles.state.error} onRetry={roles.reload} />}
      {roles.state.status === 'ready' && <InviteForm roles={roles.state.data} onInvited={staff.reload} />}

      {staff.state.status === 'loading' && <LoadingState />}
      {staff.state.status === 'error' && <ErrorNotice error={staff.state.error} onRetry={staff.reload} />}
      {staff.state.status === 'ready' && (
        <section className="table-card">
          <div className="table-card__head">
            <h2 className="table-card__title">Miembros</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
              </tr>
            </thead>
            <tbody>
              {staff.state.data.map((m) => (
                <tr key={m.profile_id}>
                  <td>
                    <span className="data-table__primary">{m.full_name || '—'}</span>
                    <span className="data-table__secondary">{m.email}</span>
                  </td>
                  <td>{m.role_keys.map(roleName).join(' · ')}</td>
                  <td>
                    {m.last_sign_in_at ? (
                      <span className={`pill ${m.status === 'active' ? 'pill--ok' : ''}`}>{m.status}</span>
                    ) : (
                      <span className="pill pill--pending">invitado</span>
                    )}
                  </td>
                  <td className="mono">
                    {m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleString() : 'nunca'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </section>
  );
}

interface InviteFormProps {
  roles: PlatformRole[];
  onInvited: () => void;
}

function InviteForm({ roles, onInvited }: InviteFormProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const selectedRole = roles.find((r) => r.key === roleKey);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSentTo(null);
    try {
      await inviteStaff({ email, fullName, roleKey });
      setSentTo(email);
      setEmail('');
      setFullName('');
      setRoleKey('');
      onInvited();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="table-card" onSubmit={handleSubmit}>
      <div className="table-card__head">
        <h2 className="table-card__title">Invitar a una persona</h2>
        <p className="catalog-note">
          Recibirá un correo para crear su contraseña. No hay registro público: solo entra quien invitas aquí.
        </p>
      </div>
      <div className="fields-grid">
        <label className="inline-field">
          Nombre completo
          <input
            className="text-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            maxLength={120}
          />
        </label>
        <label className="inline-field">
          Correo
          <input
            className="text-input"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="inline-field">
          Rol
          <select className="text-input" value={roleKey} onChange={(e) => setRoleKey(e.target.value)} required>
            <option value="">— elegir —</option>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {selectedRole && (
          <p className="catalog-note fields-grid__wide">
            Puede: {selectedRole.permission_keys.length > 0 ? selectedRole.permission_keys.join(', ') : 'nada todavía'}
          </p>
        )}
        {error !== null && (
          <p className="notice notice--error fields-grid__wide" role="alert">
            {errorMessage(error)}
          </p>
        )}
        {sentTo && (
          <p className="notice notice--info fields-grid__wide" role="status">
            Invitación enviada a <strong>{sentTo}</strong>.
          </p>
        )}
      </div>
      <div className="table-card__foot">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Enviar invitación'}
        </button>
      </div>
    </form>
  );
}
