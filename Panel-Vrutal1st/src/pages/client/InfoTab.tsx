import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { updateTenant } from '../../lib/api/tenants';
import { errorMessage } from '../../lib/api/client';
import { ExternalLink } from '../../components/ExternalLink';
import type { TenantDetail, TenantEditable } from '../../lib/types';

type TextKey = Exclude<keyof TenantEditable, 'size_employees'>;

interface FieldDef {
  key: keyof TenantEditable;
  label: string;
  type?: 'email' | 'url' | 'tel' | 'number';
  required?: boolean;
  placeholder?: string;
}

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Empresa',
    fields: [
      { key: 'name', label: 'Nombre comercial', required: true },
      { key: 'legal_name', label: 'Razón social' },
      { key: 'tax_id', label: 'NIF / CIF' },
      { key: 'industry', label: 'Industria' },
      { key: 'size_employees', label: 'Empleados', type: 'number' },
    ],
  },
  {
    title: 'Contacto',
    fields: [
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Teléfono', type: 'tel' },
      { key: 'website', label: 'Web', type: 'url' },
    ],
  },
  {
    title: 'Dirección',
    fields: [
      { key: 'address_line', label: 'Dirección' },
      { key: 'postal_code', label: 'Código postal' },
      { key: 'city', label: 'Ciudad' },
      { key: 'region', label: 'Provincia / región' },
      { key: 'country', label: 'País', placeholder: 'Código ISO, p. ej. ES' },
    ],
  },
];

function toDraft(t: TenantDetail): TenantEditable {
  return {
    name: t.name,
    legal_name: t.legal_name,
    tax_id: t.tax_id,
    industry: t.industry,
    size_employees: t.size_employees,
    email: t.email,
    phone: t.phone,
    website: t.website,
    address_line: t.address_line,
    city: t.city,
    postal_code: t.postal_code,
    region: t.region,
    country: t.country,
  };
}

interface InfoTabProps {
  tenant: TenantDetail;
  onSaved: () => void;
}

export function InfoTab({ tenant, onSaved }: InfoTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = tenant.can_edit && searchParams.get('editar') === '1';
  const [draft, setDraft] = useState<TenantEditable>(() => toDraft(tenant));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Al entrar en edición (desde aquí o desde "Editar ficha" de la cabecera) se parte de los datos actuales.
  const [wasEditing, setWasEditing] = useState(editing);
  if (editing !== wasEditing) {
    setWasEditing(editing);
    if (editing) {
      setDraft(toDraft(tenant));
      setError(null);
    }
  }

  function stopEdit() {
    setSearchParams({});
  }

  function setText(key: TextKey, value: string) {
    setDraft((d) => ({ ...d, [key]: value === '' ? null : value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateTenant(tenant.id, draft);
      onSaved();
      stopEdit();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="info-sheet">
        {SECTIONS.map((section) => (
          <section key={section.title} className="info-sheet__section">
            <h2 className="eyebrow">{section.title}</h2>
            <dl className="info-sheet__grid">
              {section.fields.map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>
                    {f.key === 'website' ? (
                      <ExternalLink url={tenant.website} label={tenant.website ?? ''} />
                    ) : (
                      (tenant[f.key] ?? '—')
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <section className="info-sheet__section">
          <h2 className="eyebrow">Referencias internas</h2>
          <dl className="info-sheet__grid">
            <div>
              <dt>Contacto en Holded</dt>
              <dd className="mono">{tenant.holded_contact_id ?? '—'}</dd>
            </div>
            <div>
              <dt>Proyecto Supabase</dt>
              <dd className="mono">{tenant.supabase_project_ref ?? '—'}</dd>
            </div>
            <div>
              <dt>Estado del data plane</dt>
              <dd>{tenant.data_plane_status ?? '—'}</dd>
            </div>
          </dl>
        </section>
      </div>
    );
  }

  return (
    <form className="info-sheet" onSubmit={handleSubmit}>
      {SECTIONS.map((section) => (
        <fieldset key={section.title} className="info-sheet__section">
          <legend className="eyebrow">{section.title}</legend>
          <div className="info-sheet__grid">
            {section.fields.map((f) => {
              const key = f.key;
              const id = `tenant-${key}`;
              return (
                <div key={f.key} className="form-field">
                  <label className="form-field__label" htmlFor={id}>
                    {f.label}
                  </label>
                  {key === 'size_employees' ? (
                    <input
                      id={id}
                      className="text-input"
                      type="number"
                      min={0}
                      value={draft.size_employees ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          size_employees: e.target.value === '' ? null : Number(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    <input
                      id={id}
                      className="text-input"
                      type={f.type ?? 'text'}
                      value={draft[key] ?? ''}
                      onChange={(e) => setText(key, e.target.value)}
                      required={f.required}
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      {error !== null && (
        <p className="notice notice--error" role="alert">
          {errorMessage(error)}
        </p>
      )}
      <div className="info-sheet__actions">
        <button type="button" className="btn btn--ghost" onClick={stopEdit} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
