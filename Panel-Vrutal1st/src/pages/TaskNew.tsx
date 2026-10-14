import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { supabase } from '../lib/supabaseClient';
import { createTask } from '../lib/api/catalog';
import { errorMessage } from '../lib/api/client';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { PATTERN_COPY } from '../lib/catalogCopy';
import { COMPOSITION_PATTERNS } from '../lib/types';
import { PageHead, type Crumb } from '../components/PageHead';
import { ProcessOptions } from '../components/ProcessOptions';
import '../styles/pages/catalog.css';

const RISKS = [
  { key: 'low', label: 'Bajo', hint: 'Un error se corrige sin coste.' },
  { key: 'medium', label: 'Medio', hint: 'Un error cuesta tiempo o molesta a alguien.' },
  { key: 'medium_high', label: 'Medio-alto', hint: 'Un error cuesta dinero o confianza.' },
  { key: 'high', label: 'Alto', hint: 'Un error tiene consecuencias legales o económicas serias.' },
];

interface RoleRef {
  id: string;
  key: string;
  name: string;
  version: number;
}

/**
 * Asistente de tarea nueva. `?rol=<job_role_id>` la enlaza a ese rol al crearla.
 * Al terminar lleva a la composición de la tarea: el siguiente paso natural.
 */
export function TaskNew() {
  const [params] = useSearchParams();
  const roleId = params.get('rol');
  const navigate = useNavigate();

  const loadRole = useCallback(
    async (signal: AbortSignal): Promise<RoleRef | null> => {
      if (!roleId) return null;
      const { data, error } = await supabase.rpc('catalog_get_job_role', { p_id: roleId }).abortSignal(signal);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as RoleRef | null;
    },
    [roleId],
  );
  const role = useAsyncData(loadRole).state;
  const roleRef = role.status === 'ready' ? role.data : null;

  const [statement, setStatement] = useState('');
  const [processId, setProcessId] = useState('');
  const [pattern, setPattern] = useState('WORKFLOW');
  const [risk, setRisk] = useState('low');
  const [reversible, setReversible] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [customerFacing, setCustomerFacing] = useState(false);
  const [touchesBudget, setTouchesBudget] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const id = await createTask({
        statement,
        processId,
        pattern,
        risk,
        reversible,
        requiresApproval,
        customerFacing,
        touchesBudget,
        jobRoleId: roleRef?.id ?? null,
      });
      const ctx = roleRef ? `?rol=${encodeURIComponent(roleRef.id)}` : '';
      navigate(`/tareas/${encodeURIComponent(id)}/composiciones${ctx}`, { replace: true });
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  const crumbs: Crumb[] = roleRef
    ? [
        { label: 'Roles', to: '/roles' },
        { label: `${roleRef.name} v${roleRef.version}`, to: `/roles/${encodeURIComponent(roleRef.key)}/anadir` },
      ]
    : [{ label: 'Tareas', to: '/tareas' }];

  return (
    <section>
      <PageHead crumbs={crumbs} title="Nueva tarea" />

      <form className="catalog-stack wizard" onSubmit={submit}>
        <p className="catalog-note">
          Una tarea es una unidad de trabajo que un especialista hace de principio a fin. Después la resolverás con una
          composición de bloques.
          {roleRef && (
            <>
              {' '}
              Se enlazará a <strong>{roleRef.name}</strong>.
            </>
          )}
        </p>

        <fieldset className="table-card wizard__step">
          <legend className="wizard__legend">
            <span className="side-nav__step">1</span> Qué hace
          </legend>
          <label className="inline-field wizard__wide">
            Una frase: verbo + objeto + resultado
            <textarea
              className="text-input"
              placeholder="Registrar una factura de proveedor en el ERP"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              required
              minLength={10}
            />
          </label>
        </fieldset>

        <fieldset className="table-card wizard__step">
          <legend className="wizard__legend">
            <span className="side-nav__step">2</span> Tipo
          </legend>
          <label className="inline-field">
            Proceso
            <select className="text-input" value={processId} onChange={(e) => setProcessId(e.target.value)}>
              <option value="">Sin proceso</option>
              <ProcessOptions />
            </select>
          </label>
          <label className="inline-field">
            Patrón
            <select className="text-input" value={pattern} onChange={(e) => setPattern(e.target.value)}>
              {COMPOSITION_PATTERNS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <p className="catalog-note wizard__hint">{PATTERN_COPY[pattern]}</p>
        </fieldset>

        <fieldset className="table-card wizard__step">
          <legend className="wizard__legend">
            <span className="side-nav__step">3</span> Riesgo
          </legend>
          <label className="inline-field">
            Si sale mal…
            <select className="text-input" value={risk} onChange={(e) => setRisk(e.target.value)}>
              {RISKS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <p className="catalog-note wizard__hint">{RISKS.find((r) => r.key === risk)?.hint}</p>
          <div className="wizard__checks">
            <label className="check-field">
              <input type="checkbox" checked={reversible} onChange={(e) => setReversible(e.target.checked)} />
              Se puede deshacer
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
              />
              Necesita la firma de una persona
            </label>
            <label className="check-field">
              <input type="checkbox" checked={customerFacing} onChange={(e) => setCustomerFacing(e.target.checked)} />
              La ve un cliente final
            </label>
            <label className="check-field">
              <input type="checkbox" checked={touchesBudget} onChange={(e) => setTouchesBudget(e.target.checked)} />
              Mueve dinero o presupuesto
            </label>
          </div>
        </fieldset>

        {error !== null && (
          <p className="notice notice--error" role="alert">
            {errorMessage(error)}
          </p>
        )}
        <div className="inline-form">
          <button type="submit" className="btn btn--primary" disabled={saving || statement.trim().length < 10}>
            {saving ? 'Creando…' : 'Crear tarea y montar su composición →'}
          </button>
          <span className="catalog-note">Nace en borrador. Nada llega a un cliente hasta que se publica.</span>
        </div>
      </form>
    </section>
  );
}
