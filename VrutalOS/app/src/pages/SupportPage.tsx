import { useCallback, useState, type FormEvent } from 'react';
import { createTicket, getTicketThread, listTickets, replyTicket } from '../lib/api/support';
import { errorMessage } from '../lib/api/client';
import { formatDateTime } from '../lib/format';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import type { Ticket, TicketPriority, TicketStatus } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import '../styles/pages/support.css';

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};
const STATUS_TONE: Record<TicketStatus, 'ok' | 'warn' | 'bad' | 'pending'> = {
  open: 'warn',
  in_progress: 'pending',
  resolved: 'ok',
  closed: 'bad',
};
const PRIORITY_LABEL: Record<TicketPriority, string> = { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };

type View = { kind: 'list' } | { kind: 'create' } | { kind: 'detail'; ticket: Ticket };

export function SupportPage() {
  const [view, setView] = useState<View>({ kind: 'list' });
  const loadTickets = useCallback(() => listTickets(), []);
  const { state, reload, refresh } = useAsyncData(loadTickets);

  return (
    <section>
      <PageHead crumbs={[{ label: 'Ayuda' }]} title="Soporte">
        {view.kind === 'list' && (
          <button type="button" className="btn btn--primary" onClick={() => setView({ kind: 'create' })}>
            Nuevo ticket
          </button>
        )}
      </PageHead>
      <p className="lead">Lo que reportas aquí lo gestiona el equipo de Vrutal. Vuelve a esta pantalla para ver sus respuestas.</p>

      {view.kind === 'create' && (
        <CreateTicketForm
          onCancel={() => setView({ kind: 'list' })}
          onCreated={() => {
            setView({ kind: 'list' });
            refresh();
          }}
        />
      )}

      {view.kind === 'detail' && (
        <TicketThread
          ticket={view.ticket}
          onBack={() => {
            setView({ kind: 'list' });
            refresh();
          }}
        />
      )}

      {view.kind === 'list' && (
        <>
          {state.status === 'loading' && <LoadingState />}
          {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
          {state.status === 'ready' && state.data.length === 0 && (
            <div className="empty-state">
              <h2 className="empty-state__title">No tienes tickets todavía</h2>
              <p className="empty-state__body">Cuando necesites ayuda, crea uno con "Nuevo ticket".</p>
            </div>
          )}
          {state.status === 'ready' && state.data.length > 0 && (
            <div className="table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Asunto</th>
                    <th>Estado</th>
                    <th>Prioridad</th>
                    <th>Última actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.map((t) => (
                    <tr key={t.id} className="data-table__row--clickable" onClick={() => setView({ kind: 'detail', ticket: t })}>
                      <td>
                        <span className="data-table__primary">{t.subject}</span>
                      </td>
                      <td>
                        <span className={`pill pill--${STATUS_TONE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                      </td>
                      <td>{PRIORITY_LABEL[t.priority]}</td>
                      <td>{formatDateTime(t.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

interface CreateTicketFormProps {
  onCancel: () => void;
  onCreated: () => void;
}

function CreateTicketForm({ onCancel, onCreated }: CreateTicketFormProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createTicket(subject.trim(), body.trim(), priority);
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <form className="support-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label className="form-field__label" htmlFor="ticket-subject">
          Asunto
        </label>
        <input
          id="ticket-subject"
          className="text-input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={submitting}
          maxLength={254}
          required
        />
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="ticket-priority">
          Prioridad
        </label>
        <select
          id="ticket-priority"
          className="text-input"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriority)}
          disabled={submitting}
        >
          {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="ticket-body">
          Cuéntanos qué pasa
        </label>
        <textarea
          id="ticket-body"
          className="text-input"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={submitting}
          maxLength={10_000}
          required
        />
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="support-actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={submitting || !subject.trim() || !body.trim()}>
          {submitting ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </form>
  );
}

interface TicketThreadProps {
  ticket: Ticket;
  onBack: () => void;
}

function TicketThread({ ticket, onBack }: TicketThreadProps) {
  const loadThread = useCallback(() => getTicketThread(ticket.id), [ticket.id]);
  const { state, reload, refresh } = useAsyncData(loadThread);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = ticket.status === 'resolved' || ticket.status === 'closed';

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await replyTicket(ticket.id, reply.trim());
      setReply('');
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="support-thread">
      <button type="button" className="btn btn--ghost btn--sm" onClick={onBack} style={{ marginBottom: 'var(--space-4)' }}>
        ← Volver a tickets
      </button>
      <h2 className="support-thread__subject">{ticket.subject}</h2>
      <span className={`pill pill--${STATUS_TONE[ticket.status]}`}>{STATUS_LABEL[ticket.status]}</span>

      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && (
        <ul className="support-thread__messages">
          {state.data.map((m) => (
            <li key={m.id} className={`support-message support-message--${m.author_kind}`}>
              <div className="support-message__head">
                <span className="support-message__author">{m.author_kind === 'staff' ? m.author_label : 'Tú'}</span>
                <span className="muted small">{formatDateTime(m.created_at)}</span>
              </div>
              <p className="support-message__body">{m.body}</p>
            </li>
          ))}
        </ul>
      )}

      {closed ? (
        <p className="muted small">Este ticket está {STATUS_LABEL[ticket.status].toLowerCase()}. Si sigues necesitando ayuda, escribe de nuevo y se reabrirá.</p>
      ) : null}
      <form className="support-form" onSubmit={handleReply}>
        <div className="form-field">
          <label className="form-field__label" htmlFor="ticket-reply">
            Responder
          </label>
          <textarea
            id="ticket-reply"
            className="text-input"
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={submitting}
            maxLength={10_000}
            required
          />
        </div>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <div className="support-actions">
          <button type="submit" className="btn btn--primary btn--sm" disabled={submitting || !reply.trim()}>
            {submitting ? 'Enviando…' : 'Enviar respuesta'}
          </button>
        </div>
      </form>
    </div>
  );
}
