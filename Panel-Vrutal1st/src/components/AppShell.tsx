import { useCallback, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { getStaffIdentity } from '../lib/api/staff';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { useDismiss } from '../lib/hooks/useDismiss';
import { ErrorNotice, LoadingState } from './StatusViews';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsMenu } from './NotificationsMenu';
import '../styles/shell.css';
import '../styles/pages/login.css';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  superadminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

type Workspace = 'operacion' | 'plataforma';

// Operación = día a día con clientes. Plataforma = catálogo y equipo (el antiguo "Developer").
// Solo UX: cada RPC comprueba el rol en el servidor.
const WORKSPACES: Record<Workspace, { label: string; home: string; groups: NavGroup[] }> = {
  operacion: {
    label: 'Operación',
    home: '/dashboard',
    groups: [
      {
        label: 'Operación',
        items: [
          { to: '/dashboard', label: 'Dashboard', icon: '◉' },
          { to: '/clientes', label: 'Clientes', icon: '▣' },
          { to: '/incidencias', label: 'Incidencias', icon: '⚑' },
          { to: '/tickets', label: 'Tickets', icon: '✉' },
          { to: '/flota', label: 'Flota VPS', icon: '⌁' },
          { to: '/aprobaciones', label: 'Aprobaciones bloqueadas', icon: '◷' },
        ],
      },
    ],
  },
  plataforma: {
    label: 'Plataforma',
    home: '/roles',
    groups: [
      {
        label: 'Catálogo',
        items: [
          { to: '/roles', label: 'Roles', icon: '◆' },
          { to: '/tareas', label: 'Tareas', icon: '☰' },
          { to: '/componentes', label: 'Componentes', icon: '⬡' },
          { to: '/composiciones', label: 'Composiciones', icon: '⇶' },
          { to: '/bloques', label: 'Bloques', icon: '▤' },
          { to: '/catalogo-kpis', label: 'KPIs y reportes', icon: '▦' },
          { to: '/sistemas', label: 'Stack / Sistemas', icon: '⧉' },
          { to: '/proveedores', label: 'Proveedores', icon: '◌' },
        ],
      },
      {
        label: 'Administración',
        items: [
          { to: '/equipo', label: 'Equipo Vrutal', icon: '☺', superadminOnly: true },
          { to: '/auditoria', label: 'Auditoría', icon: '⎘' },
        ],
      },
    ],
  },
};

function workspaceFor(pathname: string): Workspace {
  const inPlatform = WORKSPACES.plataforma.groups.some((g) =>
    g.items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)),
  );
  return inPlatform ? 'plataforma' : 'operacion';
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

interface AppShellProps {
  email: string;
  onSignOut: () => void;
}

export function AppShell({ email, onSignOut }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const loadIdentity = useCallback((signal: AbortSignal) => getStaffIdentity(signal), []);
  const { state, reload } = useAsyncData(loadIdentity);

  // Esto es UX, no seguridad: cada RPC comprueba el rol en el servidor.
  if (state.status !== 'ready' || !state.data || state.data.role_keys.length === 0) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <img className="auth-card__logo" src="/vrutal-lockup-dark.svg" alt="Vrutal Labs" />
          {state.status === 'loading' && <LoadingState />}
          {state.status === 'error' && <ErrorNotice error={state.error} onRetry={reload} />}
          {state.status === 'ready' && (
            <>
              <h1 className="auth-card__title">Sin acceso al panel</h1>
              <p className="auth-card__subtitle">
                {email} no tiene un rol del equipo Vrutal. Pide acceso a un superadmin.
              </p>
            </>
          )}
          {state.status !== 'loading' && (
            <button type="button" className="btn btn--ghost btn--block" onClick={onSignOut}>
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    );
  }

  const identity = state.data;
  const isSuperadmin = identity.role_keys.includes('platform_superadmin');
  const current = workspaceFor(pathname);
  const displayName = identity.full_name || identity.email;

  return (
    <div className="shell">
      <aside id="shell-nav" className={navOpen ? 'shell__side shell__side--open' : 'shell__side'}>
        <img className="shell__logo" src="/vrutal-lockup-dark.svg" alt="Vrutal Labs" />

        <div className="workspace" role="group" aria-label="Espacio de trabajo">
          {(Object.keys(WORKSPACES) as Workspace[]).map((w) => (
            <Link
              key={w}
              to={WORKSPACES[w].home}
              className="workspace__option"
              aria-current={w === current ? 'true' : undefined}
              onClick={() => setNavOpen(false)}
            >
              {WORKSPACES[w].label}
            </Link>
          ))}
        </div>

        <nav aria-label="Principal">
          {WORKSPACES[current].groups.map((group) => (
            <div key={group.label} className="side-nav__group">
              <span className="eyebrow side-nav__label">{group.label}</span>
              {group.items
                .filter((item) => !item.superadminOnly || isSuperadmin)
                .map((item) => (
                  <NavLink key={item.to} to={item.to} className="side-nav__link" onClick={() => setNavOpen(false)}>
                    <span className="side-nav__icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    {item.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>

        <p className="shell__foot">Vrutal1st · {import.meta.env.PROD ? 'prod' : 'dev'}</p>
      </aside>
      {navOpen && <div className="shell__scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <div className="shell__body">
        <header className="topbar">
          <button
            type="button"
            className="icon-button topbar__nav-toggle"
            aria-expanded={navOpen}
            aria-controls="shell-nav"
            aria-label="Menú de navegación"
            onClick={() => setNavOpen((v) => !v)}
          >
            <BurgerIcon />
          </button>
          <GlobalSearch />
          <span className="topbar__env" title="Entorno">
            {import.meta.env.PROD ? 'PROD' : 'DEV'}
          </span>
          <span className="topbar__spacer" />
          <NotificationsMenu />
          <AccountMenu
            name={displayName}
            email={identity.email}
            roleLabel={identity.role_names.join(' · ')}
            onSignOut={onSignOut}
          />
        </header>
        <main className="shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

interface AccountMenuProps {
  name: string;
  email: string;
  roleLabel: string;
  onSignOut: () => void;
}

function AccountMenu({ name, email, roleLabel, onSignOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, rootRef, triggerRef);

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="account-menu__trigger"
        aria-expanded={open}
        aria-controls="account-menu-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="account-menu__avatar" aria-hidden="true">
          {initials(name)}
        </span>
        <span className="account-menu__email">{name}</span>
        <BurgerIcon />
      </button>
      {open && (
        <div id="account-menu-panel" className="account-menu__panel">
          <p className="account-menu__who">
            <span className="eyebrow">{roleLabel}</span>
            <span className="account-menu__who-email">{name}</span>
            {name !== email && <span className="account-menu__who-email">{email}</span>}
          </p>
          <div className="account-menu__section">
            <button type="button" className="account-menu__item" onClick={onSignOut}>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BurgerIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
