import { PendingValue } from '../../components/Pending';
import type { TenantDetail } from '../../lib/types';

const PROVISIONING = 'Pendiente: el aprovisionamiento de VPS aún es manual y no se registra en Vrutal1st';
const HEARTBEAT = 'Pendiente del latido de los VPS';

export function InfraTab({ tenant }: { tenant: TenantDetail }) {
  return (
    <div className="info-sheet">
      <section className="info-sheet__section">
        <h2 className="eyebrow">Data plane · Supabase</h2>
        <dl className="info-sheet__grid">
          <div>
            <dt>Estado</dt>
            <dd>
              {tenant.data_plane_status === 'provisioned' ? (
                <span className="pill pill--ok">aprovisionado</span>
              ) : (
                <span className="pill pill--warn">{tenant.data_plane_status ?? 'desconocido'}</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Proyecto</dt>
            <dd className="mono">{tenant.supabase_project_ref ?? '—'}</dd>
          </div>
          <div>
            <dt>Nombre</dt>
            <dd>{tenant.supabase_project_name ?? '—'}</dd>
          </div>
          <div>
            <dt>Región</dt>
            <dd className="mono">{tenant.supabase_project_region ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="info-sheet__section">
        <h2 className="eyebrow">VPS · ejecución</h2>
        <dl className="info-sheet__grid">
          {['VPS', 'Contenedor Docker', 'Repositorio Git', 'Versión de Activepieces'].map((label) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="mono">
                <PendingValue hint={PROVISIONING} />
              </dd>
            </div>
          ))}
          <div>
            <dt>Último latido</dt>
            <dd className="mono">
              <PendingValue hint={HEARTBEAT} />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
