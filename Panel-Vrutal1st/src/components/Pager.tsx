interface PagerProps {
  /** Página actual, empezando en 0. */
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}

/** Paginador de una lista. La página vive en la URL (`?p`), así que recargar no la pierde. */
export function Pager({ page, total, pageSize, onPage }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const desde = page * pageSize + 1;
  const hasta = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="table-card__foot">
      <button type="button" className="btn btn--sm btn--ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>
        ← Anterior
      </button>
      <span className="mono">
        {desde}–{hasta} de {total}
      </span>
      <button
        type="button"
        className="btn btn--sm btn--ghost"
        disabled={page + 1 >= pages}
        onClick={() => onPage(page + 1)}
      >
        Siguiente →
      </button>
    </div>
  );
}
