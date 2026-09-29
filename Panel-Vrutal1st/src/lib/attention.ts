import type { AttentionItem } from '../components/AttentionList';
import type { FleetRow, TenantDetail, TenantSpecialistDetail } from './types';

// Avisos que el plano de control ya puede detectar. Los del latido (VPS caído,
// flujos con error, aprobaciones bloqueadas) se añadirán cuando exista.

const clientPath = (id: string, tab = 'resumen') => `/clientes/${encodeURIComponent(id)}/${tab}`;

export function fleetAttention(rows: FleetRow[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const r of rows) {
    if (r.is_internal) continue;
    if (r.status === 'active' && r.data_plane_status !== 'provisioned') {
      items.push({
        id: `dp:${r.tenant_id}`,
        severity: 'warn',
        title: `${r.name}: cliente activo sin data plane aprovisionado`,
        detail: `Estado del data plane: ${r.data_plane_status ?? 'desconocido'}`,
        to: clientPath(r.tenant_id, 'infraestructura'),
      });
    }
    if (r.specialists_behind > 0) {
      items.push({
        id: `ver:${r.tenant_id}`,
        severity: 'info',
        title: `${r.name}: ${r.specialists_behind} especialista(s) con versión atrasada`,
        detail: 'Hay una versión más reciente activa en el catálogo',
        to: clientPath(r.tenant_id, 'especialistas'),
      });
    }
    if (!r.account_manager_profile_id) {
      items.push({
        id: `am:${r.tenant_id}`,
        severity: 'info',
        title: `${r.name}: sin gestor de cuenta`,
        detail: 'No aparecerá en la cartera de nadie',
        to: clientPath(r.tenant_id),
      });
    }
  }
  return items;
}

export function clientAttention(tenant: TenantDetail, specialists: TenantSpecialistDetail[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (tenant.status === 'active' && tenant.data_plane_status !== 'provisioned') {
    items.push({
      id: 'dp',
      severity: 'warn',
      title: 'Cliente activo sin data plane aprovisionado',
      detail: `Estado: ${tenant.data_plane_status ?? 'desconocido'}`,
      to: clientPath(tenant.id, 'infraestructura'),
    });
  }
  for (const s of specialists) {
    const name = s.job_role_name ?? s.job_role_key;
    if (s.status === 'contracted' && s.latest_active_version !== null && s.latest_active_version > s.job_role_version) {
      items.push({
        id: `ver:${s.id}`,
        severity: 'info',
        title: `${name}: v${s.latest_active_version} disponible`,
        detail: `Contratado en v${s.job_role_version}`,
        to: clientPath(tenant.id, 'especialistas'),
      });
    }
    if (s.status === 'paused') {
      items.push({
        id: `pause:${s.id}`,
        severity: 'info',
        title: `${name} está en pausa`,
        detail: 'Sus flujos, reportes y KPIs están desactivados',
        to: clientPath(tenant.id, 'especialistas'),
      });
    }
  }
  if (!tenant.account_manager_profile_id) {
    items.push({ id: 'am', severity: 'info', title: 'Sin gestor de cuenta', detail: 'Asígnalo en la cabecera' });
  }
  return items;
}
