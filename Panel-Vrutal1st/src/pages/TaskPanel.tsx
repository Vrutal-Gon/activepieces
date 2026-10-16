import { useCallback, useMemo } from 'react';
import { Link, Navigate, NavLink, useSearchParams } from 'react-router';
import { getTask, getTaskCounts, listTaskRoles } from '../lib/api/catalog';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { PageHead, type Crumb } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import { StatusPill } from '../components/StatusPill';
import { ComponentsTab, type TaskRoleContext } from './task/ComponentsTab';
import { CompositionsTab } from './task/CompositionsTab';
import { FichaTab } from './task/FichaTab';
import type { TaskTab } from './TaskList';
import type { TaskRoleRow } from '../lib/types';
import '../styles/pages/catalog.css';

const TABS: { key: TaskTab; label: string }[] = [
  { key: 'ficha', label: 'Ficha' },
  { key: 'componentes', label: 'Componentes' },
  { key: 'composiciones', label: 'Composiciones' },
  { key: 'roles', label: 'Roles que la usan' },
];

const isTaskTab = (v: string | undefined): v is TaskTab => TABS.some((t) => t.key === v);

interface TaskPanelProps {
  taskId: string;
  tab: string | undefined;
}

/**
 * Ficha de tarea: el centro del flujo Rol → Tarea → Componentes/Bloques → Composición.
 * `?rol=<job_role_id>` indica desde qué versión de rol se llegó: activa su clasificación y sus overrides.
 */
export function TaskPanel({ taskId, tab }: TaskPanelProps) {
  const [params] = useSearchParams();
  const roleId = params.get('rol');

  const load = useCallback(
    async (signal: AbortSignal) => {
      const [task, roles, counts] = await Promise.all([
        getTask(taskId, signal),
        listTaskRoles(taskId, signal),
        getTaskCounts(taskId, signal),
      ]);
      return { task, roles, counts };
    },
    [taskId],
  );
  const { state, reload, refresh } = useAsyncData(load);

  const roleRow = state.status === 'ready' ? state.data.roles.find((r) => r.job_role_id === roleId) : undefined;
  const roleContext = useMemo<TaskRoleContext | null>(
    () =>
      roleRow
        ? {
            jobRoleId: roleRow.job_role_id,
            roleName: roleRow.name,
            roleVersion: roleRow.version,
            effectClassification: roleRow.effect_classification,
            criticality: roleRow.criticality,
          }
        : null,
    // Solo cambia si cambian los valores, no en cada recarga de la ficha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roleRow?.job_role_id, roleRow?.effect_classification, roleRow?.criticality, roleRow?.name, roleRow?.version],
  );

  if (!isTaskTab(tab)) {
    return <Navigate to={`/tareas/${encodeURIComponent(taskId)}/componentes${roleId ? `?rol=${roleId}` : ''}`} replace />;
  }
  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorNotice error={state.error} onRetry={reload} />;

  const { task, roles, counts } = state.data;
  if (!task) {
    return (
      <section>
        <PageHead crumbs={[{ label: 'Tareas', to: '/tareas' }]} title="Tarea no encontrada" />
        <p className="catalog-note">No existe una tarea con ese identificador.</p>
      </section>
    );
  }

  const crumbs: Crumb[] = roleRow
    ? [
        { label: 'Roles', to: '/roles' },
        { label: `${roleRow.name} v${roleRow.version}`, to: `/roles/${encodeURIComponent(roleRow.key)}` },
      ]
    : [{ label: 'Tareas', to: '/tareas' }];
  const search = roleId ? `?rol=${encodeURIComponent(roleId)}` : '';
  const tabCount: Record<TaskTab, number> = {
    ficha: 0,
    componentes: counts.components,
    composiciones: counts.compositions,
    roles: roles.length,
  };

  return (
    <section>
      <PageHead
        crumbs={crumbs}
        title={
          <>
            <span className="task-code">{task.task_code}</span> {task.statement}
          </>
        }
      />

      <p className="catalog-note role-summary">
        {task.process_name ?? 'Sin proceso'} · <span className="mono">{task.primary_pattern ?? 'sin patrón'}</span>
        {task.risk ? ` · riesgo ${task.risk}` : ''} <StatusPill status={task.status} />
      </p>

      {roleId && !roleRow && (
        <p className="notice notice--info">
          El rol del enlace ya no usa esta tarea: se muestra sin contexto de rol.
        </p>
      )}

      <nav className="client-tabs" aria-label="Secciones de la tarea">
        {TABS.map((t) => (
          <NavLink
            key={t.key}
            className="client-tabs__tab"
            to={`/tareas/${encodeURIComponent(task.id)}/${t.key}${search}`}
            aria-current={t.key === tab ? 'page' : undefined}
          >
            {t.label}
            {tabCount[t.key] > 0 && <span className="client-tabs__count">{tabCount[t.key]}</span>}
          </NavLink>
        ))}
      </nav>

      {tab === 'ficha' && <FichaTab task={task} onChanged={refresh} />}
      {tab === 'componentes' && <ComponentsTab task={task} roleContext={roleContext} onChanged={refresh} />}
      {tab === 'composiciones' && <CompositionsTab task={task} onChanged={refresh} />}
      {tab === 'roles' && <RolesTab taskId={task.id} roles={roles} activeRoleId={roleRow?.job_role_id ?? null} />}
    </section>
  );
}

interface RolesTabProps {
  taskId: string;
  roles: TaskRoleRow[];
  activeRoleId: string | null;
}

function RolesTab({ taskId, roles, activeRoleId }: RolesTabProps) {
  return (
    <section className="table-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Rol</th>
            <th>Departamento</th>
            <th>Efecto</th>
            <th>Criticidad</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.job_role_id} aria-selected={r.job_role_id === activeRoleId}>
              <td>
                <Link className="data-table__primary" to={`/roles/${encodeURIComponent(r.key)}`}>
                  {r.name}
                </Link>
                <span className="data-table__secondary">
                  {r.key} · v{r.version}
                </span>
              </td>
              <td>{r.domain_name ?? '—'}</td>
              <td className="mono">{r.effect_classification}</td>
              <td className="mono">{r.criticality}</td>
              <td>
                <StatusPill status={r.status} />
              </td>
              <td className="data-table__actions">
                {r.job_role_id === activeRoleId ? (
                  <Link className="btn btn--sm btn--ghost" to={`/tareas/${encodeURIComponent(taskId)}/roles`}>
                    Quitar contexto
                  </Link>
                ) : (
                  <Link
                    className="btn btn--sm btn--ghost"
                    to={`/tareas/${encodeURIComponent(taskId)}/componentes?rol=${encodeURIComponent(r.job_role_id)}`}
                  >
                    Trabajar desde este rol
                  </Link>
                )}
              </td>
            </tr>
          ))}
          {roles.length === 0 && (
            <tr>
              <td colSpan={6} className="data-table__empty">
                Ningún rol usa esta tarea todavía. Se enlaza desde la ficha del rol.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
