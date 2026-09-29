import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { listTenants } from '../lib/api/staff';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { ErrorNotice, LoadingState } from '../components/StatusViews';

interface ClientListProps {
  onSelectTenant: (id: string) => void;
}

export function ClientList({ onSelectTenant }: ClientListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const onlyMine = searchParams.get('cartera') === 'mia';

  const load = useCallback((signal: AbortSignal) => listTenants(onlyMine, signal), [onlyMine]);
  const { state, reload } = useAsyncData(load);

  function setOnlyMine(value: boolean) {
    setSearchParams(value ? { cartera: 'mia' } : {});
  }

  return (
    <div className="panel">
      <div className="toolbar">
        <h2>Clientes</h2>
        <div className="chip-group" role="group" aria-label="Alcance">
          <button type="button" className="chip" aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)}>
            Todos
          </button>
          <button type="button" className="chip" aria-pressed={onlyMine} onClick={() => setOnlyMine(true)}>
            Mis clientes
          </button>
        </div>
      </div>

      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && (
        <table className="linked-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Industria</th>
              <th>Estado</th>
              <th>Gestor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.data.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.name}
                  {t.is_internal && <span className="badge subtle">interno</span>}
                </td>
                <td>{t.industry || '—'}</td>
                <td>
                  <span className="badge">{t.status}</span>
                </td>
                <td>{t.account_manager_name ?? 'Sin asignar'}</td>
                <td>
                  <button className="secondary" onClick={() => onSelectTenant(t.id)}>
                    Ver
                  </button>
                </td>
              </tr>
            ))}
            {state.data.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  {onlyMine
                    ? 'No tienes clientes asignados. Asígnate como gestor desde la ficha de un cliente.'
                    : 'No hay clientes todavía.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
