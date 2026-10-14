import { useState } from 'react';
import { getUsage } from '../lib/api/usage';
import { listSpecialists } from '../lib/api/specialists';
import { formatCompact, formatInt, formatUsd } from '../lib/format';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import type { UsageRow } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { ErrorNotice, LoadingState } from '../components/StatusViews';
import '../styles/pages/usage.css';

type Period = 'current' | 'previous';

const MONTH = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });

/** Este mes y el anterior, completos, en hora local de quien mira la pantalla. */
async function loadUsage(signal: AbortSignal) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [current, previous, specialists] = await Promise.all([
    getUsage(start, nextStart, signal),
    getUsage(prevStart, start, signal),
    listSpecialists(signal),
  ]);
  return {
    current,
    previous,
    names: new Map(specialists.map((s) => [s.id, s.display_name])),
    labels: { current: MONTH.format(start), previous: MONTH.format(prevStart) },
  };
}

const totals = (rows: UsageRow[]) =>
  rows.reduce(
    (t, r) => ({
      cost: t.cost + r.cost_usd,
      runs: t.runs + r.runs,
      tokensIn: t.tokensIn + r.tokens_in,
      tokensOut: t.tokensOut + r.tokens_out,
    }),
    { cost: 0, runs: 0, tokensIn: 0, tokensOut: 0 },
  );

export function UsagePage() {
  const { state, reload } = useAsyncData(loadUsage);
  const [period, setPeriod] = useState<Period>('current');

  return (
    <section>
      <PageHead crumbs={[{ label: 'Administración' }]} title="Consumo">
        <div className="chip-group" role="group" aria-label="Periodo">
          <button type="button" className="chip" aria-pressed={period === 'current'} onClick={() => setPeriod('current')}>
            Este mes
          </button>
          <button type="button" className="chip" aria-pressed={period === 'previous'} onClick={() => setPeriod('previous')}>
            Mes anterior
          </button>
        </div>
      </PageHead>

      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
      {state.status === 'ready' && (
        <UsageView
          rows={state.data[period]}
          other={state.data[period === 'current' ? 'previous' : 'current']}
          names={state.data.names}
          label={state.data.labels[period]}
          otherLabel={state.data.labels[period === 'current' ? 'previous' : 'current']}
        />
      )}
    </section>
  );
}

interface UsageViewProps {
  rows: UsageRow[];
  other: UsageRow[];
  names: Map<string, string>;
  label: string;
  otherLabel: string;
}

function UsageView({ rows, other, names, label, otherLabel }: UsageViewProps) {
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <h2 className="empty-state__title">Sin consumo en {label}</h2>
        <p className="empty-state__body">Cuando tus especialistas trabajen, verás aquí cuánto consumen y quién lo consume.</p>
      </div>
    );
  }

  const t = totals(rows);
  const o = totals(other);
  const sorted = [...rows].sort((a, b) => b.cost_usd - a.cost_usd);
  const max = sorted[0]?.cost_usd ?? 0;

  return (
    <div className="stack">
      <div className="stats">
        <div className="stat">
          <span className="eyebrow">Coste · {label}</span>
          <p className="stat__value">{formatUsd(t.cost)}</p>
          <span className="stat__detail">
            {otherLabel}: {formatUsd(o.cost)}
          </span>
        </div>
        <div className="stat">
          <span className="eyebrow">Ejecuciones</span>
          <p className="stat__value">{formatInt(t.runs)}</p>
          <span className="stat__detail">
            {otherLabel}: {formatInt(o.runs)}
          </span>
        </div>
        <div className="stat">
          <span className="eyebrow">Tokens</span>
          <p className="stat__value">{formatCompact(t.tokensIn + t.tokensOut)}</p>
          <span className="stat__detail">
            {formatCompact(t.tokensIn)} entrada · {formatCompact(t.tokensOut)} salida
          </span>
        </div>
      </div>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Coste por especialista</h2>
          <span className="card__meta">Importes en dólares (USD)</span>
        </div>
        <div className="card__body">
          {sorted.map((r) => (
            <div className="usage-bar" key={r.specialist_id}>
              <span>
                {names.get(r.specialist_id) ?? 'Especialista retirado'}
                <span className="usage-bar__sub">{formatInt(r.runs)} ejecuciones</span>
              </span>
              <div className="usage-bar__track" aria-hidden="true">
                <div className="usage-bar__fill" style={{ width: `${max > 0 ? (r.cost_usd / max) * 100 : 0}%` }} />
              </div>
              <span className="usage-bar__value">{formatUsd(r.cost_usd)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
