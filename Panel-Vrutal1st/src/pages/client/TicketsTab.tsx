import { useCallback, useState, type FormEvent } from 'react';
import { listTicketMessages, listTickets, replyTicket, setTicketStatus } from '../../lib/api/tickets';
import { errorMessage } from '../../lib/api/client';
import { formatDate } from '../../lib/format';
import { useAsyncData } from '../../lib/hooks/useAsyncData';
import { ErrorNotice, LoadingState } from '../../components/StatusViews';
import type { StaffTicketRow, TicketStatus } from '../../lib/types';
import '../../styles/pages/catalog.css';

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};
const STATUS_TONE: Record<TicketStatus, string> = {
  open: 'pill--warn',
  in_progress: 'pill--pending',
  resolved: 'pill--ok',
  closed: '',
};

export function TicketsTab({ tenantId, canEdit }: { tenantId: string; canEdit: boolean }) {
  const [selected, setSelected] = useState<StaffTicketRow | null>(null);
  const load = useCallback((signal: AbortSignal) => listTickets(tenantId, null, signal), [tenantId]);
  const { state, reload, refresh } = useAsyncData(load);

  if (selected) {
    return (
      <TicketDetail
        ticket={selected}
        canEdit={canEdit}
        onBack={() => {
          setSelected(null);
          refresh();
        }}
      />
    );
  }

  return (
    <section className="table-card">
      <div className="table-card__head role-sheet__head">
        <h2 className="table-card__title">Tickets</h2>
        <span className="catalog-note">Lo reporta el Admin del cliente desde VrutalOS. Vive centralizado aquí (023), no en su base.</span>
      </div>
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && state.data.length === 0 && (
        <p className="table-card__foot catalog-note">Sin tickets todavía.</p>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Asunto</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Reportado por</th>
              <th>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {state.data.map((t) => (
              <tr key={t.id} className="data-table__row--clickable" onClick={() => setSelected(t)}>
                <td>
                  <span className="data-table__primary">{t.subject}</span>
                </td>
                <td>
                  <span className={`pill ${STATUS_TONE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                </td>
                <td>{t.priority}</td>
                <td>{t.created_by_label}</td>
                <td className="mono">{formatDate(t.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

interface TicketDetailProps {
  ticket: StaffTicketRow;
  canEdit: boolean;
  onBack: () => void;
}

function TicketDetail({ ticket, canEdit, onBack }: TicketDetailProps) {
  const load = useCallback((signal: AbortSignal) => listTicketMessages(ticket.id, signal), [ticket.id]);
  const { state, reload, refresh } = useAsyncData(load);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await replyTicket(ticket.id, reply.trim());
      setReply('');
      refresh();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(next: TicketStatus) {
    setSaving(true);
    setError(null);
    try {
      await setTicketStatus(ticket.id, next);
      setStatus(next);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="table-card">
      <div className="table-card__head role-sheet__head">
        <button type="button" className="btn-link" onClick={onBack}>
          ← Volver a Tickets
        </button>
      </div>
      <h2 className="table-card__title">{ticket.subject}</h2>
      <p className="catalog-note">
        Reportado por {ticket.created_by_label} · {formatDate(ticket.created_at)}
      </p>

      <div className="inline-field" style={{ maxWidth: '16rem' }}>
        Estado
        <select
          className="text-input"
          value={status}
          disabled={!canEdit || saving}
          onChange={(e) => handleStatus(e.target.value as TicketStatus)}
        >
          {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && (
        <ul className="checklist">
          {state.data.map((m) => (
            <li key={m.id} className="checklist__step" data-state={m.author_kind === 'staff' ? 'done' : 'todo'}>
              <div className="checklist__body">
                <span className="data-table__primary">{m.author_kind === 'staff' ? m.author_label : 'Cliente'}</span>
                <span className="data-table__secondary">{m.body}</span>
                <span className="catalog-note">{formatDate(m.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error !== null && (
        <p className="notice notice--error table-card__error" role="alert">
          {errorMessage(error)}
        </p>
      )}

      {canEdit && (
        <form className="inline-form" onSubmit={handleReply} style={{ marginTop: 'var(--space-4)' }}>
          <textarea
            className="text-input"
            rows={3}
            placeholder="Responder al cliente…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={saving}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn--primary" disabled={saving || !reply.trim()}>
            {saving ? 'Enviando…' : 'Responder'}
          </button>
        </form>
      )}
    </section>
  );
}
