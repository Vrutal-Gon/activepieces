// Diseño aprobado, datos aún sin fuente: se muestra el componente con su explicación, nunca datos inventados.

interface PendingPanelProps {
  title: string;
  source: string;
}

export function PendingPanel({ title, source }: PendingPanelProps) {
  return (
    <div className="pending-panel">
      <span className="pill pill--pending">pendiente</span>
      <h2 className="pending-panel__title">{title}</h2>
      <p className="pending-panel__source">{source}</p>
    </div>
  );
}

/** Valor de un dato que aún no tiene fuente (tiles, cabeceras, celdas). */
export function PendingValue({ hint }: { hint: string }) {
  return (
    <span className="pending-value" title={hint}>
      —<span className="visually-hidden"> ({hint})</span>
    </span>
  );
}
