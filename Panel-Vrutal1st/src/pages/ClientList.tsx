import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Tenant } from '../lib/types';

interface ClientListProps {
  onSelectTenant: (id: string) => void;
}

export function ClientList({ onSelectTenant }: ClientListProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('tenants')
      .select(
        'id, name, legal_name, status, industry, size_employees, email, phone, website, country, region, is_internal, data_plane_status',
      )
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setTenants((data ?? []) as Tenant[]);
      });
  }, []);

  return (
    <div className="panel">
      <h2>Clientes</h2>
      {error && <p className="error">{error}</p>}
      <table className="linked-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Industria</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.industry || '—'}</td>
              <td>
                <span className="badge">{t.status}</span>
              </td>
              <td>
                <button className="secondary" onClick={() => onSelectTenant(t.id)}>
                  Ver
                </button>
              </td>
            </tr>
          ))}
          {tenants.length === 0 && !error && (
            <tr>
              <td colSpan={4} className="empty">
                No hay clientes todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
