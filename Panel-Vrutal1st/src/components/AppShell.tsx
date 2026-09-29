import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { getStaffIdentity } from '../lib/api/staff';
import { useAsyncData } from '../lib/hooks/useAsyncData';
import { ErrorNotice, LoadingState } from './StatusViews';
import '../styles/shell.css';
import '../styles/pages/login.css';

interface NavItem {
  to: string;
  label: string;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operación',
    items: [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/clientes', label: 'Clientes' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { to: '/roles', label: 'Roles' },
      { to: '/componentes', label: 'Componentes' },
      { to: '/composiciones', label: 'Composiciones' },
      { to: '/bloques', label: 'Bloques' },
      { to: '/sistemas', label: 'Stack / Sistemas' },
      { to: '/proveedores', label: 'Proveedores' },
    ],
  },
];

// Solo UX: la Edge Function y las RPC de equipo exigen superadmin en el servidor.
const ADMIN_GROUP: { label: string; items: NavItem[] } = {
  label: 'Administración',
  items: [{ to: '/equipo', label: 'Equipo Vrutal' }],
};

interface AppShellProps {
  email: string;
  onSignOut: () => void;
}

export function AppShell({ email, onSignOut }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
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
  const navGroups = identity.role_keys.includes('platform_superadmin') ? [...NAV_GROUPS, ADMIN_GROUP] : NAV_GROUPS;

  return (
    <div className="shell">
      <aside id="shell-nav" className={navOpen ? 'shell__side shell__side--open' : 'shell__side'}>
        <img className="shell__logo" src="/vrutal-lockup-dark.svg" alt="Vrutal Labs" />
        <nav aria-label="Principal">
          {navGroups.map((group) => (
            <div key={group.label} className="side-nav__group">
              <span className="eyebrow side-nav__label">{group.label}</span>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} className="side-nav__link" onClick={() => setNavOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
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
          <span className="topbar__spacer" />
          <AccountMenu
            name={identity.full_name || identity.email}
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

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (e.target instanceof Node && !rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
          {name.charAt(0).toUpperCase()}
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
