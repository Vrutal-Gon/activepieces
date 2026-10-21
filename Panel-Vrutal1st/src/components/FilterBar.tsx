import type { TaskFacet } from '../lib/types';

export interface FacetGroup {
  /** Nombre de la faceta tal y como la devuelve `catalog_task_facets`. */
  facet: string;
  /** Cabecera visible del grupo. */
  label: string;
  /** Parámetro de la URL donde se guarda la selección. */
  param: string;
  /** Traducción del valor crudo a algo legible, cuando el servidor no manda etiqueta. */
  copy?: Record<string, string>;
}

/** Hasta aquí las opciones caben como botones; a partir de aquí, desplegable. */
const MAX_CHIPS = 3;

interface FilterBarProps {
  groups: FacetGroup[];
  facets: TaskFacet[];
  /** Valor seleccionado de cada parámetro, o null. */
  selected: Record<string, string | null>;
  onChange: (param: string, value: string | null) => void;
  onClearAll: () => void;
}

/**
 * Los filtros, en horizontal sobre la tabla.
 *
 * Antes era un rail lateral y no funcionaba por dos razones medidas sobre el catálogo real:
 * se llevaba 240 px de ancho que le hacían falta a la columna del enunciado (los textos de
 * O*NET envolvían a tres líneas y solo entraban seis filas de veinticinco en pantalla), y
 * trataba igual dos clases de faceta que no lo son. Montaje, Uso o Estado tienen dos o tres
 * valores y se leen de un vistazo; Proceso u Ocupación tienen entre doce y veinticuatro. En
 * una columna, las cortas desperdician alto y las largas no caben.
 *
 * Aquí cada grupo elige su forma según cuántos valores tenga, y el recuento viaja con la
 * opción en los dos casos: sin saber cuántas tareas da cada valor, filtrar sobre mil filas
 * es ir a ciegas.
 */
export function FilterBar({ groups, facets, selected, onChange, onClearAll }: FilterBarProps) {
  const activos = Object.entries(selected).filter(([, v]) => v !== null && v !== '');

  return (
    <div className="filter-bar">
      {groups.map((g) => {
        const opciones = facets.filter((f) => f.facet === g.facet && f.value !== null);
        if (opciones.length === 0) return null;
        const elegido = selected[g.param] ?? null;
        const etiqueta = (o: TaskFacet) => g.copy?.[o.value as string] ?? o.label ?? o.value;

        if (opciones.length <= MAX_CHIPS) {
          return (
            <div key={g.param} className="filter-bar__group" role="group" aria-label={g.label}>
              <span className="filter-bar__label">{g.label}</span>
              <div className="chip-group">
                {opciones.map((o) => {
                  const value = o.value as string;
                  const activo = elegido === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      className="chip"
                      aria-pressed={activo}
                      onClick={() => onChange(g.param, activo ? null : value)}
                    >
                      {etiqueta(o)} <span className="chip__count">{o.n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <label key={g.param} className="filter-bar__group filter-bar__group--select">
            <span className="filter-bar__label">{g.label}</span>
            <select
              className="text-input"
              value={elegido ?? ''}
              data-active={elegido ? 'true' : undefined}
              onChange={(e) => onChange(g.param, e.target.value || null)}
            >
              <option value="">Todos</option>
              {opciones.map((o) => (
                <option key={o.value as string} value={o.value as string}>
                  {etiqueta(o)} ({o.n})
                </option>
              ))}
            </select>
          </label>
        );
      })}

      {activos.length > 0 && (
        <button type="button" className="btn-link filter-bar__clear" onClick={onClearAll}>
          Quitar {activos.length} {activos.length === 1 ? 'filtro' : 'filtros'}
        </button>
      )}
    </div>
  );
}
