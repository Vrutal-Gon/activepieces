import { useCallback, useState } from 'react';
import { decideItems, listCollections, listItems } from '../lib/api/work';
import { errorMessage } from '../lib/api/client';
import { formatDate, formatInt } from '../lib/format';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import type { WorkCollection, WorkColumn, WorkItem, WorkStatus } from '../lib/types';
import { ExternalLink } from './ExternalLink';
import { ErrorNotice, LoadingState } from './StatusViews';
import '../styles/pages/work.css';

const PAGE = 50;
const MAX_CELL = 300;
const clip = (s: string) => (s.length > MAX_CELL ? `${s.slice(0, MAX_CELL)}…` : s);

/** Lo que produce un especialista, por pestañas. El servidor decide qué pestañas y filas ve cada persona. */
export function WorkSection({ specialistId }: { specialistId: string }) {
  const load = useCallback((signal: AbortSignal) => listCollections(specialistId, signal), [specialistId]);
  const { state, reload, refresh } = useAsyncData(load);
  const [active, setActive] = useState<string | null>(null);

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorNotice error={state.error} onRetry={reload} />;

  const collections = state.data;
  if (collections.length === 0) {
    return (
      <div className="empty-state">
        <h2 className="empty-state__title">Todavía no ha producido nada</h2>
        <p className="empty-state__body">Cuando este especialista entregue su primer trabajo, lo verás aquí.</p>
      </div>
    );
  }

  const current = collections.find((c) => c.id === active) ?? collections[0];

  return (
    <div className="work">
      <div className="chip-group work__tabs" role="group" aria-label="Tipos de trabajo">
        {collections.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={c.id === current.id} onClick={() => setActive(c.id)}>
            {c.label}
            {c.approvable && c.proposed > 0 && <span className="work__count"> · {formatInt(c.proposed)}</span>}
          </button>
        ))}
      </div>
      <CollectionView key={current.id} collection={current} onChanged={refresh} />
    </div>
  );
}

const STATUS_TABS: { status: WorkStatus; label: string; count: (c: WorkCollection) => number }[] = [
  { status: 'proposed', label: 'Propuestas', count: (c) => c.proposed },
  { status: 'approved', label: 'Aprobadas', count: (c) => c.approved },
  { status: 'rejected', label: 'Rechazadas', count: (c) => c.rejected },
];

const STATUS_PILL: Record<WorkStatus, { label: string; tone: string }> = {
  proposed: { label: 'Propuesta', tone: 'pill--warn' },
  approved: { label: 'Aprobada', tone: 'pill--ok' },
  rejected: { label: 'Rechazada', tone: 'pill--bad' },
  delivered: { label: 'Entregada', tone: '' },
};

interface CollectionViewProps {
  collection: WorkCollection;
  onChanged: () => void;
}

