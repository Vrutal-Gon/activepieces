import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getFleetOverview } from '../lib/api/tenants';
import { fleetAttention } from '../lib/attention';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { AttentionList } from '../components/AttentionList';
import { PendingPanel, PendingValue } from '../components/Pending';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import type { FleetRow } from '../lib/types';

const HEARTBEAT = 'Pendiente: latido VPS';

const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: 'activo', tone: 'pill--ok' },
  trial: { label: 'prueba', tone: 'pill--warn' },
};

function PendingStat({ label }: { label: string }) {
  return (
    <div className="stat stat--pending">
      <span className="eyebrow">{label}</span>
      <p className="stat__value">—</p>
      <span className="stat__detail">{HEARTBEAT}</span>
    </div>
  );
}

export function Dashboard() {
  const [searchParams] = useSearchParams();
  const onlyMine = searchParams.get('cartera') === 'mia';
  const load = useCallback((signal: AbortSignal) => getFleetOverview(onlyMine, signal), [onlyMine]);
  const { state, reload } = useAsyncData(load);

  return (
    <section>
      <header className="page-head">
        <div>
          <span className="eyebrow">Operación</span>
          <h1 className="page-head__title">Estado de la flota</h1>
        </div>
        <nav className="chip-group" aria-label="Alcance">
          <Link className="chip" to={{ search: '?cartera=mia' }} aria-current={onlyMine ? 'page' : undefined}>
            Mi cartera
          </Link>
          <Link className="chip" to={{ search: '' }} aria-current={onlyMine ? undefined : 'page'}>
            Todos
          </Link>
        </nav>
      </header>

      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && <FleetView rows={state.data} onlyMine={onlyMine} />}
    </section>
  );
}

function FleetView({ rows, onlyMine }: { rows: FleetRow[]; onlyMine: boolean }) {
  const clients = rows.filter((r) => !r.is_internal);
  const live = clients.filter((r) => r.status === 'active').length;
  const trial = clients.filter((r) => r.status === 'trial').length;
  const active = rows.reduce((n, r) => n + r.specialists_active, 0);
  const paused = rows.reduce((n, r) => n + r.specialists_paused, 0);
  const behind = rows.reduce((n, r) => n + r.specialists_behind, 0);

  return (
    <>
      <div className="stats">
        <div className="stat">
          <span className="eyebrow">Clientes live</span>
          <p className="stat__value">{live}</p>
          <span className="stat__detail">{trial} en prueba</span>
        </div>
        <div className="stat">
          <span className="eyebrow">Especialistas activos</span>
          <p className="stat__value">{active}</p>
          <span className="stat__detail">{paused} en pausa</span>
        </div>
        <div className="stat">
          <span className="eyebrow">Versiones atrasadas</span>
          <p className="stat__value">{behind}</p>
          <span className="stat__detail">frente al catálogo</span>
        </div>
        <PendingStat label="Flujos con error" />
        <PendingStat label="VPS sin latido" />
        <PendingStat label="Aprob. > 24 h" />
        <PendingStat label="Tickets abiertos" />
        <PendingStat label="Coste IA · mes" />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Requiere atención</h2>
            <span className="card__meta">ordenado por severidad</span>
          </div>
          <AttentionList items={fleetAttention(rows)} emptyText="Nada pendiente con los datos disponibles." />
        </div>
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Consumo de modelos · mes</h2>
            <span className="card__meta mono">€ / presupuesto</span>
          </div>
          <div className="card__body">
            <PendingPanel
              title="Sin datos de consumo"
              source="El consumo (model_usage) vive en la base de cada cliente. Llegará con el latido/resumen diario de cada VPS."
            />
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="card__head">
          <h2 className="card__title">Salud por cliente</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Estado</th>
              <th>VPS</th>
              <th>Especialistas</th>
              <th className="data-table__num">Flujos activos</th>
              <th>Versión</th>
              <th className="data-table__num">Tasa error</th>
              <th className="data-table__num">Tickets</th>
              <th>Gestor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const status = STATUS[r.status] ?? { label: r.status, tone: '' };
              return (
                <tr key={r.tenant_id}>
                  <td>
                    <Link className="data-table__primary" to={`/clientes/${encodeURIComponent(r.tenant_id)}/resumen`}>
                      {r.name}
                    </Link>
                    {r.is_internal && <span className="data-table__secondary">interno</span>}
                  </td>
                  <td>
                    <span className={`pill ${status.tone}`}>{status.label}</span>
                  </td>
                  <td>
                    <PendingValue hint={HEARTBEAT} />
                  </td>
                  <td>
                    <span className="mono">{r.specialists_active}</span>
                    {r.specialists_paused > 0 && (
                      <span className="data-table__secondary">{r.specialists_paused} en pausa</span>
                    )}
                  </td>
                  <td className="data-table__num">{r.flows_enabled}</td>
                  <td>
                    {r.specialists_behind > 0 ? (
                      <span className="pill pill--warn">{r.specialists_behind} atrasado(s)</span>
                    ) : (
                      <span className="pill pill--ok">al día</span>
                    )}
                  </td>
                  <td className="data-table__num">
                    <PendingValue hint={HEARTBEAT} />
                  </td>
                  <td className="data-table__num">
                    <PendingValue hint={HEARTBEAT} />
                  </td>
                  <td>{r.account_manager_name ?? 'Sin asignar'}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="data-table__empty">
                  {onlyMine ? 'No tienes clientes asignados.' : 'No hay clientes todavía.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
