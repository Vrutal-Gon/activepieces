import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { listTickets } from '../lib/api/tickets';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { formatDate } from '../lib/format';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import type { TicketStatus } from '../lib/types';

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

type Filter = 'abiertos' | 'todos';

export function TicketsPage() {
  const [filter, setFilter] = useState<Filter>('abiertos');
  const load = useCallback((signal: AbortSignal) => listTickets(null, null, signal), []);
  const { state, reload } = useAsyncData(load);
  const shown = state.status === 'ready' ? (filter === 'abiertos' ? state.data.filter((t) => t.status !== 'resolved' && t.status !== 'closed') : state.data) : [];

  return (
    <section>
      <PageHead crumbs={[{ label: 'Operación' }]} title="Tickets" />
      <p className="lead">Lo que los Admin de los clientes reportan desde VrutalOS. De tu cartera, o de todos si gestionas la plataforma.</p>

      <div className="chip-group" role="group" aria-label="Estado" style={{ marginBottom: 'var(--space-4)' }}>
        <button type="button" className="chip" aria-pressed={filter === 'abiertos'} onClick={() => setFilter('abiertos')}>
          Abiertos
        </button>
        <button type="button" className="chip" aria-pressed={filter === 'todos'} onClick={() => setFilter('todos')}>
          Todos
        </button>
      </div>

      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && shown.length === 0 && (
        <div className="empty-state">
          <h2 className="empty-state__title">Sin tickets {filter === 'abiertos' ? 'abiertos' : ''}</h2>
        </div>
      )}
      {state.status === 'ready' && shown.length > 0 && (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Asunto</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link className="data-table__primary" to={`/clientes/${encodeURIComponent(t.tenant_id)}/tickets`}>
                      {t.tenant_name}
                    </Link>
                  </td>
                  <td>{t.subject}</td>
                  <td>
                    <span className={`pill ${STATUS_TONE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                  </td>
                  <td>{t.priority}</td>
                  <td className="mono">{formatDate(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
