import { PendingPanel } from '../components/Pending';

interface PendingPageProps {
  eyebrow: string;
  title: string;
  source: string;
}

/** Sección del diseño aprobado cuya fuente de datos aún no existe. */
export function PendingPage({ eyebrow, title, source }: PendingPageProps) {
  return (
    <section>
      <header className="page-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="page-head__title">{title}</h1>
        </div>
      </header>
      <PendingPanel title="Sin fuente de datos todavía" source={source} />
    </section>
  );
}
