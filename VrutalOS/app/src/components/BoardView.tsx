import { formatDateOnly } from '../lib/format';
import type { Board, BoardCard, BoardPriority, Specialist } from '../lib/types';
import { agentTone } from '../lib/specialistCopy';

// Vista pura del tablero: no sabe de red ni de sesión, solo de pintar. Misma separación que
// TaskBrowser/TaskBrowserView en el panel de staff — así se puede mirar el layout con datos
// de ejemplo sin levantar una sesión.
//
// El tablero enseña a TODOS los agentes a la vez (decisión 2026-10-23). Para que no se mezclen,
// cada tarjeta lleva el color y el nombre de su agente; el agente es un filtro de esta pantalla,
// no una pantalla distinta.

const PRIORIDAD: Record<BoardPriority, { label: string; tono: string }> = {
  urgent: { label: 'Urgente', tono: 'pill--bad' },
  high: { label: 'Alta', tono: 'pill--warn' },
  medium: { label: 'Media', tono: '' },
  low: { label: 'Baja', tono: '' },
  'no-priority': { label: '', tono: '' },
};

interface BoardViewProps {
  board: Board;
  /** Todos los agentes que esta persona puede ver, en el orden en que se enseñan. */
  specialists: Specialist[];
  /** Vacío = se ven todos. Con algo dentro, solo esos. */
  filtro: Set<string>;
  onToggleFiltro: (specialistId: string) => void;
  onLimpiarFiltro: () => void;
  /** Cuántos comentarios tiene cada tarjeta, por id. Lo que no esté, no tiene. */
  commentCount?: Record<string, number>;
  onOpenCard: (card: BoardCard) => void;
}

/** La referencia corta que ve la gente: MKT-12. Sin número todavía, solo el prefijo. */
function referencia(board: Board, card: BoardCard): string {
  const slug = board.projectSlug[card.project_id] ?? '';
  return card.number === null ? slug : `${slug}-${card.number}`;
}

export function BoardView({
  board,
  specialists,
  filtro,
  onToggleFiltro,
  onLimpiarFiltro,
  commentCount = {},
  onOpenCard,
}: BoardViewProps) {
  const porAgente = new Map(specialists.map((s) => [s.id, s]));
  const visibles = filtro.size === 0 ? board.cards : board.cards.filter((c) => filtro.has(c.specialist_id));

  // Una tarjeta puede estar en un estado que no es ninguna columna (Kaneo admite estados
  // virtuales). En vez de esconderla, se pinta al final en su propia columna.
  const slugs = board.columns.map((c) => c.slug);
  const sueltas = [...new Set(visibles.map((c) => c.status).filter((s) => !slugs.includes(s)))];
  const columnas = [
    ...board.columns.map((c) => ({ slug: c.slug, name: c.name })),
    ...sueltas.map((s) => ({ slug: s, name: s })),
  ];

  return (
    <>
      <div className="board__specs" role="group" aria-label="Filtrar por agente">
        <button
          type="button"
          className="chip"
          aria-pressed={filtro.size === 0}
          onClick={onLimpiarFiltro}
        >
          Todos
          <span className="chip__count">{board.cards.length}</span>
        </button>
        {specialists.map((s) => {
          const cuantas = board.cards.filter((c) => c.specialist_id === s.id).length;
          return (
            <button
              key={s.id}
              type="button"
              className={`chip agente agente--${agentTone(s.job_role_key)}`}
              aria-pressed={filtro.has(s.id)}
              onClick={() => onToggleFiltro(s.id)}
            >
              <span className="agente__punto" aria-hidden="true" />
              {s.display_name}
              <span className="chip__count">{cuantas}</span>
            </button>
          );
        })}
      </div>

      <div className="board">
        {columnas.map((col) => {
          const enColumna = visibles.filter((c) => c.status === col.slug);
          return (
            <section key={col.slug} className="board__col">
              <div className="board__colhead">
                <span className="eyebrow">{col.name}</span>
                <span className="board__count">{enColumna.length}</span>
              </div>
              {enColumna.length === 0 ? (
                <p className="board__vacia">—</p>
              ) : (
                enColumna.map((card) => {
                  const prio = card.priority ? PRIORIDAD[card.priority] : null;
                  const comentarios = commentCount[card.id] ?? 0;
                  const agente = porAgente.get(card.specialist_id);
                  const tono = agente ? agentTone(agente.job_role_key) : 0;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`board__card agente agente--${tono}`}
                      onClick={() => onOpenCard(card)}
                    >
                      <span className="board__quien">
                        <span className="board__ref mono">{referencia(board, card)}</span>
                        <span className="board__agente">
                          <span className="agente__punto" aria-hidden="true" />
                          {agente?.display_name ?? 'Agente retirado'}
                        </span>
                      </span>
                      <span className="board__title">{card.title}</span>
                      <span className="board__meta">
                        {prio && prio.label && <span className={`pill ${prio.tono}`}>{prio.label}</span>}
                        {card.origin === 'cliente' && <span className="pill pill--pending">Pedida por ti</span>}
                        {card.labels.map((l) => (
                          <span key={l} className="chip chip--sm">
                            {l}
                          </span>
                        ))}
                      </span>
                      <span className="board__foot">
                        <span className="muted">{card.assignee_name ?? 'Sin asignar'}</span>
                        {card.due_date && <span className="muted">Para el {formatDateOnly(card.due_date)}</span>}
                        {comentarios > 0 && (
                          <span className="muted">
                            {comentarios} {comentarios === 1 ? 'comentario' : 'comentarios'}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
