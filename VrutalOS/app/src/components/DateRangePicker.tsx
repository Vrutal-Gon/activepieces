import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatDateOnly } from '../lib/format';
import '../styles/daterange.css';

// Calendario de rango, como el de una web de vuelos: dos meses a la vista, se pulsa el día de
// inicio y luego el de fin, y el tramo queda pintado. Sin dependencias: la app no trae ninguna
// librería de fechas y una estrategia SEM no justifica meterla.
//
// Las fechas van y vienen en ISO (AAAA-MM-DD), que es lo que guarda una columna `date` de Postgres.
// Nunca se construye un Date a partir de la cadena completa (`new Date('2026-10-20')` se interpreta
// en UTC y en España puede retroceder un día): se parte en número de año, mes y día.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** La semana empieza en lunes. */
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Dia {
  iso: string;
  numero: number;
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function partes(valor: string): { y: number; m: number; d: number } | null {
  const trozos = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!trozos) return null;
  return { y: Number(trozos[1]), m: Number(trozos[2]) - 1, d: Number(trozos[3]) };
}

/** Las celdas de un mes, con los huecos del principio hasta el primer lunes. */
function celdas(y: number, m: number): Array<Dia | null> {
  const primero = new Date(y, m, 1);
  // getDay() da 0 para domingo; la semana empieza en lunes, así que el domingo pasa a 6.
  const hueco = (primero.getDay() + 6) % 7;
  const ultimo = new Date(y, m + 1, 0).getDate();
  const out: Array<Dia | null> = Array.from({ length: hueco }, () => null);
  for (let d = 1; d <= ultimo; d += 1) out.push({ iso: iso(y, m, d), numero: d });
  return out;
}

export interface DateRangePickerProps {
  /** ISO o null. */
  desde: string | null;
  hasta: string | null;
  onChange: (desde: string | null, hasta: string | null) => void;
  /** Texto del botón cuando no hay nada elegido. */
  placeholder?: string;
  /** Para el `aria-label` del botón: «Vigencia de la estrategia», p. ej. */
  etiqueta: string;
  disabled?: boolean;
}

export function DateRangePicker({ desde, hasta, onChange, placeholder = 'Elegir fechas', etiqueta, disabled }: DateRangePickerProps) {
  const [abierto, setAbierto] = useState(false);
  // El mes a la vista arranca en el de la fecha de inicio, o en el actual si todavía no hay ninguna.
  // Va en el inicializador perezoso del estado: el reloj se lee una vez, no en cada render.
  const [cursor, setCursor] = useState(() => {
    const p = partes(desde ?? '');
    if (p) return { y: p.y, m: p.m };
    const hoy = new Date();
    return { y: hoy.getFullYear(), m: hoy.getMonth() };
  });
  /** Qué extremo se está eligiendo: al abrir, el inicio; tras pulsar el inicio, el fin. */
  const [eligiendo, setEligiendo] = useState<'desde' | 'hasta'>('desde');
  const caja = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Cerrar al pulsar fuera o con Escape: es un desplegable, no un diálogo.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const elegir = (valor: string) => {
    if (eligiendo === 'desde' || !desde) {
      onChange(valor, null);
      setEligiendo('hasta');
      return;
    }
    // Si el segundo clic cae antes del primero, se da la vuelta al rango en vez de rechazarlo.
    if (valor < desde) {
      onChange(valor, desde);
    } else {
      onChange(desde, valor);
    }
    setEligiendo('desde');
    setAbierto(false);
  };

  const mover = (paso: number) => {
    setCursor((c) => {
      const m = c.m + paso;
      if (m < 0) return { y: c.y - 1, m: 11 };
      if (m > 11) return { y: c.y + 1, m: 0 };
      return { y: c.y, m };
    });
  };

  const resumen = desde
    ? `${formatDateOnly(desde)} → ${hasta ? formatDateOnly(hasta) : 'sin fecha de fin'}`
    : placeholder;

  const segundo = cursor.m === 11 ? { y: cursor.y + 1, m: 0 } : { y: cursor.y, m: cursor.m + 1 };

  return (
    <div className="rango" ref={caja}>
      <button
        type="button"
        className={`rango__disparador ${desde ? '' : 'rango__disparador--vacio'}`}
        aria-expanded={abierto}
        aria-controls={panelId}
        aria-label={`${etiqueta}: ${resumen}`}
        disabled={disabled}
        onClick={() => {
          setEligiendo(desde && !hasta ? 'hasta' : 'desde');
          setAbierto((v) => !v);
        }}
      >
        <span aria-hidden="true" className="rango__icono">
          🗓
        </span>
        {resumen}
      </button>

      {abierto && (
        <div className="rango__panel" id={panelId} role="group" aria-label={etiqueta}>
          <div className="rango__cab">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => mover(-1)} aria-label="Mes anterior">
              ‹
            </button>
            <p className="rango__pista">
              {eligiendo === 'desde' ? 'Elige la fecha de inicio' : 'Elige la fecha de fin'}
            </p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => mover(1)} aria-label="Mes siguiente">
              ›
            </button>
          </div>

          <div className="rango__meses">
            {[cursor, segundo].map((mes) => (
              <Mes key={`${mes.y}-${mes.m}`} y={mes.y} m={mes.m} desde={desde} hasta={hasta} onElegir={elegir} />
            ))}
          </div>

          <div className="rango__pie">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                onChange(desde, null);
                setEligiendo('desde');
                setAbierto(false);
              }}
              disabled={!desde}
            >
              Sin fecha de fin
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                onChange(null, null);
                setEligiendo('desde');
              }}
              disabled={!desde && !hasta}
            >
              Borrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Mes({
  y,
  m,
  desde,
  hasta,
  onElegir,
}: {
  y: number;
  m: number;
  desde: string | null;
  hasta: string | null;
  onElegir: (valor: string) => void;
}) {
  const dias = useMemo(() => celdas(y, m), [y, m]);

  return (
    <div className="mes">
      <p className="mes__titulo">
        {MESES[m]} {y}
      </p>
      <div className="mes__semana" aria-hidden="true">
        {DIAS.map((d, i) => (
          <span key={`${d}-${i}`} className="mes__dia-nombre">
            {d}
          </span>
        ))}
      </div>
      <div className="mes__rejilla">
        {dias.map((dia, i) =>
          dia === null ? (
            <span key={`hueco-${i}`} className="mes__hueco" />
          ) : (
            <button
              key={dia.iso}
              type="button"
              className={[
                'mes__dia',
                dia.iso === desde || dia.iso === hasta ? 'mes__dia--extremo' : '',
                desde && hasta && dia.iso > desde && dia.iso < hasta ? 'mes__dia--dentro' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={dia.iso === desde || dia.iso === hasta}
              onClick={() => onElegir(dia.iso)}
            >
              {dia.numero}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
