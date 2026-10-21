import { useCallback, useMemo, useState } from 'react';
import { DateRangePicker } from '../components/DateRangePicker';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import { formatDateOnly } from '../lib/format';
import { errorMessage } from '../lib/api/client';
import { borrar, crear, editar, loadNegocio, type NegocioData, type Tabla } from '../lib/api/negocio';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { canEditScope } from '../lib/nav';
import type { MktCurrency, MktInputKey, MktSemObjective, MktSemStatus, MktSource, Profile } from '../lib/types';
import '../styles/pages/negocio.css';

// El scope de negocio: lo que los especialistas necesitan saber de la empresa para trabajar.
// Lo completa el Admin de Marketing (y el Admin, que muchas veces es la misma persona).
// Las filas que trae Vrutal de su auditoría son de solo lectura: el servidor no deja tocarlas.

type BloqueId = 'icp' | 'brand_voice' | 'objetivos' | 'competencia' | 'strategy' | 'productos';

interface Columna {
  key: string;
  label: string;
  /** Lista cerrada de valores; si falta, es texto libre. */
  options?: string[];
  requerido?: boolean;
  ancho?: 'corto' | 'largo';
}

interface Bloque {
  id: BloqueId;
  label: string;
  /** Para qué sirve, en el idioma del cliente. Si todavía no sirve, lo dice. */
  para: string;
  /** Aviso de la cabecera cuando está vacío. Null = no bloquea a nadie todavía. */
  bloquea: string | null;
  inputKey?: MktInputKey;
  tabla: Tabla;
  columnas?: Columna[];
}

const BLOQUES: Bloque[] = [
  {
    id: 'icp',
    label: 'Perfil e ICP',
    para: 'Lo usan tu Especialista SEO/SEM y tu Especialista de Contenido para proponer keywords y briefs.',
    bloquea: 'Tu Especialista SEO/SEM no puede proponer keywords.',
    inputKey: 'icp',
    tabla: 'mkt_input_value',
  },
  {
    id: 'brand_voice',
    label: 'Marca',
    para: 'La usa tu Especialista de Contenido al redactar y al revisar la voz.',
    bloquea: 'Tu Especialista de Contenido no puede redactar con tu voz.',
    inputKey: 'brand_voice',
    tabla: 'mkt_input_value',
  },
  {
    id: 'objetivos',
    label: 'Objetivos',
    para: 'Los usa tu Analista de Mercado para decirte, por canal, si vas por encima o por debajo.',
    bloquea: 'Tu Analista de Mercado no puede hacer el diagnóstico por canal.',
    tabla: 'mkt_channel_target',
    columnas: [
      { key: 'channel', label: 'Canal', options: ['seo', 'sem', 'email', 'linkedin', 'social', 'web', 'other'], requerido: true, ancho: 'corto' },
      { key: 'metric', label: 'Métrica', requerido: true },
      { key: 'target', label: 'Objetivo', requerido: true, ancho: 'corto' },
      { key: 'period', label: 'Periodo', options: ['semanal', 'mensual', 'trimestral'], ancho: 'corto' },
    ],
  },
  {
    id: 'competencia',
    label: 'Competencia',
    para: 'Aquí dices a quién mirar. La ficha de lo observado la produce tu Analista de Mercado y aparece en su trabajo, no aquí.',
    bloquea: null,
    tabla: 'mkt_competitor',
    columnas: [
      { key: 'name', label: 'Competidor', requerido: true },
      { key: 'website', label: 'Web', ancho: 'largo' },
      { key: 'notes', label: 'Notas', ancho: 'largo' },
      { key: 'priority', label: 'Prioridad', ancho: 'corto' },
    ],
  },
  {
    id: 'strategy',
    label: 'Estrategia',
    para: 'Tu estrategia SEM (qué persigues y entre qué fechas) la leerá tu Especialista SEO/SEM cuando actives SEM. Los campos de texto todavía no los usa ningún especialista: los guardamos para cuando los use.',
    bloquea: null,
    inputKey: 'strategy',
    tabla: 'mkt_input_value',
  },
  {
    id: 'productos',
    label: 'Productos foco',
    para: 'Todavía no los usa ningún especialista: los guardamos para cuando los use.',
    bloquea: null,
    tabla: 'mkt_focus_product',
    columnas: [
      { key: 'name', label: 'Producto', requerido: true },
      { key: 'description', label: 'Descripción', ancho: 'largo' },
      { key: 'price_note', label: 'Precio', ancho: 'corto' },
      { key: 'status', label: 'Estado', options: ['activo', 'pausado'], ancho: 'corto' },
      { key: 'priority', label: 'Prioridad', ancho: 'corto' },
    ],
  },
];

