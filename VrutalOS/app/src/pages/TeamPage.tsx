import { useCallback, useState, type FormEvent } from 'react';
import { inviteMember, listTeam, setMemberActive, setMemberRole } from '../lib/api/team';
import { errorMessage } from '../lib/api/client';
import { formatDate } from '../lib/format';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import type { Profile, ProfileRole, TeamMember } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import '../styles/pages/team.css';

const ROLE_LABEL: Record<ProfileRole, string> = {
  client_admin: 'Administrador',
  client_manager: 'Manager',
  client_user: 'Usuario',
};

// Un cambio a la espera de confirmación. Tocar el rol y desactivar cuentas
// afectan a toda la empresa, así que nunca se aplican con un solo clic.
type Pending = { id: string; kind: 'role'; role: ProfileRole } | { id: string; kind: 'active'; active: boolean };

function pendingQuestion(p: Pending, name: string): string {
  if (p.kind === 'role') {
    return `¿Pasar a ${name} a ${ROLE_LABEL[p.role]}?`;
  }
  return p.active ? `¿Reactivar a ${name}?` : `¿Desactivar a ${name}? Perderá el acceso.`;
}

const displayName = (m: TeamMember) => m.full_name || m.email || 'esta persona';

interface InviteFormProps {
  onCancel: () => void;
  onInvited: (email: string) => void;
}

function InviteForm({ onCancel, onInvited }: InviteFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProfileRole>('client_user');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await inviteMember({ email: email.trim(), fullName: fullName.trim(), role });
      onInvited(email.trim());
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <form className="card invite" onSubmit={handleSubmit}>
      <div className="card__head">
        <h2 className="card__title">Invitar a una persona</h2>
      </div>
      <div className="card__body invite__body">
        <div className="form-field">
          <label className="form-field__label" htmlFor="invite-name">
            Nombre
          </label>
          <input
            id="invite-name"
            className="text-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={120}
            autoComplete="off"
            required
          />
        </div>
        <div className="form-field">
          <label className="form-field__label" htmlFor="invite-email">
            Correo
          </label>
          <input
            id="invite-email"
            className="text-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            required
          />
          <span className="form-field__hint">Solo correos del dominio de tu empresa.</span>
        </div>
        <div className="form-field">
          <label className="form-field__label" htmlFor="invite-role">
            Rol
          </label>
          <select
            id="invite-role"
            className="text-input"
            value={role}
            onChange={(e) => setRole(e.target.value as ProfileRole)}
          >
            <option value="client_user">{ROLE_LABEL.client_user}</option>
            <option value="client_manager">{ROLE_LABEL.client_manager}</option>
            <option value="client_admin">{ROLE_LABEL.client_admin}</option>
          </select>
        </div>
      </div>
      {role === 'client_admin' && (
        <p className="notice notice--info invite__warn">
          Un administrador puede gestionar el equipo, las integraciones y todo lo de la empresa.
        </p>
      )}
      {role === 'client_manager' && (
        <p className="notice notice--info invite__warn">
          Un manager puede editar el perfil de la empresa (competidores, estrategia de precio...), pero no gestiona el equipo ni las integraciones.
        </p>
      )}
      {error && (
        <p className="notice notice--error invite__warn" role="alert">
          {error}
        </p>
      )}
      <div className="invite__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Enviar invitación'}
        </button>
      </div>
    </form>
  );
}

export function TeamPage({ profile }: { profile: Profile }) {
  const load = useCallback((signal: AbortSignal) => listTeam(signal), []);
  const { state, reload, refresh } = useAsyncData(load);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setNotice(null);
    setSentTo(null);
    try {
      const done =
        pending.kind === 'role'
          ? await setMemberRole(pending.id, pending.role)
          : await setMemberActive(pending.id, pending.active);
      // El servidor bloquea en silencio si no hay permiso: 0 filas, sin error.
      if (!done) setNotice('No se ha podido aplicar el cambio. Puede que no tengas permiso para hacerlo.');
      setPending(null);
      refresh();
    } catch (err) {
      setNotice(errorMessage(err));
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <PageHead crumbs={[{ label: 'Administración' }]} title="Equipo">
        {!inviting && (
          <button type="button" className="btn btn--primary" onClick={() => setInviting(true)}>
            Invitar persona
          </button>
        )}
      </PageHead>
      <p className="lead">Las personas de tu empresa con acceso a VrutalOS.</p>

      {inviting && (
        <InviteForm
          onCancel={() => setInviting(false)}
          onInvited={(email) => {
            setInviting(false);
            setSentTo(email);
            refresh();
          }}
        />
      )}
      {sentTo && (
        <p className="notice notice--info" role="status" style={{ marginBottom: 'var(--space-4)' }}>
          Invitación enviada a <strong>{sentTo}</strong>. Recibirá un correo para crear su contraseña.
        </p>
      )}
      {notice && (
        <p className="notice notice--error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {notice}
        </p>
      )}
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && state.data.length === 0 && (
        <div className="empty-state">
          <h2 className="empty-state__title">No hay equipo que mostrar</h2>
          <p className="empty-state__body">Solo un administrador activo puede ver esta lista.</p>
        </div>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.data.map((m) => {
                const isMe = m.id === profile.id;
                const mine = pending?.id === m.id ? pending : null;
                const shownRole = mine?.kind === 'role' ? mine.role : m.role;
                return (
                  <tr key={m.id}>
                    <td>
                      <span className="data-table__primary">
                        {m.full_name || m.email || 'Sin nombre'}
                        {isMe && ' (tú)'}
                      </span>
                      {m.full_name && m.email && <span className="data-table__secondary">{m.email}</span>}
                    </td>
                    <td>
                      <select
                        className="text-input team-role"
                        aria-label={`Rol de ${displayName(m)}`}
                        value={shownRole}
                        disabled={isMe || busy}
                        onChange={(e) => setPending({ id: m.id, kind: 'role', role: e.target.value as ProfileRole })}
                      >
                        <option value="client_user">{ROLE_LABEL.client_user}</option>
                        <option value="client_manager">{ROLE_LABEL.client_manager}</option>
                        <option value="client_admin">{ROLE_LABEL.client_admin}</option>
                      </select>
                      {isMe && <span className="data-table__secondary">No puedes cambiar tu propio rol</span>}
                    </td>
                    <td>
                      <span className={`pill ${m.is_active ? 'pill--ok' : ''}`}>{m.is_active ? 'Activo' : 'Desactivado'}</span>
                    </td>
                    <td className="mono">{formatDate(m.last_sign_in_at)}</td>
                    <td className="data-table__actions">
                      {mine ? (
                        <span className="team-confirm">
                          <span>{pendingQuestion(mine, displayName(m))}</span>
                          <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={confirm}>
                            {busy ? 'Guardando…' : 'Confirmar'}
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setPending(null)}>
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        !isMe && (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setPending({ id: m.id, kind: 'active', active: !m.is_active })}
                          >
                            {m.is_active ? 'Desactivar' : 'Reactivar'}
                          </button>
                        )
                      )}
                    </td>
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
