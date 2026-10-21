import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { listTenants } from '../lib/api/staff';
import { globalSearchCatalog } from '../lib/api/catalog';

interface Entry {
  kind: string;
  label: string;
  detail: string;
  to: string;
}

const MAX_RESULTS = 10;
const DEBOUNCE_MS = 200;

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Buscador global.
 *
 * Antes indexaba dos cosas —clientes y roles— una sola vez al primer foco y filtraba en el
 * navegador. Tareas, composiciones, bloques, contratos y sistemas no se podían encontrar
 * desde ningún sitio: había que saber en qué pantalla vivía cada cosa.
 *
 * Ahora el catálogo lo busca el servidor (`catalog_global_search`, con el mismo corte de
 * «curada» que la biblioteca) y los clientes se siguen filtrando en memoria, porque son
 * pocos y el servidor ya aplica la cartera de quien mira.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<Entry[] | null>(null);
  const [hits, setHits] = useState<Entry[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [falló, setFalló] = useState(false);
  const [active, setActive] = useState(0);

  // Ctrl+K / Cmd+K enfoca la búsqueda desde cualquier pantalla.
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const q = query.trim();

  // El catálogo se consulta al servidor, con retardo para no disparar una RPC por tecla.
  useEffect(() => {
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    setBuscando(true);
    const handle = setTimeout(() => {
      globalSearchCatalog(q, MAX_RESULTS, ctrl.signal).then(
        (rows) => {
          if (ctrl.signal.aborted) return;
          setHits(rows.map((r) => ({ kind: r.kind, label: r.label, detail: r.detail ?? '', to: r.href })));
          setBuscando(false);
          setFalló(false);
        },
        () => {
          if (ctrl.signal.aborted) return;
          setBuscando(false);
          setFalló(true);
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
      ctrl.abort();
    };
  }, [q]);

  function cargarClientes() {
    if (tenants !== null) return;
    setTenants([]);
    listTenants(false).then(
      (rows) =>
        setTenants(
          rows.map((t) => ({
            kind: 'Cliente',
            label: t.name,
            detail: t.industry ?? t.legal_name ?? '',
            to: `/clientes/${encodeURIComponent(t.id)}/resumen`,
          })),
        ),
      () => setTenants([]),
    );
  }

  const norm = normalize(q);
  const deClientes =
    norm.length === 0 || !tenants
      ? []
      : tenants.filter((e) => normalize(`${e.label} ${e.detail}`).includes(norm)).slice(0, MAX_RESULTS);
  const results = [...deClientes, ...hits];
  const showList = open && q.length > 0;

  function go(entry: Entry) {
    navigate(entry.to);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="search">
      <span className="search__icon" aria-hidden="true">
        ⌕
      </span>
      <input
        ref={inputRef}
        className="search__input"
        type="search"
        role="combobox"
        aria-label="Buscar en el panel"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        placeholder="Buscar cliente, rol, tarea, bloque…"
        value={query}
        onFocus={() => {
          cargarClientes();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <kbd className="search__kbd">Ctrl K</kbd>
      {showList && (
        <ul id={listId} className="search__results" role="listbox">
          {results.map((r, i) => (
            <li
              key={`${r.kind}-${r.to}-${r.label}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="search__option"
              // mousedown en vez de click: evita que el blur del input cierre la lista antes.
              onMouseDown={(e) => {
                e.preventDefault();
                go(r);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="search__kind">{r.kind}</span>
              <span className="search__label">{r.label}</span>
              <span className="search__detail">{r.detail}</span>
            </li>
          ))}
          {results.length === 0 && (
            <li className="search__none" role="option" aria-selected={false} aria-disabled="true">
              {falló
                ? 'No se ha podido buscar.'
                : buscando
                  ? 'Buscando…'
                  : q.length < 2
                    ? 'Escribe al menos dos letras'
                    : 'Sin resultados'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