/** Los seis objetivos PPC genéricos. Lista cerrada, igual que el `check` de la base. */
const OBJETIVOS_SEM: Array<{ valor: MktSemObjective; label: string }> = [
  { valor: 'crecimiento_marca', label: 'Crecimiento de marca' },
  { valor: 'generar_leads', label: 'Generar leads' },
  { valor: 'incrementar_roi', label: 'Incrementar ROI' },
  { valor: 'incrementar_ctr', label: 'Incrementar CTR' },
  { valor: 'reducir_cac', label: 'Reducir CAC' },
  { valor: 'empuje_producto', label: 'Empuje de producto' },
];

const ESTADOS_SEM: MktSemStatus[] = ['planificada', 'activa', 'pausada'];
const MONEDAS: MktCurrency[] = ['EUR', 'USD', 'GBP'];

/** Formulario de estrategia SEM en blanco. Fuera del componente: es constante, no estado. */
const SEM_VACIA = {
  objective: '' as MktSemObjective | '',
  budget_monthly: '',
  currency: 'EUR' as MktCurrency,
  focus_product_id: '',
  geo: '',
  landing_url: '',
  status: 'planificada' as MktSemStatus,
  notes: '',
};

const etiquetaObjetivo = (v: string) => OBJETIVOS_SEM.find((o) => o.valor === v)?.label ?? v;

/** Cuántas filas tiene cada bloque. La completitud se cuenta, no se pregunta. */
function conteo(d: NegocioData, b: Bloque): number {
  // Estrategia tiene dos mitades: los campos de texto y la tabla de estrategias SEM.
  if (b.id === 'strategy') return d.values.filter((v) => v.input_key === 'strategy').length + d.semStrategies.length;
  if (b.inputKey) return d.values.filter((v) => v.input_key === b.inputKey).length;
  if (b.tabla === 'mkt_channel_target') return d.targets.length;
  if (b.tabla === 'mkt_competitor') return d.competitors.length;
  return d.products.length;
}

function Origen({ source }: { source: MktSource }) {
  const vrutal = source === 'vrutal';
  return (
    <span className={`pill ${vrutal ? '' : 'pill--ok'}`} title={vrutal ? 'Lo trajo la auditoría de Vrutal: no se edita aquí' : 'Lo has escrito tú'}>
      {vrutal ? 'Vrutal' : 'Tuyo'}
    </span>
  );
}

