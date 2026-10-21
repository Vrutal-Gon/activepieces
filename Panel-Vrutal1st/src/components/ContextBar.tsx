import { Link } from 'react-router';

interface ContextBarProps {
  /** Desde dónde se llegó: «SDR v1». */
  label: string;
  /** Volver al sitio del que se vino. */
  backTo: string;
  /** La misma pantalla sin el contexto puesto. */
  clearTo: string;
  /** Qué cambia por estar en este contexto. */
  hint?: string;
}

/**
 * El hilo que se estaba siguiendo, visible.
 *
 * El parámetro `?rol=` ya existía y ya hacía su trabajo —clasificación y overrides de ese
 * rol— pero era invisible: nada en pantalla decía desde dónde habías llegado ni cómo
 * volver, así que al tercer salto ya no sabías en qué estabas.
 */
export function ContextBar({ label, backTo, clearTo, hint }: ContextBarProps) {
  return (
    <div className="context-bar" role="note">
      <span className="context-bar__label">Trabajando desde</span>
      <Link className="context-bar__who" to={backTo}>
        {label}
      </Link>
      {hint && <span className="context-bar__hint">{hint}</span>}
      <Link className="context-bar__clear" to={clearTo}>
        Quitar contexto
      </Link>
    </div>
  );
}
