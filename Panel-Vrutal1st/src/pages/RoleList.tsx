import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase } from '../lib/supabaseClient';
import { PageHead } from '../components/PageHead';
import { StatusPill } from '../components/StatusPill';
import type { Domain, JobRoleKeySummary, Seniority } from '../lib/types';
import '../styles/pages/catalog.css';

const SENIORITY_TIERS: { key: Seniority | '__none__'; label: string }[] = [
  { key: 'direccion', label: 'Dirección' },
  { key: 'mando', label: 'Mando' },
  { key: 'operativo', label: 'Operativo' },
  { key: '__none__', label: 'Sin seniority' },
];

export function RoleList() {
  const [keys, setKeys] = useState<JobRoleKeySummary[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('catalog_list_domains').then(({ data, error }) => {
      if (error) setError(error.message);
      else setDomains((data ?? []) as Domain[]);
    });
    supabase.rpc('catalog_list_job_role_keys').then(({ data, error }) => {
      if (error) setError(error.message);
      else setKeys((data ?? []) as JobRoleKeySummary[]);
    });
  }, []);

  function domainName(id: string) {
    return domains.find((d) => d.id === id)?.name || id;
  }

  const grouped: Record<string, JobRoleKeySummary[]> = {};
  for (const k of keys) {
    const group = k.domain_id || '__none__';
    (grouped[group] ||= []).push(k);
  }

  return (
    <section>
      <PageHead crumbs={[{ label: 'Construcción · paso 1' }]} title="Roles por departamento" />

      <div className="catalog-stack">
        <p className="catalog-note">
          Cada tarjeta es un agente independiente (propio key, propias reglas). Si el mismo nombre aparece en varios
          departamentos, son agentes distintos desdoblados a partir de uno original. Abre un rol para ver y enlazar sus
          tareas.
        </p>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}

        {Object.entries(grouped).map(([domainId, roles]) => (
          <section key={domainId} className="table-card org">
            <div className="table-card__head">
              <h2 className="table-card__title">{domainId === '__none__' ? 'Sin departamento' : domainName(domainId)}</h2>
            </div>
            <div className="org__tiers">
              {SENIORITY_TIERS.map(({ key: tierKey, label }) => {
                const tierRoles = roles.filter((r) => (r.seniority || '__none__') === tierKey);
                if (tierRoles.length === 0) return null;
                return (
                  <div key={tierKey} className="org__tier">
                    <span className="eyebrow">{label}</span>
                    <div className="org__cards">
                      {tierRoles.map((r) => (
                        <Link key={r.key} className="org__card" to={`/roles/${encodeURIComponent(r.key)}`}>
                          <span className="org__name">{r.name}</span>
                          <span className="org__key">{r.key}</span>
                          <span>
                            <StatusPill status={r.status} />
                            <span className="pill">v{r.latest_version}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {keys.length === 0 && !error && <p className="catalog-note">No hay roles todavía.</p>}
      </div>
    </section>
  );
}
