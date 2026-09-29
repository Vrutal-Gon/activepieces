import { Link } from 'react-router';

export type Severity = 'crit' | 'warn' | 'info';

export interface AttentionItem {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  to?: string;
}

const LABEL: Record<Severity, string> = { crit: 'CRÍTICO', warn: 'AVISO', info: 'INFO' };
const ORDER: Record<Severity, number> = { crit: 0, warn: 1, info: 2 };

interface AttentionListProps {
  items: AttentionItem[];
  emptyText: string;
}

export function AttentionList({ items, emptyText }: AttentionListProps) {
  if (items.length === 0) return <p className="attention__empty">{emptyText}</p>;
  const sorted = [...items].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return (
    <ul className="attention">
      {sorted.map((item) => (
        <li key={item.id} className="attention__item">
          <span className={`sev sev--${item.severity}`}>{LABEL[item.severity]}</span>
          <div>
            <p className="attention__title">{item.title}</p>
            <p className="attention__detail">{item.detail}</p>
          </div>
          {item.to && (
            <Link className="btn btn--ghost btn--sm" to={item.to}>
              Abrir
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
