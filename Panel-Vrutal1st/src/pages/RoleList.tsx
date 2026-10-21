import { useCallback } from 'react';
import { Link } from 'react-router';
import { listDomains, listRoleKeys, roleProgress } from '../lib/api/catalog';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { useDebouncedParam } from '../lib/hooks/useUrlState';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import { StatusPill } from '../components/StatusPill';
import type { JobRoleKeySummary, Seniority } from '../lib/types';
import '../styles/pages/catalog.css';

const SENIORITY_TIERS: { key: Seniority | '__none__'; label: string }[] = [
  { key: 'direccion', label: 'Dirección' },
  { key: 'mando', label: 'Mando' },
  { key: 'operativo', label: 'Operativo' },
  { key: '__none__', label: 'Sin seniority' },
];

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Los especialistas del catálogo, por departamento y nivel.
 *
 * Cada tarjeta lleva ahora su avance: cuántas tareas tiene, cuántas están montadas y
 * cuántas publicadas. Sin esos tres números la lista decía quién existe pero no qué está
 * construido, que es lo único que hace falta saber para decidir en qué rol trabajar hoy.
 */
export function RoleList() {
  const [draft, setDraft, query] = useDebouncedParam('q');

  const cargar = useCallback(async (signal: AbortSignal) => {
    const [domains, keys, progreso] = await Promise.all([
      listDomains(signal),
      listRoleKeys(signal),
      roleProgress(signal),
    ]);
    return { domains, keys, progreso };
  }, []);
  const { state, reload } = useAsyncData(cargar);

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorNotice error={state.error} onRetry={reload} />;

  const { domains, keys, progreso } = state.data;
  const avance = new Map(progreso.map((p) => [p.role_key, p]));
  const q = normalize(query);
  const visibles = q
    ? keys.filter((k) => normalize(`${k.name} ${k.key}`).includes(q))
    : keys;

  const domainName = (id: string) => domains.find((d) => d.id === id)?.name || id;

  const grouped: Record<string, JobRoleKeySummary[]> = {};
  for (const k of visibles) {
    const group = k.domain_id || '__none__';
    (grouped[group] ||= []).push(k);
  }

  return (
    <section>
      <PageHead crumbs={[{ label: 'Construir' }]} title="Especialistas" />

      <div className="catalog-stack">
        <p className="catalog-note">
          Cada tarjeta es un agente independiente (propio key, propias reglas). Si el mismo nombre aparece en varios
          departamentos, son agentes distintos desdoblados a partir de uno original.
        </p>

        <input
          className="text-input"
          type="search"
          placeholder="Buscar especialista por nombre o clave…"
          aria-label="Buscar especialista"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />

        {Object.entries(grouped).map(([domainId, roles]) => (
          <section key={domainId} className="table-card org">
            <div className="table-card__head">
              <h2 className="table-card__title">
                {domainId === '__none__' ? 'Sin departamento' : domainName(domainId)}
              </h2>
            </div>
            <div className="org__tiers">
              {SENIORITY_TIERS.map(({ key: tierKey, label }) => {
                const tierRoles = roles.filter((r) => (r.seniority || '__none__') === tierKey);
                if (tierRoles.length === 0) return null;
                return (
                  <div key={tierKey} className="org__tier">
                    <span className="eyebrow">{label}</span>
                    <div className="org__cards">
                      {tierRoles.map((r) => {
                        const p = avance.get(r.key);
                        return (
                          <Link key={r.key} className="org__card" to={`/roles/${encodeURIComponent(r.key)}`}>
                            <span className="org__name">{r.name}</span>
                            <span className="org__key">{r.key}</span>
                            <span>
                              <StatusPill status={r.status} />
                              <span className="pill">v{r.latest_version}</span>
                            </span>
                            {p && (
                              <span
                                className="org__progress"
                                title="Tareas enlazadas · con composición · con composición publicada"
                              >
                                {p.tasks} tareas · {p.with_composition} montadas · {p.published} publicadas
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {visibles.length === 0 && (
          <p className="catalog-note">
            {keys.length === 0 ? 'No hay especialistas todavía.' : 'Ningún especialista coincide con la búsqueda.'}
          </p>
        )}
      </div>
    </section>
  );
}
