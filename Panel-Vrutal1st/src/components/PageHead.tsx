import type { ReactNode } from 'react';
import { Link } from 'react-router';

export interface Crumb {
  label: string;
  to?: string;
}

interface PageHeadProps {
  /** Camino hasta la página actual; la página actual va en `title`, no aquí. */
  crumbs: Crumb[];
  title: ReactNode;
  /** Acciones a la derecha (chips, botones). */
  children?: ReactNode;
}

export function PageHead({ crumbs, title, children }: PageHeadProps) {
  return (
    <header className="page-head">
      <div>
        <nav aria-label="Ruta">
          <ol className="crumbs">
            {crumbs.map((c) => (
              <li key={`${c.label}:${c.to ?? ''}`} className="crumbs__item">
                {c.to ? (
                  <Link className="crumbs__link" to={c.to}>
                    {c.label}
                  </Link>
                ) : (
                  <span className="eyebrow">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="page-head__title">{title}</h1>
      </div>
      {children}
    </header>
  );
}
