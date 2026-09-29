import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { listTenants } from '../lib/api/staff';
import { listRoleKeys } from '../lib/api/catalog';

interface Entry {
  kind: 'Cliente' | 'Rol';
  label: string;
  detail: string;
  to: string;
}

const MAX_RESULTS = 8;

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

// El índice se carga al primer uso. Clientes: el servidor aplica la cartera.
// Roles: solo si el rol del usuario puede leer el catálogo (si no, se omiten).
async function loadIndex(): Promise<Entry[]> {
  const [tenants, roles] = await Promise.allSettled([listTenants(false), listRoleKeys()]);
  const entries: Entry[] = [];
  if (tenants.status === 'fulfilled') {
    for (const t of tenants.value) {
      entries.push({
        kind: 'Cliente',
        label: t.name,
        detail: t.industry ?? t.legal_name ?? '',
        to: `/clientes/${encodeURIComponent(t.id)}/resumen`,
      });
    }
  }
  if (roles.status === 'fulfilled') {
    for (const r of roles.value) {
      entries.push({ kind: 'Rol', label: r.name, detail: r.key, to: `/roles/${encodeURIComponent(r.key)}` });
    }
  }
  return entries;
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<Entry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
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

  function ensureIndex() {
    if (index !== null) return;
    setIndex([]);
    loadIndex().then(setIndex, () => setLoadFailed(true));
  }

  const q = normalize(query.trim());
  const results =
    q.length === 0 || !index
      ? []
      : index.filter((e) => normalize(`${e.label} ${e.detail}`).includes(q)).slice(0, MAX_RESULTS);
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
        aria-label="Buscar cliente o rol"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        placeholder="Buscar cliente, rol…"
        value={query}
        onFocus={() => {
          ensureIndex();
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
              key={r.to}
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
              {loadFailed ? 'No se ha podido cargar la búsqueda.' : 'Sin resultados'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
