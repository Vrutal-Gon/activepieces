import { Link } from 'react-router';
import { PageHead, type Crumb } from '../components/PageHead';
import { TaskBrowser } from '../components/TaskBrowser';
import '../styles/pages/catalog.css';

export type TaskTab = 'ficha' | 'composiciones' | 'roles';

interface TaskListProps {
  /** Pestaña de la ficha a la que lleva cada fila. */
  target: TaskTab;
  crumbs: Crumb[];
  title: string;
}

/**
 * La biblioteca de tareas: las que alguien ya ha tocado (tienen proceso, patrón, o un rol
 * que las usa, o nacieron internas).
 *
 * Las ~1.050 importadas de O*NET y APQC que nadie ha mirado todavía NO salen aquí: viven en
 * `/importaciones`. Mezcladas eran 1.147 filas en inglés donde buscar en castellano no
 * devolvía nada y los filtros de proceso y departamento alcanzaban al 7 % del catálogo.
 */
export function TaskList({ target, crumbs, title }: TaskListProps) {
  return (
    <section>
      <PageHead crumbs={crumbs} title={title}>
        <Link className="btn btn--ghost" to="/importaciones">
          Ver importaciones
        </Link>
        <Link className="btn btn--primary" to="/tareas/nueva">
          + Nueva tarea
        </Link>
      </PageHead>

      <TaskBrowser
        rail={['montaje', 'uso', 'estado', 'patron', 'proceso', 'riesgo']}
        fixed={{ curated: true }}
        target={target}
        columns={['tipo', 'roles', 'pasos']}
        placeholder="Buscar por código o enunciado…"
        empty="Ninguna tarea curada coincide con el filtro. Las importadas sin revisar están en Importaciones."
      />
    </section>
  );
}
