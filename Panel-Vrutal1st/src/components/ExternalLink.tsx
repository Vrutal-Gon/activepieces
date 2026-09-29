import { safeHttpUrl } from '../lib/url';

interface ExternalLinkProps {
  url: string | null;
  label: string;
}

/** Enlace a una URL que viene de datos: solo http(s); si no es válida muestra "—". */
export function ExternalLink({ url, label }: ExternalLinkProps) {
  const href = safeHttpUrl(url);
  if (!href) return <>—</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}
