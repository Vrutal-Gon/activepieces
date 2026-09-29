import type { TenantSpecialistDetail, TenantSpecialistStatus } from '../../lib/types';
import { formatDate } from '../../lib/format';

const STATUS_LABEL: Record<TenantSpecialistStatus, string> = {
  contracted: 'activo',
  paused: 'pausado',
  cancelled: 'cancelado',
};

const STATUS_CLASS: Record<TenantSpecialistStatus, string> = {
  contracted: 'pill pill--ok',
  paused: 'pill pill--warn',
  cancelled: 'pill',
};

interface SpecialistsTabProps {
  specialists: TenantSpecialistDetail[];
  onOpenRole: (key: string) => void;
}

export function SpecialistsTab({ specialists, onOpenRole }: SpecialistsTabProps) {
  if (specialists.length === 0) {
    return (
      <div className="empty-state">
        <h2 className="empty-state__title">Sin especialistas contratados</h2>
        <p className="empty-state__body">Cuando este cliente contrate un rol aparecerá aquí con su versión y sus flujos.</p>
      </div>
    );
  }

  return (
    <div className="table-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Especialista</th>
            <th>Versión</th>
            <th>Estado</th>
            <th className="data-table__num">Flujos activos</th>
            <th>Contratado</th>
            <th>
              <span className="visually-hidden">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {specialists.map((s) => {
            const behind = s.latest_active_version !== null && s.latest_active_version > s.job_role_version;
            return (
              <tr key={s.id}>
                <td>
                  <span className="data-table__primary">{s.job_role_name ?? s.job_role_key}</span>
                  <span className="data-table__secondary">{s.job_role_key}</span>
                </td>
                <td>
                  <span className="mono">v{s.job_role_version}</span>
                  {behind && <span className="pill pill--warn">v{s.latest_active_version} disponible</span>}
                </td>
                <td>
                  <span className={STATUS_CLASS[s.status]}>{STATUS_LABEL[s.status]}</span>
                </td>
                <td className="data-table__num">
                  {s.flows_enabled} / {s.flows_total}
                </td>
                <td className="mono">{formatDate(s.contracted_at)}</td>
                <td className="data-table__actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onOpenRole(s.job_role_key)}>
                    Ver rol
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
