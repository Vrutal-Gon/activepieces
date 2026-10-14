import { COMPOSITION_PATTERNS } from '../lib/types';
import { PATTERN_COPY } from '../lib/catalogCopy';
import { ProcessOptions } from './ProcessOptions';

interface TaskTypeFiltersProps {
  processId: string | null;
  pattern: string | null;
  onProcess: (id: string | null) => void;
  onPattern: (pattern: string | null) => void;
}

/** Tipo de tarea: proceso (cómo está segmentado el trabajo) y patrón (cómo se ejecuta). */
export function TaskTypeFilters({ processId, pattern, onProcess, onPattern }: TaskTypeFiltersProps) {
  return (
    <>
      <label className="inline-field">
        Proceso
        <select className="text-input" value={processId ?? ''} onChange={(e) => onProcess(e.target.value || null)}>
          <option value="">Todos</option>
          <ProcessOptions />
        </select>
      </label>
      <label className="inline-field">
        Patrón
        <select className="text-input" value={pattern ?? ''} onChange={(e) => onPattern(e.target.value || null)}>
          <option value="">Todos</option>
          {COMPOSITION_PATTERNS.map((p) => (
            <option key={p} value={p} title={PATTERN_COPY[p]}>
              {p}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
