import { Link } from 'react-router';
import { FilterBar, type FacetGroup } from './FilterBar';
import { Pager } from './Pager';
import { StatusPill } from './StatusPill';
import type { TaskFacet, TaskListRow } from '../lib/types';
import type { TaskTab } from '../pages/TaskList';

export const PAGE_SIZE = 25;

/** Facetas que puede pintar el rail, con el parámetro de URL en el que se guardan. */
export const RAIL = {
  estado: {
    facet: 'status',
    label: 'Estado',
    param: 'est',
    copy: { draft: 'Borrador', validated: 'Validada', deprecated: 'Obsoleta' },
  },
  patron: { facet: 'pattern', label: 'Patrón', param: 'pat' },
  proceso: { facet: 'process', label: 'Proceso', param: 'proc' },
  riesgo: { facet: 'risk', label: 'Riesgo', param: 'riesgo' },
  montaje: { facet: 'has_composition', label: 'Montaje', param: 'comp' },
  uso: { facet: 'used_by_role', label: 'Uso', param: 'usada' },
  fuente: {
    facet: 'source',
    label: 'Origen',
    param: 'src',
    copy: { onet: 'O*NET', apqc: 'APQC', internal: 'Vrutal' },
  },
  ocupacion: { facet: 'occupation', label: 'Ocupación', param: 'ocu' },
  nivel: { facet: 'apqc_level', label: 'Nivel PCF', param: 'nivel' },
} satisfies Record<string, FacetGroup>;

export type RailKey = keyof typeof RAIL;
export type TaskColumn = 'tipo' | 'ocupacion' | 'origen' | 'roles' | 'pasos';

interface TaskBrowserViewProps {
  groups: FacetGroup[];
  facets: TaskFacet[];
  selected: Record<string, string | null>;
  onFacet: (param: string, value: string | null) => void;
  onClearFacets: () => void;

  search: string;
  onSearch: (value: string) => void;
  placeholder: string;

  rows: TaskListRow[];
  total: number;
  page: number;
  onPage: (page: number) => void;

  target: TaskTab;
  columns: TaskColumn[];
  empty: string;
}

/**
 * La parte visible del navegador de tareas: rail, buscador, tabla y paginador.
 *
 * Va separada de la que pide los datos para poder renderizarla con datos de prueba y
 * mirarla (`preview.html`) sin Supabase ni sesión, en vez de ajustar el CSS a ciegas.
 */
export function TaskBrowserView({
  groups,
  facets,
  selected,
  onFacet,
  onClearFacets,
  search,
  onSearch,
  placeholder,
  rows,
  total,
  page,
  onPage,
  target,
  columns,
  empty,
}: TaskBrowserViewProps) {
  return (
    <section className="table-card browse">
      <div className="table-card__head browse__head">
        <input
          className="text-input browse__search"
          type="search"
          placeholder={placeholder}
          aria-label="Buscar tarea"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <h2 className="table-card__title browse__count">
          {total} {total === 1 ? 'tarea' : 'tareas'}
        </h2>
      </div>

      <FilterBar
        groups={groups}
        facets={facets}
        selected={selected}
        onChange={onFacet}
        onClearAll={onClearFacets}
      />
      <div className="browse__scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Tarea</th>
            {columns.includes('origen') && <th>Origen</th>}
            {columns.includes('ocupacion') && <th>Ocupación</th>}
            {columns.includes('tipo') && <th>Tipo</th>}
            <th>Estado</th>
            {columns.includes('roles') && <th className="data-table__num">Roles</th>}
            {columns.includes('pasos') && <th className="data-table__num">Pasos</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="data-table__wrap">
                <Link className="data-table__primary" to={`/tareas/${encodeURIComponent(t.id)}/${target}`}>
                  {t.statement}
                </Link>
                <span className="data-table__secondary">{t.task_code}</span>
              </td>
              {columns.includes('origen') && (
                <td>
                  <span className="data-table__primary">{RAIL.fuente.copy[t.source as 'onet'] ?? t.source}</span>
                  {t.apqc_level && <span className="data-table__secondary">{t.apqc_level}</span>}
                </td>
              )}
              {columns.includes('ocupacion') && <td className="data-table__wrap">{t.occupation_title ?? '—'}</td>}
              {columns.includes('tipo') && (
                <td>
                  <span className="data-table__primary">{t.process_name ?? 'Sin proceso'}</span>
                  <span className="data-table__secondary">{t.primary_pattern ?? 'sin patrón'}</span>
                </td>
              )}
              <td>
                <StatusPill status={t.status} />
              </td>
              {columns.includes('roles') && <td className="data-table__num">{t.role_count}</td>}
              {columns.includes('pasos') && (
                <td className="data-table__num">{t.composition_count > 0 ? t.step_count : '—'}</td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={2 + columns.length} className="data-table__empty">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={onPage} />
    </section>
  );
}
