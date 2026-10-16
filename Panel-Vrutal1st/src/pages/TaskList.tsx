import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { listDomains, listTasks } from '../lib/api/catalog';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { PageHead, type Crumb } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import { TaskTypeFilters } from '../components/TaskTypeFilters';
import { StatusPill } from '../components/StatusPill';
import '../styles/pages/catalog.css';

const PAGE_SIZE = 25;

export type TaskTab = 'ficha' | 'componentes' | 'composiciones' | 'roles';

interface TaskListProps {
  /** Pestaña de la ficha a la que lleva cada fila. */
  target: TaskTab;
  crumbs: Crumb[];
  title: string;
  intro?: string;
}

/**
 * Tareas del catálogo. Filtros en la URL (?q, ?dep, ?proc, ?pat, ?todas, ?p) para que el botón atrás y recargar
 * devuelvan al mismo sitio. `?tarea=<id>` salta directo a la ficha.
 */
export function TaskList({ target, crumbs, title, intro }: TaskListProps) {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const domainId = params.get('dep');
  const processId = params.get('proc');
  const pattern = params.get('pat');
  const estado = params.get('est');
  const onlyUsed = params.get('todas') !== '1';
  const page = Math.max(0, Number(params.get('p') ?? '0') || 0);
  const jumpTo = params.get('tarea');

  const [draft, setDraft] = useState(query);
  // Si la URL cambia desde fuera (atrás, otro enlace), el campo la sigue.
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    setDraft(query);
  }

  // La búsqueda escribe en la URL con un pequeño retardo.
  useEffect(() => {
    if (draft === query) return;
    const handle = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (draft.trim()) next.set('q', draft.trim());
          else next.delete('q');
          next.delete('p');
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => clearTimeout(handle);
  }, [draft, query, setParams]);

  function setParam(key: string, value: string | null) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'p') next.delete('p');
      return next;
    });
  }

  const loadDomains = useCallback((signal: AbortSignal) => listDomains(signal), []);
  const domains = useAsyncData(loadDomains).state;

  const load = useCallback(
    (signal: AbortSignal) =>
      listTasks(
        { query, domainId, processId, pattern, status: estado, onlyUsed, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
        signal,
      ),
    [query, domainId, processId, pattern, estado, onlyUsed, page],
  );
  const { state, reload } = useAsyncData(load);

  if (jumpTo) return <Navigate to={`/tareas/${encodeURIComponent(jumpTo)}/${target}`} replace />;

  const total = state.status === 'ready' ? (state.data[0]?.total_count ?? 0) : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <PageHead crumbs={crumbs} title={title}>
        <div className="chip-group" role="group" aria-label="Alcance">
          <button type="button" className="chip" aria-pressed={onlyUsed} onClick={() => setParam('todas', null)}>
            Usadas por roles
          </button>
          <button type="button" className="chip" aria-pressed={!onlyUsed} onClick={() => setParam('todas', '1')}>
            Todo el catálogo
          </button>
        </div>
        <Link className="btn btn--primary" to="/tareas/nueva">
          + Nueva tarea
        </Link>
      </PageHead>

      <div className="catalog-stack">
        {intro && <p className="catalog-note">{intro}</p>}

        <div className="inline-form">
          <input
            className="text-input"
            type="search"
            placeholder="Buscar por código o enunciado…"
            aria-label="Buscar tarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <TaskTypeFilters
            processId={processId}
            pattern={pattern}
            onProcess={(v) => setParam('proc', v)}
            onPattern={(v) => setParam('pat', v)}
          />
          <label className="inline-field">
            Estado
            <select
              className="text-input"
              value={estado ?? ''}
              onChange={(e) => setParam('est', e.target.value || null)}
            >
              <option value="">Todos</option>
              <option value="draft">Borrador</option>
              <option value="validated">Validada</option>
              <option value="deprecated">Obsoleta</option>
            </select>
          </label>
          <label className="inline-field">
            Departamento
            <select
              className="text-input"
              value={domainId ?? ''}
              onChange={(e) => setParam('dep', e.target.value || null)}
            >
              <option value="">Todos</option>
              {domains.status === 'ready' &&
                domains.data.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        {state.status === 'loading' && <LoadingState />}
        {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
        {state.status === 'ready' && (
          <section className="table-card">
            <div className="table-card__head">
              <h2 className="table-card__title">
                {total} {total === 1 ? 'tarea' : 'tareas'}
              </h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarea</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th className="data-table__num">Roles</th>
                  <th className="data-table__num">Componentes</th>
                  <th className="data-table__num">Composiciones</th>
                </tr>
              </thead>
              <tbody>
                {state.data.map((t) => (
                  <tr key={t.id}>
                    <td className="data-table__wrap">
                      <Link className="data-table__primary" to={`/tareas/${encodeURIComponent(t.id)}/${target}`}>
                        {t.statement}
                      </Link>
                      <span className="data-table__secondary">{t.task_code}</span>
                    </td>
                    <td>
                      <span className="data-table__primary">{t.process_name ?? 'Sin proceso'}</span>
                      <span className="data-table__secondary">{t.primary_pattern ?? '—'}</span>
                    </td>
                    <td>
                      <StatusPill status={t.status} />
                    </td>
                    <td className="data-table__num">{t.role_count}</td>
                    <td className="data-table__num">{t.component_count}</td>
                    <td className="data-table__num">{t.composition_count}</td>
                  </tr>
                ))}
                {state.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="data-table__empty">
                      Ninguna tarea coincide con el filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {pages > 1 && (
              <div className="table-card__foot">
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  disabled={page === 0}
                  onClick={() => setParam('p', page - 1 > 0 ? String(page - 1) : null)}
                >
                  ← Anterior
                </button>
                <span className="mono">
                  {page + 1} / {pages}
                </span>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  disabled={page + 1 >= pages}
                  onClick={() => setParam('p', String(page + 1))}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
