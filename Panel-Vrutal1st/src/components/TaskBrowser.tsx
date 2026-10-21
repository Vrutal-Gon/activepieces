import { useCallback } from 'react';
import { browseTasks, taskFacets, type TaskListFilter } from '../lib/api/catalog';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { useDebouncedParam, useUrlState } from '../lib/hooks/useUrlState';
import { ErrorNotice, LoadingState } from './StatusViews';
import { PAGE_SIZE, RAIL, TaskBrowserView, type RailKey, type TaskColumn } from './TaskBrowserView';
import type { TaskTab } from '../pages/TaskList';

export type { RailKey } from './TaskBrowserView';

interface TaskBrowserProps {
  /** Facetas que se muestran, en orden. */
  rail: RailKey[];
  /** Acotación que la pantalla impone y el usuario no puede quitar. */
  fixed: Partial<TaskListFilter>;
  /** Pestaña de la ficha a la que lleva cada fila. */
  target: TaskTab;
  /** Columnas extra, además de Tarea y Estado. */
  columns: TaskColumn[];
  placeholder: string;
  /** Qué decir cuando no queda ninguna fila. */
  empty: string;
}

/**
 * La lista de tareas con su rail de facetas. La usan la Biblioteca y la bandeja de
 * Importaciones, que solo se diferencian en qué acotan y qué facetas enseñan.
 *
 * Aquí vive solo el qué se pide; el cómo se ve está en `TaskBrowserView`, para poder
 * renderizarlo con datos de prueba y mirarlo sin sesión.
 *
 * Todo el estado está en la URL: buscar, filtrar y paginar producen un enlace que lleva
 * exactamente a lo que se está viendo.
 */
export function TaskBrowser({ rail, fixed, target, columns, placeholder, empty }: TaskBrowserProps) {
  const { params, set, clear } = useUrlState();
  const [draft, setDraft, query] = useDebouncedParam('q');

  const grupos = rail.map((k) => RAIL[k]);
  const seleccion: Record<string, string | null> = {};
  for (const g of grupos) seleccion[g.param] = params.get(g.param);

  const page = Math.max(0, Number(params.get('p') ?? '0') || 0);
  const bool = (v: string | null) => (v === null ? null : v === 'true');

  const filtro: TaskListFilter = {
    query,
    domainId: null,
    processId: params.get('proc'),
    pattern: params.get('pat'),
    status: params.get('est'),
    source: params.get('src') ? [params.get('src') as string] : null,
    occupationId: params.get('ocu'),
    risk: params.get('riesgo'),
    apqcLevel: params.get('nivel'),
    hasComposition: bool(params.get('comp')),
    curated: null,
    onlyUsed: bool(params.get('usada')),
    ...fixed,
  };

  const clave = JSON.stringify(filtro);
  const cargar = useCallback(
    async (signal: AbortSignal) => {
      const f = JSON.parse(clave) as TaskListFilter;
      const [rows, facets] = await Promise.all([
        browseTasks(f, { limit: PAGE_SIZE, offset: page * PAGE_SIZE }, signal),
        taskFacets(f, signal),
      ]);
      return { rows, facets };
    },
    [clave, page],
  );
  const { state, reload } = useAsyncData(cargar);

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorNotice error={state.error} onRetry={reload} />;

  return (
    <TaskBrowserView
      groups={grupos}
      facets={state.data.facets}
      selected={seleccion}
      onFacet={set}
      onClearFacets={() => clear(grupos.map((g) => g.param))}
      search={draft}
      onSearch={setDraft}
      placeholder={placeholder}
      rows={state.data.rows}
      total={state.data.rows[0]?.total_count ?? 0}
      page={page}
      onPage={(p) => set('p', p > 0 ? String(p) : null)}
      target={target}
      columns={columns}
      empty={empty}
    />
  );
}
