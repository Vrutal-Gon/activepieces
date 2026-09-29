import { clientAttention } from '../../lib/attention';
import { AttentionList } from '../../components/AttentionList';
import { PendingPanel } from '../../components/Pending';
import type { TenantDetail, TenantSpecialistDetail } from '../../lib/types';

const HEARTBEAT = 'Pendiente: latido VPS';

interface OverviewTabProps {
  tenant: TenantDetail;
  specialists: TenantSpecialistDetail[];
}

export function OverviewTab({ tenant, specialists }: OverviewTabProps) {
  const active = specialists.filter((s) => s.status === 'contracted');
  const paused = specialists.filter((s) => s.status === 'paused').length;
  const flowsEnabled = active.reduce((n, s) => n + s.flows_enabled, 0);
  const flowsTotal = active.reduce((n, s) => n + s.flows_total, 0);
  const behind = active.filter(
    (s) => s.latest_active_version !== null && s.latest_active_version > s.job_role_version,
  ).length;

  return (
    <>
      <div className="stats">
        <div className="stat">
          <span className="eyebrow">Especialistas activos</span>
          <p className="stat__value">{active.length}</p>
          <span className="stat__detail">{paused} en pausa</span>
        </div>
        <div className="stat">
          <span className="eyebrow">Flujos activos</span>
          <p className="stat__value">{flowsEnabled}</p>
          <span className="stat__detail">de {flowsTotal} disponibles</span>
        </div>
        <div className="stat">
          <span className="eyebrow">Versiones atrasadas</span>
          <p className="stat__value">{behind}</p>
          <span className="stat__detail">frente al catálogo</span>
        </div>
        {['Ejecuciones 24 h', 'Tasa de error', 'Coste IA · mes'].map((label) => (
          <div key={label} className="stat stat--pending">
            <span className="eyebrow">{label}</span>
            <p className="stat__value">—</p>
            <span className="stat__detail">{HEARTBEAT}</span>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Requiere atención</h2>
          </div>
          <AttentionList
            items={clientAttention(tenant, specialists)}
            emptyText="Nada pendiente con los datos disponibles."
          />
        </div>
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Actividad reciente</h2>
          </div>
          <div className="card__body">
            <PendingPanel
              title="Sin actividad todavía"
              source="Ejecuciones, aprobaciones y cambios llegarán con el latido y los logs del cliente."
            />
          </div>
        </div>
      </div>
    </>
  );
}
