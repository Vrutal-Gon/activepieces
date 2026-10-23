import { useCallback } from 'react';
import { Link } from 'react-router';
import { listVisibleSpecialists } from '../lib/api/specialists';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import {
  AUTONOMY_LABEL,
  PHASE_HINT,
  PHASE_LABEL,
  STATUS_LABEL,
  labelOf,
  specialistInitials,
} from '../lib/specialistCopy';
import type { Profile, Specialist } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import '../styles/pages/specialists.css';

export function SpecialistList({ profile }: { profile: Profile }) {
  const load = useCallback((signal: AbortSignal) => listVisibleSpecialists(profile, signal), [profile]);
  const { state, reload } = useAsyncData(load);

  return (
    <section>
      <PageHead crumbs={[{ label: 'Mi trabajo' }]} title="Especialistas" />
      <p className="lead">
        Los especialistas son tu equipo digital. Aquí ves qué hace cada uno y hasta dónde puede actuar. Solo Vrutal los
        activa o los cambia.
      </p>

      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && state.data.length === 0 && (
        <div className="empty-state">
          <h2 className="empty-state__title">Todavía no tienes especialistas</h2>
          <p className="empty-state__body">
            {profile.role === 'client_admin'
              ? 'Cuando Vrutal active el primero, aparecerá aquí.'
              : 'Pide a tu administrador que te habilite alguno.'}
          </p>
        </div>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <div className="cards">
          {state.data.map((s) => (
            <SpecialistCard key={s.id} specialist={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function SpecialistCard({ specialist: s }: { specialist: Specialist }) {
  const status = STATUS_LABEL[s.status] ?? { label: s.status, tone: '' as const };
  return (
    <article className="spec">
      <div className="spec__head">
        <span className="spec__avatar" aria-hidden="true">
          {specialistInitials(s.display_name)}
        </span>
        <div>
          <h2 className="spec__name">{s.display_name}</h2>
          <span className={`pill ${status.tone ? `pill--${status.tone}` : ''}`}>{status.label}</span>
        </div>
      </div>
      <dl className="spec__facts">
        <dt>Fase</dt>
        <dd title={PHASE_HINT[s.phase]}>{labelOf(PHASE_LABEL, s.phase)}</dd>
        <dt>Puede</dt>
        <dd>{labelOf(AUTONOMY_LABEL, s.autonomy_level)}</dd>
      </dl>
      <div className="spec__actions">
        <Link className="btn btn--ghost btn--sm" to={`/especialistas/${s.id}`}>
          Abrir
        </Link>
      </div>
    </article>
  );
}
