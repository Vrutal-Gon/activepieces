import { useCallback, useState } from 'react';
import { listTenantFlows } from '../../lib/api/tenants';
import { useAsyncData } from '../../lib/hooks/useAsyncData';
import { ErrorNotice, LoadingState } from '../../components/StatusViews';
import type { TenantSpecialistDetail } from '../../lib/types';

const AUTONOMY: Record<string, string> = {
  suggest: 'sugiere',
  approve: 'con aprobación',
  auto: 'autónomo',
};

interface FlowsTabProps {
  tenantId: string;
  specialists: TenantSpecialistDetail[];
}

export function FlowsTab({ tenantId, specialists }: FlowsTabProps) {
  const load = useCallback((signal: AbortSignal) => listTenantFlows(tenantId, signal), [tenantId]);
  const { state, reload } = useAsyncData(load);
  const [query, setQuery] = useState('');
  const [specialistId, setSpecialistId] = useState('');
  const [status, setStatus] = useState('');

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorNotice error={state.error} onRetry={reload} />;
  if (state.data.length === 0) {
    return (
      <div className="empty-state">
        <h2 className="empty-state__title">Sin flujos</h2>
        <p className="empty-state__body">Los flujos se cargan al contratar un especialista, uno por cada tarea del rol.</p>
      </div>
    );
  }

  const roleName = new Map(specialists.map((s) => [s.id, s.job_role_name ?? s.job_role_key]));
  const q = query.trim().toLowerCase();
  const rows = state.data.filter(
    (f) =>
      (!specialistId || f.specialist_id === specialistId) &&
      (!status || f.status === status) &&
      (!q || f.statement.toLowerCase().includes(q) || f.task_code.toLowerCase().includes(q)),
  );

  return (
    <div className="table-card">
      <div className="table-card__toolbar">
        <input
          className="text-input table-card__search"
          type="search"
          aria-label="Buscar tarea"
          placeholder="Buscar tarea…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select aria-label="Especialista" value={specialistId} onChange={(e) => setSpecialistId(e.target.value)}>
          <option value="">Todos los especialistas</option>
          {specialists.map((s) => (
            <option key={s.id} value={s.id}>
              {s.job_role_name ?? s.job_role_key}
            </option>
          ))}
        </select>
        <select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Estado: todos</option>
          <option value="enabled">Activos</option>
          <option value="disabled">Desactivados</option>
        </select>
        <span className="table-card__count mono">
          {rows.length} / {state.data.length}
        </span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Tarea</th>
            <th>Especialista</th>
            <th>Autonomía</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={`${f.specialist_id}:${f.task_code}`}>
              <td className="data-table__wrap">
                <span className="data-table__primary">{f.statement}</span>
                <span className="data-table__secondary">
                  {f.task_code} · v{f.task_version}
                </span>
              </td>
              <td>{roleName.get(f.specialist_id) ?? f.job_role_key}</td>
              <td>
                <span className="pill">{AUTONOMY[f.autonomy_level] ?? f.autonomy_level}</span>
              </td>
              <td>
                {f.status === 'enabled' ? (
                  <span className="pill pill--ok">activo</span>
                ) : (
                  <span className="pill">desactivado</span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="data-table__empty">
                Ningún flujo coincide con los filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
