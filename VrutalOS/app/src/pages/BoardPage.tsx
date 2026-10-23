import { useCallback, useEffect, useRef, useState } from 'react';
import { addCardComment, createCard, listBoard, listCardComments } from '../lib/api/board';
import { listVisibleSpecialists } from '../lib/api/specialists';
import { errorMessage } from '../lib/api/client';
import { formatDateTime } from '../lib/format';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { agentTone } from '../lib/specialistCopy';
import type { Board, BoardCard, BoardComment, Profile, Specialist } from '../lib/types';
import { BoardView } from '../components/BoardView';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import '../styles/pages/tablero.css';

// Tablero: en qué se está trabajando. Entre el resultado (entregables, aprobaciones) y la nada,
// que era lo que había hasta ahora.
//
// Se ven TODOS los agentes a la vez (decisión 2026-10-23). El cliente quiere saber de un vistazo
// en qué anda su equipo entero; que cada agente tuviera su pantalla obligaba a ir uno por uno
// para enterarse. Cada tarjeta lleva el color y el nombre del suyo, y el agente pasa a ser un
// FILTRO de esta pantalla, no una pantalla distinta.
//
// Es de lectura salvo dos cosas: pedir una tarea y comentar, las dos por la Edge Function
// `board-write`. Mover una tarjeta de columna NO es del cliente: el estado del trabajo lo fija
// Vrutal. La fuente es Kaneo; esta pantalla lee el espejo que deja `board-sync` cada 5 minutos.

