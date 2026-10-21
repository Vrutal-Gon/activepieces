import type { ReactNode } from 'react';
import type { AsyncState } from '../lib/hooks/useAsyncData';
import { ErrorNotice, LoadingState } from './StatusViews';

interface WhereUsedProps<T> {
  title: string;
  state: AsyncState<T[]>;
  onRetry: () => void;
  /** Cabeceras de la tabla. */
  head: string[];
  row: (item: T) => ReactNode;
  keyOf: (item: T) => string;
  empty: string;
}

/**
 * «Dónde se usa», en cualquier dirección del catálogo.
 *
 * Saber a cuántos sitios afecta algo antes de tocarlo es la mitad del trabajo de curar un
 * catálogo compartido: un bloque que monta una composición sola no es lo mismo que uno que
 * monta seis.
 */
export function WhereUsed<T>({ title, state, onRetry, head, row, keyOf, empty }: WhereUsedProps<T>) {
  return (
    <section className="table-card">
      <div className="table-card__head">
        <h2 className="table-card__title">
          {title}
          {state.status === 'ready' && <span className="client-tabs__count">{state.data.length}</span>}
        </h2>
      </div>
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorNotice error={state.error} onRetry={onRetry} />}
      {state.status === 'ready' &&
        (state.data.length === 0 ? (
          <p className="data-table__empty">{empty}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.data.map((item) => (
                <tr key={keyOf(item)}>{row(item)}</tr>
              ))}
            </tbody>
          </table>
        ))}
    </section>
  );
}
