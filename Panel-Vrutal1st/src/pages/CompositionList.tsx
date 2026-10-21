import { useCallback } from 'react';
import { Link } from 'react-router';
import { listAllCompositions } from '../lib/api/catalog';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { useDebouncedParam, useUrlState } from '../lib/hooks/useUrlState';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import { StatusPill } from '../components/StatusPill';
import '../styles/pages/catalog.css';

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicada' },
  { value: 'deprecated', label: 'Obsoleta' },
];

/**
 * Las composiciones del catálogo. Antes esta ruta montaba la lista de TAREAS: prometía las
 * composiciones y entregaba 1.147 tareas entre las que estaban, en alguna parte, las 10 que
 * de verdad existen.
 *
 * Cada composición pertenece a una tarea y se edita en su ficha; esta pantalla es el
 * inventario: qué hay montado, con cuántos pasos y en qué estado.
 */
export function CompositionList() {
  const { params, set } = useUrlState();
  const [draft, setDraft, query] = useDebouncedParam('q');
  const estado = params.get('est');

  const cargar = useCallback((signal: AbortSignal) => listAllCompositions(query, estado, signal), [query, estado]);
  const { state, reload } = useAsyncData(cargar);

  return (
    <section>
      <PageHead crumbs={[{ label: 'Biblioteca' }]} title="Composiciones" />

      <div className="catalog-stack">
        <p className="catalog-note">
          Una composición es la secuencia de pasos que realiza una tarea. Siempre lineal: si hace falta una
          bifurcación, va dentro de un bloque, no aquí. Se crean y se editan desde la ficha de su tarea.
        </p>

        <div className="inline-form">
          <input
            className="text-input"
            type="search"
            placeholder="Buscar por nombre, clave o tarea…"
            aria-label="Buscar composición"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <label className="inline-field">
            Estado
            <select className="text-input" value={estado ?? ''} onChange={(e) => set('est', e.target.value || null)}>
              {ESTADOS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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
                {state.data.length} {state.data.length === 1 ? 'composición' : 'composiciones'}
              </h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Composición</th>
                  <th>Realiza la tarea</th>
                  <th>Roles que la usan</th>
                  <th>Patrón</th>
                  <th>Estado</th>
                  <th className="data-table__num">Pasos</th>
                  <th className="data-table__num">Opciones</th>
                </tr>
              </thead>
              <tbody>
                {state.data.map((c) => (
                  <tr key={c.id}>
                    <td className="data-table__wrap">
                      <Link
                        className="data-table__primary"
                        to={`/tareas/${encodeURIComponent(c.task_id)}/composiciones`}
                      >
                        {c.name}
                      </Link>
                      <span className="data-table__secondary">
                        {c.key} · v{c.version}
                      </span>
                    </td>
                    <td className="data-table__wrap">
                      <span className="data-table__primary">{c.statement}</span>
                      <span className="data-table__secondary">{c.task_code}</span>
                    </td>
                    <td className="data-table__wrap">{c.role_names ?? '—'}</td>
                    <td className="mono">{c.pattern ?? '—'}</td>
                    <td>
                      <StatusPill status={c.status} />
                    </td>
                    <td className="data-table__num">{c.step_count}</td>
                    <td className="data-table__num">{c.slot_count}</td>
                  </tr>
                ))}
                {state.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="data-table__empty">
                      Ninguna composición coincide. Se crean desde la ficha de una tarea, en su pestaña
                      Composiciones.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </section>
  );
}