function CollectionView({ collection, onChanged }: CollectionViewProps) {
  const [status, setStatus] = useState<WorkStatus>(collection.approvable ? 'proposed' : 'delivered');
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<'approved' | 'rejected' | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback((signal: AbortSignal) => listItems(collection.id, status, limit, signal), [collection.id, status, limit]);
  const { state, reload, refresh } = useAsyncData(load);

  function changeStatus(next: WorkStatus) {
    setStatus(next);
    setLimit(PAGE);
    setSelected(new Set());
    setConfirming(null);
    setNotice(null);
  }

  async function decide(decision: 'approved' | 'rejected') {
    const ids = [...selected];
    setBusy(true);
    setNotice(null);
    try {
      const changed = await decideItems(ids, decision);
      if (changed < ids.length) {
        setNotice(
          changed === 0
            ? 'No se ha podido registrar tu decisión. Puede que ya la haya tomado otra persona o que no tengas permiso.'
            : `Se han decidido ${formatInt(changed)} de ${formatInt(ids.length)}. El resto ya estaba decidido o no tienes permiso.`,
        );
      }
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setSelected(new Set());
      setConfirming(null);
      setBusy(false);
      refresh();
      onChanged();
    }
  }

  const items = state.status === 'ready' ? state.data.items : [];
  const canDecide = collection.approvable && status === 'proposed';
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="work__body">
      {collection.approvable && (
        <div className="work__bar">
          <div className="chip-group" role="group" aria-label="Estado">
            {STATUS_TABS.map((t) => (
              <button key={t.status} type="button" className="chip" aria-pressed={status === t.status} onClick={() => changeStatus(t.status)}>
                {t.label} · {formatInt(t.count(collection))}
              </button>
            ))}
          </div>
          {canDecide && (
            <div className="work__actions">
              {confirming ? (
                <>
                  <span className="small">
                    {confirming === 'approved' ? '¿Aprobar' : '¿Rechazar'} {formatInt(selected.size)}{' '}
                    {selected.size === 1 ? 'propuesta?' : 'propuestas?'}
                  </span>
                  <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setConfirming(null)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={`btn btn--sm ${confirming === 'approved' ? 'btn--primary' : 'btn--danger'}`}
                    disabled={busy}
                    onClick={() => decide(confirming)}
                  >
                    {busy ? 'Guardando…' : 'Confirmar'}
                  </button>
                </>
              ) : (
                <>
                  <span className="muted small">{selected.size > 0 ? `${formatInt(selected.size)} seleccionadas` : 'Selecciona filas'}</span>
                  <button type="button" className="btn btn--danger btn--sm" disabled={selected.size === 0 || busy} onClick={() => setConfirming('rejected')}>
                    Rechazar
                  </button>
                  <button type="button" className="btn btn--primary btn--sm" disabled={selected.size === 0 || busy} onClick={() => setConfirming('approved')}>
                    Aprobar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {notice && (
        <p className="notice notice--error" role="alert">
          {notice}
        </p>
      )}
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && items.length === 0 && (
        <div className="empty-state">
          <h2 className="empty-state__title">{emptyTitle(collection, status)}</h2>
        </div>
      )}
      {state.status === 'ready' && items.length > 0 && (
        <>
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  {canDecide && (
                    <th className="work__check">
                      <input
                        type="checkbox"
                        className="check"
                        aria-label="Seleccionar todas las visibles"
                        checked={allSelected}
                        disabled={busy}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
                      />
                    </th>
                  )}
                  {collection.columns.map((c) => (
                    <th key={c.key} className={c.type === 'number' ? 'data-table__num' : undefined}>
                      {c.label}
                    </th>
                  ))}
                  <th>{status === 'delivered' ? 'Fecha' : 'Estado'}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    {canDecide && (
                      <td className="work__check">
                        <input
                          type="checkbox"
                          className="check"
                          aria-label="Seleccionar fila"
                          checked={selected.has(item.id)}
                          disabled={busy}
                          onChange={() => toggle(item.id)}
                        />
                      </td>
                    )}
                    {collection.columns.map((c) => (
                      <td key={c.key} className={c.type === 'number' ? 'data-table__num' : undefined}>
                        <Cell column={c} value={item.data[c.key]} />
                      </td>
                    ))}
                    <td>
                      <RowStatus item={item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.data.hasMore && (
            <div className="work__more">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLimit((n) => n + PAGE)}>
                Ver más
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function emptyTitle(c: WorkCollection, status: WorkStatus): string {
  if (!c.approvable) return 'Todavía no hay nada entregado';
  if (status === 'proposed') return 'No hay propuestas pendientes';
  return status === 'approved' ? 'Todavía no has aprobado nada' : 'Todavía no has rechazado nada';
}

function RowStatus({ item }: { item: WorkItem }) {
  if (item.status === 'delivered') return <span className="mono small">{formatDate(item.created_at)}</span>;
  const p = STATUS_PILL[item.status];
  return <span className={`pill ${p.tone}`}>{p.label}</span>;
}

/** Una celda según el tipo de columna. El contenido lo escribe un flujo: siempre como texto, nunca como HTML. */
function Cell({ column, value }: { column: WorkColumn; value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="muted">—</span>;
  switch (column.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? <span className="mono">{formatInt(n)}</span> : <span className="muted">—</span>;
    }
    case 'date':
      return <span className="mono">{typeof value === 'string' ? formatDate(value) : '—'}</span>;
    case 'badge':
      return <span className="pill">{clip(String(value)).slice(0, 40)}</span>;
    case 'url': {
      const url = typeof value === 'string' ? value : '';
      return <ExternalLink url={url} label={hostOf(url)} />;
    }
    default:
      return <>{typeof value === 'object' ? 'Varios datos' : clip(String(value))}</>;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 40);
  }
}
