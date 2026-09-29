import { useCallback, useRef, useState } from 'react';
import { Link, Navigate, NavLink } from 'react-router';
import { getTenant, listTenantSpecialists } from '../lib/api/tenants';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { useDismiss } from '../lib/hooks/useDismiss';
import { formatDate } from '../lib/format';
import { safeHttpUrl } from '../lib/url';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import { ExternalLink } from '../components/ExternalLink';
import { PendingPanel, PendingValue } from '../components/Pending';
import { AccountManagerField } from './AccountManagerField';
import { OverviewTab } from './client/OverviewTab';
import { SpecialistsTab } from './client/SpecialistsTab';
import { FlowsTab } from './client/FlowsTab';
import { ReportingTab } from './client/ReportingTab';
import { StackTab } from './client/StackTab';
import { InfraTab } from './client/InfraTab';
import { InfoTab } from './client/InfoTab';
import '../styles/pages/client.css';

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'especialistas', label: 'Especialistas' },
  { key: 'flujos', label: 'Flujos' },
  { key: 'kpis', label: 'KPIs y reportes' },
  { key: 'stack', label: 'Stack' },
  { key: 'infraestructura', label: 'Infraestructura' },
  { key: 'consumo', label: 'Consumo' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'logs', label: 'Logs' },
  { key: 'auditoria', label: 'Auditoría' },
  { key: 'info', label: 'Info' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const isTabKey = (v: string): v is TabKey => TABS.some((t) => t.key === v);

// Pestañas del diseño cuyos datos viven en la base de cada cliente (data plane).
// D-11: el navegador nunca usa credenciales del cliente; llegarán vía Edge Function o latido.
const PENDING_TABS: Partial<Record<TabKey, { title: string; source: string }>> = {
  usuarios: {
    title: 'Usuarios del cliente',
    source:
      'Viven en la base del cliente (profiles, user_specialist_access). Se mostrarán cuando exista la Edge Function que los consulta desde el plano de control con la credencial del Vault.',
  },
  consumo: {
    title: 'Consumo de modelos',
    source: 'model_usage vive en la base del cliente. Llegará con el resumen diario que enviará cada VPS en su latido.',
  },
  tickets: {
    title: 'Tickets del cliente',
    source: 'client_ticket vive en la base del cliente. Se leerán vía Edge Function; los tickets nuevos generarán notificación.',
  },
  logs: {
    title: 'Logs de ejecución',
    source: 'run_log vive en la base del cliente. Se consultarán con filtros vía Edge Function.',
  },
  auditoria: {
    title: 'Auditoría',
    source:
      'Dos fuentes: audit_log del cliente (vía Edge Function) y un registro de acciones del staff de Vrutal sobre este cliente, que aún no existe en Vrutal1st.',
  },
};

const TENANT_STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: 'activo', tone: 'pill--ok' },
  trial: { label: 'prueba', tone: 'pill--warn' },
  paused: { label: 'pausado', tone: 'pill--warn' },
};

const HEARTBEAT = 'Pendiente del latido de los VPS';
const DATA_PLANE = 'Pendiente: vive en la base del cliente';

interface ClientPanelProps {
  tenantId: string;
  tab: string | undefined;
  onOpenRole: (key: string) => void;
}

