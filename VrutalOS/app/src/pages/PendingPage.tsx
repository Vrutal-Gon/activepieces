interface PendingPageProps {
  eyebrow: string;
  title: string;
  /** Qué datos la alimentarán. Solo se enseña en desarrollo: el cliente no debe ver nombres de tablas. */
  source: string;
}

/** Sección del diseño aprobado todavía sin construir. */
export function PendingPage({ eyebrow, title, source }: PendingPageProps) {
  return (
    <section>
      <header className="page-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="page-head__title">{title}</h1>
        </div>
      </header>
      <div className="pending-panel">
        <span className="pill pill--pending">próximamente</span>
        <h2 className="pending-panel__title">Esta sección estará disponible pronto</h2>
        {import.meta.env.DEV && <p className="pending-panel__source">Fuente de datos: {source}</p>}
      </div>
    </section>
  );
}
