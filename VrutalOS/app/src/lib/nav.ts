export type Workspace = 'trabajo' | 'admin';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** Evita que «/» marque «Inicio» como activo en cualquier ruta hija. */
  end?: boolean;
  /** Solo se muestra al Admin (UX: el servidor decide con RLS). */
  adminOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Solo UX: cada tabla se protege con RLS en el servidor, esto no es seguridad.
export const WORKSPACES: Record<Workspace, { label: string; hint: string; icon: string; home: string; groups: NavGroup[] }> = {
  trabajo: {
    label: 'Mi trabajo',
    hint: 'Especialistas y tareas',
    icon: '◉',
    home: '/',
    groups: [
      {
        label: 'Trabajo',
        items: [
          { to: '/', label: 'Inicio', icon: '◉', end: true },
          { to: '/conversaciones', label: 'Conversaciones', icon: '✉' },
          { to: '/especialistas', label: 'Especialistas', icon: '◆' },
          { to: '/aprobaciones', label: 'Aprobaciones', icon: '◷' },
          { to: '/reportes', label: 'Reportes', icon: '▦' },
        ],
      },
      { label: 'Ayuda', items: [{ to: '/soporte', label: 'Soporte', icon: '?', adminOnly: true }] },
    ],
  },
  admin: {
    label: 'Administración',
    hint: 'Equipo y empresa',
    icon: '⬡',
    home: '/admin',
    groups: [
      {
        label: 'Empresa',
        items: [
          { to: '/admin', label: 'Resumen', icon: '◉', end: true },
          { to: '/admin/equipo', label: 'Equipo', icon: '☺' },
          { to: '/admin/accesos', label: 'Accesos', icon: '⧉' },
          { to: '/admin/integraciones', label: 'Integraciones', icon: '⌁' },
        ],
      },
      {
        label: 'Control',
        items: [
          { to: '/admin/consumo', label: 'Consumo', icon: '▤' },
          { to: '/admin/personalizacion', label: 'Personalización', icon: '✎' },
          { to: '/admin/delegaciones', label: 'Delegaciones', icon: '⇄' },
          { to: '/admin/auditoria', label: 'Auditoría', icon: '⎘' },
        ],
      },
    ],
  },
};

/** Grupos del espacio con solo los elementos que esta persona puede ver; sin grupos vacíos. */
export function visibleGroups(workspace: Workspace, isAdmin: boolean): NavGroup[] {
  return WORKSPACES[workspace].groups
    .map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.adminOnly) }))
    .filter((g) => g.items.length > 0);
}

export function workspaceFor(pathname: string, isAdmin: boolean): Workspace {
  return isAdmin && (pathname === '/admin' || pathname.startsWith('/admin/')) ? 'admin' : 'trabajo';
}
