import { Link, useSearchParams } from 'react-router';
import { PageHead } from '../components/PageHead';
import { TaskBrowser } from '../components/TaskBrowser';
import '../styles/pages/catalog.css';

type Vista = 'tareas' | 'taxonomia';

/**
 * La bandeja de lo importado y aún sin revisar: 1.053 de las 1.147 filas de `catalog.task`.
 *
 * Dos pilas que NO son lo mismo, y por eso no comparten lista:
 *
 *   · **Tareas por curar** (O*NET, inglés crudo). Son tareas de verdad: les falta proceso y
 *     patrón. Se curan en su Ficha, y al guardarlos salen de aquí solas y aparecen en la
 *     Biblioteca. La ocupación es lo único que las parte en grupos manejables.
 *
 *   · **Árbol APQC** (665 filas, niveles L1 a L4). NO son tareas: son la jerarquía PCF, con
 *     enunciados como «L1 | 1.0 Develop Vision and Strategy». Entraron en la tabla de
 *     tareas en una importación y contaminaban toda búsqueda. Se dejan aquí como referencia
 *     de taxonomía, no como cola de trabajo.
 */
export function ImportInbox() {
  const [params, setParams] = useSearchParams();
  const vista: Vista = params.get('vista') === 'taxonomia' ? 'taxonomia' : 'tareas';

  function cambiarVista(v: Vista) {
    // Las facetas de una vista no significan nada en la otra: se empieza limpio.
    setParams(v === 'tareas' ? {} : { vista: v });
  }

  return (
    <section>
      <PageHead crumbs={[{ label: 'Entrada' }]} title="Importaciones">
        <Link className="btn btn--ghost" to="/tareas">
          Ir a la biblioteca
        </Link>
      </PageHead>

      <nav className="client-tabs" aria-label="Qué importación">
        <button
          type="button"
          className="client-tabs__tab"
          aria-current={vista === 'tareas' ? 'page' : undefined}
          onClick={() => cambiarVista('tareas')}
        >
          Tareas por curar
        </button>
        <button
          type="button"
          className="client-tabs__tab"
          aria-current={vista === 'taxonomia' ? 'page' : undefined}
          onClick={() => cambiarVista('taxonomia')}
        >
          Árbol APQC
        </button>
      </nav>

      {vista === 'tareas' ? (
        <>
          <p className="catalog-note">
            Enunciados tal y como llegaron de O*NET, en inglés y sin clasificar. Abre una y rellena proceso y
            patrón en su Ficha: al guardarla pasa a la biblioteca.
          </p>
          <TaskBrowser
            key="tareas"
            rail={['ocupacion', 'uso', 'estado']}
            fixed={{ curated: false, source: ['onet'] }}
            target="ficha"
            columns={['ocupacion', 'roles']}
            placeholder="Buscar en lo importado…"
            empty="No queda nada por curar con ese filtro."
          />
        </>
      ) : (
        <>
          <p className="catalog-note">
            La jerarquía de procesos de APQC, importada dentro de la tabla de tareas. No son tareas y no se
            curan: sirven para situar un proceso. Los 478 nodos L4 son el nivel más fino.
          </p>
          <TaskBrowser
            key="taxonomia"
            rail={['nivel', 'uso']}
            fixed={{ curated: null, source: ['apqc'] }}
            target="ficha"
            columns={['origen', 'roles']}
            placeholder="Buscar en el árbol APQC…"
            empty="Ningún nodo coincide con el filtro."
          />
        </>
      )}
    </section>
  );
}
