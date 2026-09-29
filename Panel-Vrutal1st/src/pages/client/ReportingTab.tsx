import { useCallback } from 'react';
import { listTenantReporting } from '../../lib/api/tenants';
import { useAsyncData } from '../../lib/hooks/useAsyncData';
import { ErrorNotice, LoadingState } from '../../components/StatusViews';
import type { TenantReportingItem } from '../../lib/types';

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'enabled') return <span className="pill pill--ok">activo</span>;
  if (status === 'disabled') return <span className="pill">desactivado</span>;
  return <span className="pill">no activado</span>;
}

interface ReportGroup {
  report: TenantReportingItem | null;
  kpis: TenantReportingItem[];
}

// role → report_key → { reporte, kpis }
function groupItems(items: TenantReportingItem[]): Map<string, Map<string, ReportGroup>> {
  const byRole = new Map<string, Map<string, ReportGroup>>();
  for (const item of items) {
    const reports = byRole.get(item.job_role_key) ?? new Map<string, ReportGroup>();
    byRole.set(item.job_role_key, reports);
    const group = reports.get(item.report_key) ?? { report: null, kpis: [] };
    reports.set(item.report_key, group);
    if (item.kind === 'report') group.report = item;
    else group.kpis.push(item);
  }
  return byRole;
}

export function ReportingTab({ tenantId }: { tenantId: string }) {
  const load = useCallback((signal: AbortSignal) => listTenantReporting(tenantId, signal), [tenantId]);
  const { state, reload } = useAsyncData(load);

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorNotice error={state.error} onRetry={reload} />;
  if (state.data.length === 0) {
    return (
      <div className="empty-state">
        <h2 className="empty-state__title">Sin reportes ni KPIs disponibles</h2>
        <p className="empty-state__body">
          Los roles contratados por este cliente aún no tienen reportes ni KPIs definidos en el catálogo.
        </p>
      </div>
    );
  }

  const reports = state.data.filter((i) => i.kind === 'report');
  const kpis = state.data.filter((i) => i.kind === 'kpi');
  const enabled = (list: TenantReportingItem[]) => list.filter((i) => i.status === 'enabled').length;

  return (
    <>
      <p className="client__summary">
        <strong>{enabled(reports)}</strong> de {reports.length} reportes activos · <strong>{enabled(kpis)}</strong> de{' '}
        {kpis.length} KPIs activos
      </p>

      {[...groupItems(state.data)].map(([roleKey, reportGroups]) => (
        <div key={roleKey} className="table-card">
          <div className="table-card__head">
            <h2 className="table-card__title">{roleKey}</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Reporte / KPI</th>
                <th>Descripción</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {[...reportGroups].map(([reportKey, group]) => [
                <tr key={`r:${reportKey}`} className="data-table__group">
                  <td>
                    <span className="data-table__primary">{group.report?.name ?? reportKey}</span>
                  </td>
                  <td className="data-table__wrap">{group.report?.description ?? '—'}</td>
                  <td>{group.report ? <StatusBadge status={group.report.status} /> : '—'}</td>
                </tr>,
                ...group.kpis.map((k) => (
                  <tr key={`k:${reportKey}:${k.item_key}`}>
                    <td className="data-table__indent">{k.name}</td>
                    <td className="data-table__wrap">{k.description ?? '—'}</td>
                    <td>
                      <StatusBadge status={k.status} />
                    </td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
