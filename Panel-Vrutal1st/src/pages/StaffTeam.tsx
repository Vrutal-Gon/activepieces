import { useCallback, useState, type FormEvent } from 'react';
import { inviteStaff, listPlatformRoles, listStaff } from '../lib/api/staff';
import { errorMessage } from '../lib/api/client';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import type { PlatformRole } from '../lib/types';

export function StaffTeam() {
  const loadStaff = useCallback((signal: AbortSignal) => listStaff(signal), []);
  const staff = useAsyncData(loadStaff);
  const loadRoles = useCallback((signal: AbortSignal) => listPlatformRoles(signal), []);
  const roles = useAsyncData(loadRoles);

  const roleName = (key: string) =>
    roles.state.status === 'ready' ? (roles.state.data.find((r) => r.key === key)?.name ?? key) : key;

  return (
    <div className="panel">
      <header className="page-header">
        <span className="eyebrow">Administración</span>
        <h1 className="page-header__title">Equipo Vrutal</h1>
      </header>

      {roles.state.status === 'loading' && <LoadingState />}
      {roles.state.status === 'error' && <ErrorNotice error={roles.state.error} onRetry={roles.reload} />}
      {roles.state.status === 'ready' && <InviteForm roles={roles.state.data} onInvited={staff.reload} />}

      <h3>Miembros</h3>
      {staff.state.status === 'loading' && <LoadingState />}
      {staff.state.status === 'error' && <ErrorNotice error={staff.state.error} onRetry={staff.reload} />}
      {staff.state.status === 'ready' && (
        <table className="linked-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Último acceso</th>
            </tr>
          </thead>
          <tbody>
            {staff.state.data.map((m) => (
              <tr key={m.profile_id}>
                <td>{m.full_name || '—'}</td>
                <td>{m.email}</td>
                <td>{m.role_keys.map(roleName).join(' · ')}</td>
                <td>
                  <span className="badge">{m.last_sign_in_at ? m.status : 'invitado'}</span>
                </td>
                <td>{m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleString() : 'nunca'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
    <form className="role-card" onSubmit={handleSubmit}>
      <div className="role-card-header">
        <h2>Invitar a una persona</h2>
      </div>
      <p className="task-summary">
        Recibirá un correo para crear su contraseña. No hay registro público: solo entra quien invitas aquí.
      </p>
      <div className="role-fields-edit">
        <label>
          Nombre completo
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />
        </label>
        <label>
          Correo
          <input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="full-width">
          Rol
          <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} required>
            <option value="">— elegir —</option>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {selectedRole && (
        <p className="task-summary">
          Puede: {selectedRole.permission_keys.length > 0 ? selectedRole.permission_keys.join(', ') : 'nada todavía'}
        </p>
      )}
      {error !== null && <p className="error">{errorMessage(error)}</p>}
      {sentTo && (
        <p className="task-summary" role="status">
          Invitación enviada a <strong>{sentTo}</strong>.
        </p>
      )}
      <button type="submit" className="btn btn--primary" disabled={submitting}>
        {submitting ? 'Enviando…' : 'Enviar invitación'}
      </button>
    </form>
  );
}
