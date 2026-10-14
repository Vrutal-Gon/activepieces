import { useCallback } from 'react';
import { listDomains, listProcesses } from '../lib/api/catalog';
import { useAsyncData } from '../lib/hooks/useAsyncData';

/** Opciones de proceso agrupadas por departamento, en su orden. Para usar dentro de un <select>. */
export function ProcessOptions() {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [processes, domains] = await Promise.all([listProcesses(signal), listDomains(signal)]);
      return { processes, domains };
    },
    [],
  );
  const { state } = useAsyncData(load);
  if (state.status !== 'ready') return null;

  const { processes, domains } = state.data;
  const byDomain = new Map<string, typeof processes>();
  for (const p of processes) byDomain.set(p.domain_id, [...(byDomain.get(p.domain_id) ?? []), p]);

  return (
    <>
      {[...byDomain.entries()].map(([domainId, list]) => (
        <optgroup key={domainId} label={domains.find((d) => d.id === domainId)?.name ?? domainId}>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sequence_ord ? `${p.sequence_ord}. ` : ''}
              {p.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
