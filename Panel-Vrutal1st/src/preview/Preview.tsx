import { useState } from 'react';
import { Link } from 'react-router';
import { PageHead } from '../components/PageHead';
import { RAIL, TaskBrowserView, type RailKey, type TaskColumn } from '../components/TaskBrowserView';
import { FACETAS_BIBLIOTECA, FACETAS_IMPORTADAS, TAREAS_BIBLIOTECA, TAREAS_IMPORTADAS } from './fixtures';
import '../styles/pages/catalog.css';

type Pantalla = 'biblioteca' | 'importaciones';

const PANTALLAS: Record<
  Pantalla,
  {
    titulo: string;
    migas: string;
    rail: RailKey[];
    columnas: TaskColumn[];
    placeholder: string;
    rows: typeof TAREAS_BIBLIOTECA;
    facets: typeof FACETAS_BIBLIOTECA;
    total: number;
  }
> = {
  biblioteca: {
    titulo: 'Tareas',
    migas: 'Biblioteca',
    rail: ['montaje', 'uso', 'estado', 'patron', 'proceso', 'riesgo'],
    columnas: ['tipo', 'roles', 'pasos'],
    placeholder: 'Buscar por código o enunciado…',
    rows: TAREAS_BIBLIOTECA,
    facets: FACETAS_BIBLIOTECA,
    total: 94,
  },
  importaciones: {
    titulo: 'Importaciones',
    migas: 'Entrada',
    rail: ['ocupacion', 'uso', 'estado'],
    columnas: ['ocupacion', 'roles'],
    placeholder: 'Buscar en lo importado…',
    rows: TAREAS_IMPORTADAS,
    facets: FACETAS_IMPORTADAS,
    total: 391,
  },
};

/**
 * Banco de pruebas del layout del catálogo: monta las pantallas reales con datos de prueba,
 * sin Supabase ni sesión, para poder mirarlas y ajustar el CSS viendo lo que se ajusta.
 *
 * No entra en la app: vive en `preview.html`, que Vite sirve en desarrollo y no incluye en
 * el build (solo compila `index.html`).
 */
export function Preview() {
  // La pantalla se elige por ?p= para que el script de capturas no dependa de hacer clic
  // en un menú que en móvil está fuera de viewport.
  const inicial = new URLSearchParams(window.location.search).get('p');
  const [pantalla, setPantalla] = useState<Pantalla>(inicial === 'importaciones' ? 'importaciones' : 'biblioteca');
  const [seleccion, setSeleccion] = useState<Record<string, string | null>>({});
  const [busqueda, setBusqueda] = useState('');
  const p = PANTALLAS[pantalla];

  return (
    <div className="shell" data-workspace="plataforma">
      <aside className="shell__side">
        <img className="shell__logo" src="/vrutal-lockup-dark.svg" alt="Vrutal Labs" />
        <nav aria-label="Principal">
          <div className="side-nav__group">
            <span className="eyebrow side-nav__label">Construir</span>
            <Link className="side-nav__link" to="#">
              <span className="side-nav__icon" aria-hidden="true">
                ◆
              </span>
              Especialistas
            </Link>
          </div>
          <div className="side-nav__group">
            <span className="eyebrow side-nav__label">Biblioteca</span>
            <button
              type="button"
              className="side-nav__link"
              aria-current={pantalla === 'biblioteca' ? 'page' : undefined}
              onClick={() => setPantalla('biblioteca')}
            >
              <span className="side-nav__icon" aria-hidden="true">
                ☰
              </span>
              Tareas
            </button>
            <Link className="side-nav__link" to="#">
              <span className="side-nav__icon" aria-hidden="true">
                ⇶
              </span>
              Composiciones
            </Link>
            <Link className="side-nav__link" to="#">
              <span className="side-nav__icon" aria-hidden="true">
                ▤
              </span>
              Bloques
            </Link>
          </div>
          <div className="side-nav__group">
            <span className="eyebrow side-nav__label">Entrada</span>
            <button
              type="button"
              className="side-nav__link"
              aria-current={pantalla === 'importaciones' ? 'page' : undefined}
              onClick={() => setPantalla('importaciones')}
            >
              <span className="side-nav__icon" aria-hidden="true">
                ⇲
              </span>
              Importaciones
            </button>
          </div>
          <div className="side-nav__group">
            <span className="eyebrow side-nav__label">Referencias</span>
            <Link className="side-nav__link" to="#">
              <span className="side-nav__icon" aria-hidden="true">
                ⧉
              </span>
              Stack / Sistemas
            </Link>
            <Link className="side-nav__link" to="#">
              <span className="side-nav__icon" aria-hidden="true">
                ◌
              </span>
              Proveedores
            </Link>
          </div>
        </nav>
        <p className="shell__foot">Vrutal1st · banco de pruebas</p>
      </aside>

      <div className="shell__body">
        <div className="shell__head">
          <div className="workspace-band" role="note">
            <span className="workspace-band__label">Plataforma</span>
            <span className="workspace-band__text">
              Estás editando el catálogo global: los cambios afectan a todos los clientes
            </span>
          </div>
          <header className="topbar">
            <div className="search">
              <span className="search__icon" aria-hidden="true">
                ⌕
              </span>
              <input className="search__input" type="search" placeholder="Buscar cliente, rol, tarea, bloque…" />
              <kbd className="search__kbd">Ctrl K</kbd>
            </div>
            <span className="topbar__env">DEV</span>
            <span className="topbar__spacer" />
          </header>
        </div>

        <main className="shell__main">
          <section>
            <PageHead crumbs={[{ label: p.migas }]} title={p.titulo}>
              {pantalla === 'biblioteca' ? (
                <>
                  <Link className="btn btn--ghost" to="#">
                    Ver importaciones
                  </Link>
                  <Link className="btn btn--primary" to="#">
                    + Nueva tarea
                  </Link>
                </>
              ) : (
                <Link className="btn btn--ghost" to="#">
                  Ir a la biblioteca
                </Link>
              )}
            </PageHead>

            <TaskBrowserView
              groups={p.rail.map((k) => RAIL[k])}
              facets={p.facets}
              selected={seleccion}
              onFacet={(param, value) => setSeleccion((s) => ({ ...s, [param]: value }))}
              onClearFacets={() => setSeleccion({})}
              search={busqueda}
              onSearch={setBusqueda}
              placeholder={p.placeholder}
              rows={p.rows}
              total={p.total}
              page={0}
              onPage={() => {}}
              target="composiciones"
              columns={p.columnas}
              empty="Ninguna tarea coincide con el filtro."
            />
          </section>
        </main>
      </div>
    </div>
  );
}
