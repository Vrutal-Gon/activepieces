import { useState } from 'react';
import { decideApproval, listApprovals, listProfileNames } from '../lib/api/approvals';
import { errorMessage } from '../lib/api/client';
import { listSpecialists } from '../lib/api/specialists';
import { formatDateTime } from '../lib/format';
import { notifyApprovalsChanged } from '../lib/approvalsEvents';
import { describePayload } from '../lib/payloadView';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import type { Approval, Profile } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import '../styles/pages/approvals.css';

type Tab = 'pending' | 'decided';

async function loadApprovals(signal: AbortSignal) {
  const [approvals, specialists, people] = await Promise.all([
    listApprovals(signal),
    listSpecialists(signal),
    listProfileNames(signal),
  ]);
  return { approvals, specialists: new Map(specialists.map((s) => [s.id, s.display_name])), people };
}

/** Datos tal cual los manda el especialista, solo para quien quiera verlos. Siempre como texto, nunca como HTML. */
function rawJson(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2) ?? 'Sin detalle.';
  } catch {
    return 'Sin detalle.';
  }
}

export function ApprovalsPage({ profile }: { profile: Profile }) {
  const { state, reload, refresh } = useAsyncData(loadApprovals);
  const [tab, setTab] = useState<Tab>('pending');
  const [confirming, setConfirming] = useState<{ id: string; approve: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function decide(approval: Approval, approve: boolean) {
    setBusy(true);
    setNotice(null);
    try {
      // Quién decide lo pone el servidor (`decide_approval`), no el navegador.
      const result = await decideApproval(approval.id, approve);
      if (!result.decided) {
        setNotice('No se ha podido registrar tu decisión. Puede que ya la haya tomado otra persona o que no tengas permiso.');
      } else if (result.warning) {
        setNotice(result.warning);
      }
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setConfirming(null);
      setBusy(false);
      refresh();
      notifyApprovalsChanged();
    }
  }

  const all = state.status === 'ready' ? state.data.approvals : [];
  const pending = all.filter((a) => a.status === 'pending');
  const decided = all.filter((a) => a.status !== 'pending');
  const shown = tab === 'pending' ? pending : decided;

  return (
    <section>
      <PageHead crumbs={[{ label: 'Mi trabajo' }]} title="Aprobaciones" />
      <p className="lead">
        {profile.role === 'client_admin'
          ? 'Lo que tus especialistas quieren hacer y necesita tu visto bueno. Ves las de toda la empresa.'
          : 'Lo que tus especialistas quieren hacer y necesita tu visto bueno.'}
      </p>

      <div className="chip-group" role="group" aria-label="Estado" style={{ marginBottom: 'var(--space-4)' }}>
        <button type="button" className="chip" aria-pressed={tab === 'pending'} onClick={() => setTab('pending')}>
          Pendientes · {pending.length}
        </button>
        <button type="button" className="chip" aria-pressed={tab === 'decided'} onClick={() => setTab('decided')}>
          Decididas
        </button>
      </div>

      {notice && (
        <p className="notice notice--error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {notice}
        </p>
      )}
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && shown.length === 0 && (
        <div className="empty-state">
          <h2 className="empty-state__title">
            {tab === 'pending' ? 'No tienes nada pendiente' : 'Todavía no hay aprobaciones decididas'}
          </h2>
          <p className="empty-state__body">
            {tab === 'pending'
              ? 'Cuando un especialista necesite tu visto bueno, aparecerá aquí.'
              : 'Las que apruebes o rechaces quedarán registradas aquí.'}
          </p>
        </div>
      )}
      {state.status === 'ready' && shown.length > 0 && (
        <div className="card">
          {shown.map((a) => {
            const specialist = state.data.specialists.get(a.specialist_id) ?? 'Especialista';
            // El título lo escribe el flujo en el payload; nunca se busca en el catálogo de Vrutal.
            const view = describePayload(a.payload);
            const isConfirming = confirming?.id === a.id;
            return (
              <article className="approval" key={a.id}>
                <div className="approval__head">
                  <div>
                    <strong>{view.title ?? 'Acción propuesta'}</strong>
                    <div className="muted small">
                      {specialist} · {formatDateTime(a.requested_at)}
                    </div>
                  </div>
                  {a.status === 'pending' && <span className="pill pill--warn">Pendiente</span>}
                  {a.status === 'approved' && <span className="pill pill--ok">Aprobada</span>}
                  {a.status === 'rejected' && <span className="pill pill--bad">Rechazada</span>}
                </div>
                <PayloadSummary view={view} payload={a.payload} />
                {a.status === 'pending' ? (
                  <div className="approval__actions">
                    {isConfirming ? (
                      <>
                        <span className="small">{confirming.approve ? '¿Aprobar esta acción?' : '¿Rechazar esta acción?'}</span>
                        <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setConfirming(null)}>
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className={`btn btn--sm ${confirming.approve ? 'btn--primary' : 'btn--danger'}`}
                          disabled={busy}
                          onClick={() => decide(a, confirming.approve)}
                        >
                          {busy ? 'Guardando…' : 'Confirmar'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={() => setConfirming({ id: a.id, approve: false })}>
                          Rechazar
                        </button>
                        <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => setConfirming({ id: a.id, approve: true })}>
                          Aprobar
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="muted small approval__foot">
                    {a.decided_by ? `Decidida por ${state.data.people.get(a.decided_by) ?? 'una persona del equipo'}` : 'Decidida'}
                    {a.decided_at ? ` · ${formatDateTime(a.decided_at)}` : ''}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PayloadSummary({ view, payload }: { view: ReturnType<typeof describePayload>; payload: unknown }) {
  return (
    <div className="approval__body">
      {view.summary && <p className="approval__summary">{view.summary}</p>}
      {view.fields.length > 0 && (
        <dl className="approval__fields">
          {view.fields.map((f, i) => (
            <div key={`${f.label}:${i}`} className="approval__field">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {!view.summary && view.fields.length === 0 && <p className="muted small">Sin más detalle.</p>}
      <details className="approval__tech">
        <summary>Ver datos técnicos</summary>
        <pre className="approval__payload" tabIndex={0}>
          {rawJson(payload)}
        </pre>
      </details>
    </div>
  );
}