export function ClientPanel({ tenantId, tab, onOpenRole }: ClientPanelProps) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [tenant, specialists] = await Promise.all([
        getTenant(tenantId, signal),
        listTenantSpecialists(tenantId, signal),
      ]);
      return { tenant, specialists };
    },
    [tenantId],
  );
  const { state, reload, refresh } = useAsyncData(load);
  const base = `/clientes/${encodeURIComponent(tenantId)}`;

  if (tab === undefined || !isTabKey(tab)) return <Navigate to={`${base}/resumen`} replace />;
  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorNotice error={state.error} onRetry={reload} />;

  const { tenant, specialists } = state.data;
  if (!tenant) {
    return (
      <div className="empty-state">
        <h1 className="empty-state__title">Cliente no encontrado</h1>
        <p className="empty-state__body">
          Puede que se haya dado de baja. <Link to="/clientes">Volver a Clientes</Link>
        </p>
      </div>
    );
  }

  const activeSpecialists = specialists.filter((s) => s.status === 'contracted').length;
  const status = TENANT_STATUS[tenant.status] ?? { label: tenant.status, tone: '' };
  const pending = PENDING_TABS[tab];

  return (
    <div className="client">
      <nav className="client__crumbs" aria-label="Ruta">
        <Link to="/clientes">Clientes</Link> / <span>{tenant.name}</span>
      </nav>

      <header className="client-head">
        <div className="client-head__main">
          <h1 className="client-head__title">
            {tenant.name}
            <span className={`pill ${status.tone}`}>{status.label}</span>
            <span className="pill pill--pending" title="Tramo de servicio: pendiente de definir en el modelo de datos">
              tramo —
            </span>
            {tenant.is_internal && <span className="pill">interno</span>}
          </h1>
          <p className="client-head__subtitle">
            {[
              tenant.legal_name,
              tenant.industry,
              tenant.size_employees !== null ? `${tenant.size_employees} empleados` : null,
              tenant.country,
            ]
              .filter(Boolean)
              .join(' · ') || 'Sin datos de empresa todavía'}
          </p>

          <dl className="client-head__facts">
            <div>
              <dt className="eyebrow">Gestor de cuenta</dt>
              <dd>
                <AccountManagerField
                  tenantId={tenant.id}
                  currentProfileId={tenant.account_manager_profile_id}
                  onChanged={refresh}
                />
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Admin cliente</dt>
              <dd>
                <PendingValue hint={DATA_PLANE} />
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Usuarios activos</dt>
              <dd className="mono">
                <PendingValue hint={DATA_PLANE} />
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Especialistas</dt>
              <dd className="mono">{activeSpecialists}</dd>
            </div>
            <div>
              <dt className="eyebrow">Alta</dt>
              <dd className="mono">{formatDate(tenant.created_at)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Renovación</dt>
              <dd className="mono">
                <PendingValue hint="Pendiente: no hay fecha de renovación en el modelo de datos" />
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Web</dt>
              <dd>
                <ExternalLink url={tenant.website} label={tenant.website ?? ''} />
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Facturación</dt>
              <dd className="mono">{tenant.holded_contact_id ?? <PendingValue hint="Sin contacto de Holded" />}</dd>
            </div>
          </dl>
        </div>

        <div className="client-head__side">
          <div className="client-head__actions">
            {tenant.can_edit && (
              <Link className="btn btn--ghost" to={`${base}/info?editar=1`}>
                Editar
              </Link>
            )}
            <MoreMenu projectRef={tenant.supabase_project_ref} />
          </div>
          <div className="health">
            <div className="health__ring" aria-hidden="true">
              <span>—</span>
            </div>
            <div>
              <span className="eyebrow">Salud</span>
              <p className="health__detail">{HEARTBEAT}</p>
            </div>
          </div>
        </div>
      </header>

      <nav className="client-tabs" aria-label="Secciones del cliente">
        {TABS.map((t) => (
          <NavLink key={t.key} to={`${base}/${t.key}`} className="client-tabs__tab">
            {t.label}
            {t.key === 'especialistas' && <span className="client-tabs__count">{specialists.length}</span>}
          </NavLink>
        ))}
      </nav>

      <section className="client__panel">
        {tab === 'resumen' && <OverviewTab tenant={tenant} specialists={specialists} />}
        {tab === 'especialistas' && <SpecialistsTab specialists={specialists} onOpenRole={onOpenRole} />}
        {tab === 'flujos' && <FlowsTab tenantId={tenant.id} specialists={specialists} />}
        {tab === 'kpis' && <ReportingTab tenantId={tenant.id} />}
        {tab === 'stack' && <StackTab tenantId={tenant.id} />}
        {tab === 'infraestructura' && <InfraTab tenant={tenant} />}
        {tab === 'info' && <InfoTab tenant={tenant} onSaved={refresh} />}
        {pending && <PendingPanel title={pending.title} source={pending.source} />}
      </section>
    </div>
  );
}

// Los project ref de Supabase son 20 caracteres alfanuméricos en minúscula; se valida antes de construir la URL.
function supabaseProjectUrl(ref: string | null): string | null {
  if (!ref || !/^[a-z0-9]{20}$/.test(ref)) return null;
  return safeHttpUrl(`https://supabase.com/dashboard/project/${ref}`);
}

function MoreMenu({ projectRef }: { projectRef: string | null }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, rootRef, triggerRef);
  const projectUrl = supabaseProjectUrl(projectRef);

  return (
    <div className="popover" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn--ghost"
        aria-label="Más acciones"
        aria-expanded={open}
        aria-controls="client-more-menu"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && (
        <div id="client-more-menu" className="popover__panel popover__panel--menu">
          {projectUrl ? (
            <a className="account-menu__item" href={projectUrl} target="_blank" rel="noopener noreferrer">
              Abrir proyecto en Supabase ↗
            </a>
          ) : (
            <p className="popover__empty">Sin proyecto Supabase asociado.</p>
          )}
        </div>
      )}
    </div>
  );
}