export function NegocioPage({ profile }: { profile: Profile }) {
  const load = useCallback((signal: AbortSignal) => loadNegocio(signal), []);
  const { state, reload, refresh } = useAsyncData(load);
  const [activo, setActivo] = useState<BloqueId>('icp');
  const [error, setError] = useState<string | null>(null);
  const puedeEditar = canEditScope(profile.role);

  const accion = useCallback(
    async (fn: () => Promise<boolean>) => {
      setError(null);
      try {
        const ok = await fn();
        if (!ok) setError('No tienes permiso para hacer esto.');
        refresh();
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [refresh],
  );

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorNotice error={state.error} onRetry={reload} />;

  const data = state.data;
  const bloque = BLOQUES.find((b) => b.id === activo) ?? BLOQUES[0];
  const conInfo = BLOQUES.filter((b) => conteo(data, b) > 0).length;
  const bloqueos = BLOQUES.filter((b) => b.bloquea && conteo(data, b) === 0);

  return (
    <>
      <PageHead crumbs={[{ label: 'Mi trabajo' }]} title="Negocio" />
      <p className="negocio__intro">
        Lo que tus especialistas necesitan saber de tu empresa para trabajar. Mientras un bloque esté vacío, el
        especialista que lo necesita no puede hacer su parte.
      </p>

      <div className="negocio__estado">
        <p className="negocio__completitud">
          <strong>
            {conInfo} de {BLOQUES.length}
          </strong>{' '}
          bloques con información
        </p>
        {bloqueos.length > 0 && (
          <ul className="negocio__bloqueos">
            {bloqueos.map((b) => (
              <li key={b.id}>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setActivo(b.id)}>
                  {b.label} está vacío
                </button>
                : {b.bloquea}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="chip-group negocio__tabs" role="group" aria-label="Bloques del negocio">
        {BLOQUES.map((b) => {
          const n = conteo(data, b);
          return (
            <button key={b.id} type="button" className="chip" aria-pressed={b.id === bloque.id} onClick={() => setActivo(b.id)}>
              {b.label} <span className="chip__count">{n}</span>
            </button>
          );
        })}
      </div>

      <p className="negocio__para">{bloque.para}</p>
      {!puedeEditar && (
        <p className="notice notice--info">Puedes consultar esta información. Para cambiarla, pídeselo a un Admin o a un Admin de Marketing.</p>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {bloque.inputKey ? (
        <>
          <BloqueCampos data={data} inputKey={bloque.inputKey} puedeEditar={puedeEditar} accion={accion} />
          {bloque.id === 'strategy' && <BloqueSem data={data} puedeEditar={puedeEditar} accion={accion} />}
        </>
      ) : (
        <BloqueTabla data={data} bloque={bloque} puedeEditar={puedeEditar} accion={accion} />
      )}
    </>
  );
}

type Accion = (fn: () => Promise<boolean>) => Promise<void>;

/** Bloque de campo/valor: los campos los define Vrutal (mkt_input_field); el cliente pone el valor. */
function BloqueCampos({
  data,
  inputKey,
  puedeEditar,
  accion,
}: {
  data: NegocioData;
  inputKey: MktInputKey;
  puedeEditar: boolean;
  accion: Accion;
}) {
  const campos = useMemo(() => data.fields.filter((f) => f.input_key === inputKey), [data.fields, inputKey]);
  const [nuevo, setNuevo] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<{ id: string; value: string } | null>(null);

  if (campos.length === 0) {
    return (
      <div className="empty-state">
        <h2 className="empty-state__title">Este bloque aún no tiene campos</h2>
        <p className="empty-state__body">Los campos los define Vrutal. En cuanto estén, aparecerán aquí para que los rellenes.</p>
      </div>
    );
  }

  return (
    <div className="negocio__campos">
      {campos.map((campo) => {
        const valores = data.values.filter((v) => v.input_key === inputKey && v.field_key === campo.field_key);
        const unico = !campo.multi;
        const propio = valores.find((v) => v.source === 'cliente');
        const puedeAnadir = puedeEditar && (campo.multi || (!propio && valores.length === 0));

        return (
          <section key={campo.field_key} className="campo">
            <div className="campo__cab">
              <h3 className="campo__titulo">{campo.label}</h3>
              {campo.multi && <span className="campo__nota">varios valores</span>}
            </div>
            {campo.help && <p className="campo__ayuda">{campo.help}</p>}

            {valores.length === 0 && <p className="campo__vacio">Sin rellenar</p>}

            <ul className="campo__lista">
              {valores.map((v) => (
                <li key={v.id} className="fila">
                  {editando?.id === v.id ? (
                    <>
                      <input
                        className="text-input"
                        value={editando.value}
                        onChange={(e) => setEditando({ id: v.id, value: e.target.value })}
                        aria-label={`Editar ${campo.label}`}
                      />
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => {
                          const value = editando.value.trim();
                          setEditando(null);
                          if (value) void accion(() => editar('mkt_input_value', v.id, { value }));
                        }}
                      >
                        Guardar
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditando(null)}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="fila__valor">{v.value}</span>
                      <Origen source={v.source} />
                      {puedeEditar && v.source === 'cliente' && (
                        <>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditando({ id: v.id, value: v.value })}>
                            Editar
                          </button>
                          <button type="button" className="btn btn--danger btn--sm" onClick={() => void accion(() => borrar('mkt_input_value', v.id))}>
                            Quitar
                          </button>
                        </>
                      )}
                      {v.source === 'vrutal' && <span className="fila__candado" title="Lo trajo Vrutal: no se edita aquí">🔒</span>}
                    </>
                  )}
                </li>
              ))}
            </ul>

            {puedeAnadir && (
              <form
                className="fila fila--nueva"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = (nuevo[campo.field_key] ?? '').trim();
                  if (!value) return;
                  setNuevo((n) => ({ ...n, [campo.field_key]: '' }));
                  void accion(() =>
                    crear('mkt_input_value', { input_key: inputKey, field_key: campo.field_key, value, position: campo.position }),
                  );
                }}
              >
                <input
                  className="text-input"
                  value={nuevo[campo.field_key] ?? ''}
                  onChange={(e) => setNuevo((n) => ({ ...n, [campo.field_key]: e.target.value }))}
                  placeholder={unico ? `Escribe ${campo.label.toLowerCase()}` : 'Añadir otro'}
                  aria-label={`Añadir ${campo.label}`}
                />
                <button type="submit" className="btn btn--primary btn--sm">
                  Añadir
                </button>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Bloque de tabla: aquí el cliente sí añade filas (objetivos, competencia, productos). */
function BloqueTabla({
  data,
  bloque,
  puedeEditar,
  accion,
}: {
  data: NegocioData;
  bloque: Bloque;
  puedeEditar: boolean;
  accion: Accion;
}) {
  const columnas = bloque.columnas ?? [];
  const [nueva, setNueva] = useState<Record<string, string>>({});
  const filas: Array<{ id: string; source: MktSource; valores: Record<string, unknown> }> =
    bloque.tabla === 'mkt_channel_target'
      ? data.targets.map((t) => ({ id: t.id, source: t.source, valores: { ...t } }))
      : bloque.tabla === 'mkt_competitor'
        ? data.competitors.map((c) => ({ id: c.id, source: c.source, valores: { ...c } }))
        : data.products.map((p) => ({ id: p.id, source: p.source, valores: { ...p } }));

  const enviar = () => {
    const fila: Record<string, unknown> = {};
    for (const col of columnas) {
      const raw = (nueva[col.key] ?? '').trim();
      if (!raw) {
        if (col.requerido) return;
        continue;
      }
      fila[col.key] = col.key === 'priority' ? Number(raw) : raw;
    }
    setNueva({});
    void accion(() => crear(bloque.tabla, fila));
  };

  return (
    <div className="negocio__tabla">
      {filas.length === 0 ? (
        <div className="empty-state">
          <h2 className="empty-state__title">Sin {bloque.label.toLowerCase()}</h2>
          <p className="empty-state__body">{bloque.bloquea ?? 'Cuando lo rellenes, lo verás aquí.'}</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c.key} scope="col">
                  {c.label}
                </th>
              ))}
              <th scope="col">Origen</th>
              {puedeEditar && <th scope="col" className="negocio__acciones">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                {columnas.map((c) => (
                  <td key={c.key} data-label={c.label}>
                    {f.valores[c.key] === null || f.valores[c.key] === undefined || f.valores[c.key] === '' ? '—' : String(f.valores[c.key])}
                  </td>
                ))}
                <td data-label="Origen">
                  <Origen source={f.source} />
                </td>
                {puedeEditar && (
                  <td data-label="Acciones">
                    {f.source === 'cliente' ? (
                      <button type="button" className="btn btn--danger btn--sm" onClick={() => void accion(() => borrar(bloque.tabla, f.id))}>
                        Quitar
                      </button>
                    ) : (
                      <span className="fila__candado" title="Lo trajo Vrutal: no se edita aquí">🔒</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {puedeEditar && (
        <form
          className="negocio__nueva"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          {columnas.map((c) =>
            c.options ? (
              <label key={c.key} className="negocio__campo">
                <span className="negocio__etiqueta">{c.label}</span>
                <select
                  className="text-input"
                  value={nueva[c.key] ?? ''}
                  onChange={(e) => setNueva((n) => ({ ...n, [c.key]: e.target.value }))}
                >
                  <option value="">—</option>
                  {c.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label key={c.key} className={`negocio__campo ${c.ancho === 'largo' ? 'negocio__campo--largo' : ''}`}>
                <span className="negocio__etiqueta">{c.label}</span>
                <input
                  className="text-input"
                  value={nueva[c.key] ?? ''}
                  onChange={(e) => setNueva((n) => ({ ...n, [c.key]: e.target.value }))}
                  placeholder={c.requerido ? 'Obligatorio' : ''}
                />
              </label>
            ),
          )}
          <button type="submit" className="btn btn--primary btn--sm">
            Añadir
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * Estrategias SEM. Vive dentro del bloque Estrategia, debajo de sus campos de texto, porque
 * sustituye a uno de ellos: el viejo «Foco de SEM» era texto libre, y un prompt estándar no puede
 * leer texto libre (cambio 2026-10-20_mkt_sem_strategy.sql).
 *
 * Aquí NO hay métrica a propósito: la métrica y el número a batir son el bloque Objetivos
 * (`mkt_channel_target`). La estrategia dice QUÉ se persigue y CUÁNDO.
 */
function BloqueSem({ data, puedeEditar, accion }: { data: NegocioData; puedeEditar: boolean; accion: Accion }) {
  const [nueva, setNueva] = useState(SEM_VACIA);
  const [desde, setDesde] = useState<string | null>(null);
  const [hasta, setHasta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const productos = data.products;
  const exigeProducto = nueva.objective === 'empuje_producto';
  const nombreProducto = (id: string | null) => (id ? (productos.find((p) => p.id === id)?.name ?? '—') : '—');

  const importe = (valor: number | null, moneda: MktCurrency) =>
    valor === null
      ? '—'
      : new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(valor);

  const enviar = () => {
    // Las mismas reglas que los `check` de la base, dichas antes para no gastar un viaje al servidor.
    if (!nueva.objective) return setAviso('Elige un objetivo.');
    if (!desde) return setAviso('Elige al menos la fecha de inicio.');
    if (exigeProducto && !nueva.focus_product_id) {
      return setAviso('«Empuje de producto» necesita decir qué producto se empuja.');
    }
    const fila: Record<string, unknown> = {
      objective: nueva.objective,
      starts_on: desde,
      ends_on: hasta,
      currency: nueva.currency,
      status: nueva.status,
    };
    const presupuesto = nueva.budget_monthly.trim().replace(',', '.');
    if (presupuesto) {
      const n = Number(presupuesto);
      if (!Number.isFinite(n) || n <= 0) return setAviso('El presupuesto mensual tiene que ser un número mayor que cero.');
      fila.budget_monthly = n;
    }
    if (nueva.focus_product_id) fila.focus_product_id = nueva.focus_product_id;
    if (nueva.geo.trim()) fila.geo = nueva.geo.trim();
    if (nueva.landing_url.trim()) {
      const url = nueva.landing_url.trim();
      if (!/^https?:\/\//i.test(url)) return setAviso('El destino tiene que empezar por http:// o https://');
      fila.landing_url = url;
    }
    if (nueva.notes.trim()) fila.notes = nueva.notes.trim();

    setAviso(null);
    setNueva(SEM_VACIA);
    setDesde(null);
    setHasta(null);
    void accion(() => crear('mkt_sem_strategy', fila));
  };

  return (
    <section className="sem">
      <div className="sem__cab">
        <h3 className="sem__titulo">Estrategia SEM</h3>
        <p className="sem__ayuda">
          Qué persigues con el presupuesto de pago y entre qué fechas. Sin métrica: el número a batir es el bloque
          Objetivos.
        </p>
      </div>

      {data.semStrategies.length === 0 ? (
        <p className="campo__vacio">Sin estrategias SEM</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Objetivo</th>
              <th scope="col">Vigencia</th>
              <th scope="col">Presupuesto/mes</th>
              <th scope="col">Producto</th>
              <th scope="col">Mercado</th>
              <th scope="col">Destino</th>
              <th scope="col">Estado</th>
              <th scope="col">Origen</th>
              {puedeEditar && (
                <th scope="col" className="negocio__acciones">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.semStrategies.map((s) => (
              <tr key={s.id}>
                <td data-label="Objetivo">{etiquetaObjetivo(s.objective)}</td>
                <td data-label="Vigencia">
                  {formatDateOnly(s.starts_on)} → {s.ends_on ? formatDateOnly(s.ends_on) : 'sin fin'}
                </td>
                <td data-label="Presupuesto/mes">{importe(s.budget_monthly, s.currency)}</td>
                <td data-label="Producto">{nombreProducto(s.focus_product_id)}</td>
                <td data-label="Mercado">{s.geo ?? '—'}</td>
                <td data-label="Destino">
                  {s.landing_url ? (
                    <a href={s.landing_url} target="_blank" rel="noreferrer noopener">
                      abrir
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td data-label="Estado">
                  {puedeEditar && s.source === 'cliente' ? (
                    <select
                      className="text-input"
                      value={s.status}
                      aria-label={`Estado de ${etiquetaObjetivo(s.objective)}`}
                      onChange={(e) => void accion(() => editar('mkt_sem_strategy', s.id, { status: e.target.value }))}
                    >
                      {ESTADOS_SEM.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  ) : (
                    s.status
                  )}
                </td>
                <td data-label="Origen">
                  <Origen source={s.source} />
                </td>
                {puedeEditar && (
                  <td data-label="Acciones">
                    {s.source === 'cliente' ? (
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => void accion(() => borrar('mkt_sem_strategy', s.id))}
                      >
                        Quitar
                      </button>
                    ) : (
                      <span className="fila__candado" title="Lo trajo Vrutal: no se edita aquí">
                        🔒
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {puedeEditar && (
        <form
          className="negocio__nueva"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <label className="negocio__campo negocio__campo--largo">
            <span className="negocio__etiqueta">Objetivo</span>
            <select
              className="text-input"
              value={nueva.objective}
              onChange={(e) => setNueva((n) => ({ ...n, objective: e.target.value as MktSemObjective }))}
            >
              <option value="">— Elige un objetivo —</option>
              {OBJETIVOS_SEM.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="negocio__campo negocio__campo--largo">
            <span className="negocio__etiqueta">Vigencia</span>
            <DateRangePicker
              desde={desde}
              hasta={hasta}
              etiqueta="Vigencia de la estrategia"
              placeholder="De tal fecha a tal fecha"
              onChange={(d, h) => {
                setDesde(d);
                setHasta(h);
              }}
            />
          </div>

          <label className="negocio__campo">
            <span className="negocio__etiqueta">Presupuesto/mes</span>
            <input
              className="text-input"
              inputMode="decimal"
              value={nueva.budget_monthly}
              onChange={(e) => setNueva((n) => ({ ...n, budget_monthly: e.target.value }))}
              placeholder="1500"
            />
          </label>

          <label className="negocio__campo">
            <span className="negocio__etiqueta">Moneda</span>
            <select
              className="text-input"
              value={nueva.currency}
              onChange={(e) => setNueva((n) => ({ ...n, currency: e.target.value as MktCurrency }))}
            >
              {MONEDAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="negocio__campo negocio__campo--largo">
            <span className="negocio__etiqueta">{exigeProducto ? 'Producto (obligatorio)' : 'Producto'}</span>
            <select
              className="text-input"
              value={nueva.focus_product_id}
              onChange={(e) => setNueva((n) => ({ ...n, focus_product_id: e.target.value }))}
            >
              <option value="">—</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status === 'pausado' ? ' (pausado)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="negocio__campo">
            <span className="negocio__etiqueta">Mercado</span>
            <input
              className="text-input"
              value={nueva.geo}
              onChange={(e) => setNueva((n) => ({ ...n, geo: e.target.value }))}
              placeholder="España"
            />
          </label>

          <label className="negocio__campo negocio__campo--largo">
            <span className="negocio__etiqueta">Destino</span>
            <input
              className="text-input"
              value={nueva.landing_url}
              onChange={(e) => setNueva((n) => ({ ...n, landing_url: e.target.value }))}
              placeholder="https://…"
            />
          </label>

          <label className="negocio__campo">
            <span className="negocio__etiqueta">Estado</span>
            <select
              className="text-input"
              value={nueva.status}
              onChange={(e) => setNueva((n) => ({ ...n, status: e.target.value as MktSemStatus }))}
            >
              {ESTADOS_SEM.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>

          <label className="negocio__campo negocio__campo--largo">
            <span className="negocio__etiqueta">Notas</span>
            <input
              className="text-input"
              value={nueva.notes}
              onChange={(e) => setNueva((n) => ({ ...n, notes: e.target.value }))}
            />
          </label>

          <button type="submit" className="btn btn--primary btn--sm">
            Añadir estrategia
          </button>

          {aviso && (
            <p className="notice notice--error sem__aviso" role="alert">
              {aviso}
            </p>
          )}
        </form>
      )}

      {productos.length === 0 && (
        <p className="sem__ayuda">
          Para una estrategia de «Empuje de producto» hace falta tener el producto en el bloque Productos foco.
        </p>
      )}
    </section>
  );
}
