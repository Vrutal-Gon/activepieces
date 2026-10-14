import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { getSpecialist, listMySpecialistIds } from '../lib/api/specialists';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import {
  AUTONOMY_LABEL,
  PHASE_HINT,
  PHASE_LABEL,
  STATUS_LABEL,
  labelOf,
  specialistInitials,
} from '../lib/specialistCopy';
import type { Profile } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import { WorkSection } from '../components/WorkSection';
import '../styles/pages/specialists.css';

export function SpecialistDetail({ profile }: { profile: Profile }) {
  const { id = '' } = useParams();
  const isAdmin = profile.role === 'client_admin';
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [specialist, mine] = await Promise.all([
        getSpecialist(id, signal),
        isAdmin ? Promise.resolve(null) : listMySpecialistIds(profile.id, signal),
      ]);
      // Solo UX: si no está habilitado para esta persona, se trata como si no existiera.
      return specialist !== null && (mine === null || mine.includes(specialist.id)) ? specialist : null;
    },
    [id, isAdmin, profile.id],
  );
  const { state, reload } = useAsyncData(load);

  const back = [{ label: 'Mi trabajo' }, { label: 'Especialistas', to: '/especialistas' }];

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorNotice error={state.error} onRetry={reload} />;
  if (state.data === null) {
    return (
      <section>
        <PageHead crumbs={back} title="Especialista no encontrado" />
        <div className="empty-state">
          <h2 className="empty-state__title">No encontramos este especialista</h2>
          <p className="empty-state__body">
            Puede que no esté habilitado para ti. <Link to="/especialistas">Volver a Especialistas</Link>
          </p>
        </div>
      </section>
    );
  }

  const s = state.data;
  const status = STATUS_LABEL[s.status] ?? { label: s.status, tone: '' as const };

  return (
    <section>
      <PageHead crumbs={back} title={s.display_name} />
      <div className="spec-hero">
        <span className="spec__avatar" aria-hidden="true">
          {specialistInitials(s.display_name)}
        </span>
        <dl className="spec__facts">
          <dt>Estado</dt>
          <dd>
            <span className={`pill ${status.tone ? `pill--${status.tone}` : ''}`}>{status.label}</span>
          </dd>
          <dt>Fase</dt>
          <dd>
            {labelOf(PHASE_LABEL, s.phase)}
            {PHASE_HINT[s.phase] && <span className="muted"> · {PHASE_HINT[s.phase]}</span>}
          </dd>
          <dt>Puede</dt>
          <dd>{labelOf(AUTONOMY_LABEL, s.autonomy_level)}</dd>
        </dl>
      </div>

      <p className="lead">
        Lo que este especialista va produciendo. Revisa las propuestas y aprueba las que quieras: su trabajo siguiente
        parte de lo que apruebes.
      </p>
      <WorkSection specialistId={s.id} />
    </section>
  );
}