export function BoardPage({ profile }: { profile: Profile }) {
  const cargarEspecialistas = useCallback(
    (signal: AbortSignal) => listVisibleSpecialists(profile, signal),
    [profile],
  );
  const { state: especialistas, reload: recargarEspecialistas } = useAsyncData(cargarEspecialistas);

  const visibles: Specialist[] = especialistas.status === 'ready' ? especialistas.data : [];
  // `join` y no el array: el array se recrea en cada render y el efecto no pararía de dispararse.
  const idsVisibles = visibles.map((s) => s.id).join(',');

  const cargarTablero = useCallback(
    (signal: AbortSignal): Promise<Board | null> =>
      idsVisibles === '' ? Promise.resolve(null) : listBoard(idsVisibles.split(','), signal),
    [idsVisibles],
  );
  const { state: tablero, reload: recargarTablero, refresh: refrescarTablero } = useAsyncData(cargarTablero);

  /** Vacío = se ven todos. El filtro es de la pantalla: no cambia lo que el servidor deja leer. */
  const [filtro, setFiltro] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<BoardCard | null>(null);
  const [pidiendo, setPidiendo] = useState(false);

  const datos = tablero.status === 'ready' ? tablero.data : null;
  const conTablero = visibles.filter((s) => datos?.withBoard.includes(s.id));

  function alternarFiltro(id: string) {
    setFiltro((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  return (
    <section>
      <PageHead crumbs={[{ label: 'Mi trabajo' }]} title="Tablero">
        {conTablero.length > 0 && (
          <button type="button" className="btn btn--primary" onClick={() => setPidiendo(true)}>
            Pedir una tarea
          </button>
        )}
      </PageHead>
      <p className="lead">
        En qué está trabajando tu equipo ahora mismo, todos los agentes juntos. Pulsa uno para ver solo lo suyo; si
        algo te falta o quieres aportar, pide una tarea o comenta la que ya existe.
      </p>

      {especialistas.status === 'loading' && <LoadingState />}
      {especialistas.status === 'error' && <ErrorNotice error={especialistas.error} onRetry={recargarEspecialistas} />}

      {especialistas.status === 'ready' && visibles.length === 0 && (
        <div className="empty-state">
          <h2 className="empty-state__title">Todavía no tienes especialistas</h2>
          <p className="empty-state__body">
            {profile.role === 'client_admin'
              ? 'Cuando Vrutal active el primero, su tablero aparecerá aquí.'
              : 'Pide a tu administrador que te habilite alguno.'}
          </p>
        </div>
      )}

      {visibles.length > 0 && tablero.status === 'loading' && <LoadingState />}
      {tablero.status === 'error' && <ErrorNotice error={tablero.error} onRetry={recargarTablero} />}

      {datos && datos.columns.length === 0 && (
        <div className="empty-state">
          <h2 className="empty-state__title">Todavía no hay tablero</h2>
          <p className="empty-state__body">Aparecerá en cuanto el equipo de Vrutal empiece a trabajar.</p>
        </div>
      )}

      {datos && datos.columns.length > 0 && (
        <BoardView
          board={datos}
          specialists={visibles}
          filtro={filtro}
          onToggleFiltro={alternarFiltro}
          onLimpiarFiltro={() => setFiltro(new Set())}
          onOpenCard={setAbierta}
        />
      )}

      {abierta && datos && (
        <CardDialog
          board={datos}
          card={abierta}
          agente={visibles.find((s) => s.id === abierta.specialist_id) ?? null}
          onClose={() => setAbierta(null)}
          onComment={() => refrescarTablero()}
        />
      )}
      {pidiendo && conTablero.length > 0 && (
        <NewCardDialog
          specialists={conTablero}
          // Si hay un solo agente filtrado, se asume que es a ese a quien se le pide.
          inicial={(filtro.size === 1 ? conTablero.find((s) => filtro.has(s.id))?.id : undefined) ?? conTablero[0].id}
          onClose={() => setPidiendo(false)}
          onCreated={() => {
            setPidiendo(false);
            refrescarTablero();
          }}
        />
      )}
    </section>
  );
}

/** `<dialog>` nativo: cierra con Esc y atrapa el foco sin que haya que escribirlo. */
function Dialogo({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialogo"
      onClose={onClose}
      onClick={(e) => {
        // Clic fuera del contenido (sobre el propio dialog, que ocupa el backdrop): cerrar.
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div className="dialogo__caja">{children}</div>
    </dialog>
  );
}

interface CardDialogProps {
  board: Board;
  card: BoardCard;
  /** De quién es la tarea. Nulo solo si el agente se ha retirado desde la última sincronización. */
  agente: Specialist | null;
  onClose: () => void;
  onComment: () => void;
}

function CardDialog({ board, card, agente, onClose, onComment }: CardDialogProps) {
  const cargar = useCallback((signal: AbortSignal) => listCardComments(card.id, signal), [card.id]);
  const { state, refresh } = useAsyncData(cargar);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const columna = board.columns.find((c) => c.slug === card.status);
  const slug = board.projectSlug[card.project_id] ?? '';
  const ref = card.number === null ? slug : `${slug}-${card.number}`;

  async function enviar() {
    const limpio = texto.trim();
    if (limpio === '' || enviando) return;
    setEnviando(true);
    setFallo(null);
    try {
      await addCardComment(card.id, limpio);
      setTexto('');
      refresh();
      onComment();
    } catch (e) {
      setFallo(errorMessage(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo onClose={onClose}>
      <header className={`dialogo__head agente agente--${agente ? agentTone(agente.job_role_key) : 0}`}>
        <div>
          <h2 className="dialogo__title">{card.title}</h2>
          <p className="muted">
            <span className="agente__punto" aria-hidden="true" />
            {agente?.display_name ?? 'Agente retirado'} · <span className="mono">{ref}</span> ·{' '}
            {columna?.name ?? card.status}
            {card.assignee_name ? ` · ${card.assignee_name}` : ''}
          </p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
          Cerrar
        </button>
      </header>

      {card.description && <p className="dialogo__body">{card.description}</p>}

      <h3 className="eyebrow">Conversación</h3>
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} />}
      {state.status === 'ready' && state.data.length === 0 && <p className="muted">Todavía no hay comentarios.</p>}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className="hilo">
          {state.data.map((c: BoardComment) => (
            <li key={c.id} className="hilo__item">
              <span className="hilo__autor">{c.author_name}</span>
              <span className="hilo__cuando muted">{formatDateTime(c.kaneo_created_at)}</span>
              <p className="hilo__texto">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="form-field">
        <label className="form-field__label" htmlFor="board-comentario">
          Comentar
        </label>
        <textarea
          id="board-comentario"
          className="text-input"
          rows={3}
          maxLength={10000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Lo que quieras decirle al equipo sobre esta tarea"
        />
      </div>
      {fallo && (
        <p className="notice notice--error" role="alert">
          {fallo}
        </p>
      )}
      <div className="dialogo__acciones">
        <button type="button" className="btn btn--primary" onClick={enviar} disabled={enviando || texto.trim() === ''}>
          {enviando ? 'Enviando…' : 'Enviar comentario'}
        </button>
      </div>
    </Dialogo>
  );
}

interface NewCardDialogProps {
  /** Solo los agentes que tienen tablero: a los demás no hay dónde escribirles. */
  specialists: Specialist[];
  inicial: string;
  onClose: () => void;
  onCreated: () => void;
}

function NewCardDialog({ specialists, inicial, onClose, onCreated }: NewCardDialogProps) {
  const [specialistId, setSpecialistId] = useState(inicial);
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function pedir() {
    const limpio = titulo.trim();
    if (limpio === '' || enviando) return;
    setEnviando(true);
    setFallo(null);
    try {
      await createCard(specialistId, limpio, detalle.trim());
      onCreated();
    } catch (e) {
      setFallo(errorMessage(e));
      setEnviando(false);
    }
  }

  return (
    <Dialogo onClose={onClose}>
      <header className="dialogo__head">
        <h2 className="dialogo__title">Pedir una tarea</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
          Cerrar
        </button>
      </header>

      <div className="form-field">
        <label className="form-field__label" htmlFor="board-agente">
          A quién se lo pides
        </label>
        <select
          id="board-agente"
          className="text-input"
          value={specialistId}
          onChange={(e) => setSpecialistId(e.target.value)}
          disabled={specialists.length === 1}
        >
          {specialists.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="board-titulo">
          Qué necesitas
        </label>
        <input
          id="board-titulo"
          className="text-input"
          maxLength={300}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Revisar el tono de los últimos posts"
        />
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="board-detalle">
          Detalle (opcional)
        </label>
        <textarea
          id="board-detalle"
          className="text-input"
          rows={4}
          maxLength={20000}
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          placeholder="Lo que haga falta para entenderlo sin preguntarte"
        />
      </div>
      <p className="muted">
        Entra en la primera columna de su tablero, marcada como pedida por ti. El equipo decide cuándo la coge.
      </p>
      {fallo && (
        <p className="notice notice--error" role="alert">
          {fallo}
        </p>
      )}
      <div className="dialogo__acciones">
        <button type="button" className="btn btn--primary" onClick={pedir} disabled={enviando || titulo.trim() === ''}>
          {enviando ? 'Pidiendo…' : 'Pedirla'}
        </button>
      </div>
    </Dialogo>
  );
}
