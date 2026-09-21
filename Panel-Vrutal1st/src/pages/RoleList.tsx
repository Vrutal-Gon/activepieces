import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Domain, JobRoleKeySummary, Seniority } from '../lib/types';

interface RoleListProps {
  onSelectRole: (key: string) => void;
}

const SENIORITY_TIERS: { key: Seniority | '__none__'; label: string }[] = [
  { key: 'direccion', label: 'Dirección' },
  { key: 'mando', label: 'Mando' },
  { key: 'operativo', label: 'Operativo' },
  { key: '__none__', label: 'Sin seniority' },
];

export function RoleList({ onSelectRole }: RoleListProps) {
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
    <div className="panel">
      <h2>Roles por departamento</h2>
      <p className="task-summary">
        Cada tarjeta es un agente independiente (propio key, propias reglas). Si el mismo nombre
        aparece en varios departamentos, son agentes distintos que fueron desdoblados a partir de uno
        original.
      </p>
      {error && <p className="error">{error}</p>}

      {Object.entries(grouped).map(([domainId, roles]) => (
        <div key={domainId} className="role-group">
          <h3>{domainId === '__none__' ? 'Sin departamento' : domainName(domainId)}</h3>
          <div className="org-chart">
            {SENIORITY_TIERS.map(({ key: tierKey, label }) => {
              const tierRoles = roles.filter((r) => (r.seniority || '__none__') === tierKey);
              if (tierRoles.length === 0) return null;
              return (
                <div key={tierKey} className="org-tier">
                  <span className="org-tier-label">{label}</span>
                  <div className="role-cards">
                    {tierRoles.map((r) => (
                      <button key={r.key} className="role-card-link" onClick={() => onSelectRole(r.key)}>
                        <span className="role-card-link-name">{r.name}</span>
                        <span className="role-card-link-key">{r.key}</span>
                        <span className="role-card-link-meta">
                          <span className={`badge status-${r.status}`}>{r.status}</span>
                          <span className="badge subtle">v{r.latest_version}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {keys.length === 0 && !error && <p className="empty">No hay roles todavía.</p>}
    </div>
  );
}
