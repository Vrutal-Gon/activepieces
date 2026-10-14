import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { TENANT_NAME } from '../lib/supabaseClient';
import { WORKSPACES, visibleGroups, workspaceFor, type Workspace } from '../lib/nav';
import { useDismiss } from '../lib/hooks/useDismiss';
import { countPendingApprovals } from '../lib/api/approvals';
import { onApprovalsChanged } from '../lib/approvalsEvents';
import type { Profile } from '../lib/types';
import '../styles/shell.css';

interface AppShellProps {
  profile: Profile;
  email: string;
  onSignOut: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Un solo shell para los dos layouts: el usuario ve «Mi trabajo»; el admin, además, «Administración». */
export function AppShell({ profile, email, onSignOut }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const isAdmin = profile.role === 'client_admin';
  const current = workspaceFor(pathname, isAdmin);
  const workspaceKeys: Workspace[] = ['trabajo', 'admin'];
  const pendingApprovals = usePendingApprovals(pathname);
  const displayName = profile.full_name || email;
  const roleLabel = isAdmin ? 'Administrador' : 'Usuario';

  return (
    <div className="shell" data-workspace={current}>
      <aside id="shell-nav" className={navOpen ? 'shell__side shell__side--open' : 'shell__side'}>
        <img className="shell__logo" src="/vrutal-lockup-dark.svg" alt="Vrutal Labs" />
        {TENANT_NAME && (
          <div className="tenant">
            <span className="eyebrow">Empresa</span>
            <span className="tenant__name">{TENANT_NAME}</span>
          </div>
        )}

        {isAdmin && (
          <div className="workspace" role="group" aria-label="Espacio de trabajo">
            {workspaceKeys.map((w) => (
              <Link
                key={w}
                to={WORKSPACES[w].home}
                className={`workspace__option workspace__option--${w}`}
                aria-current={w === current ? 'true' : undefined}
                onClick={() => setNavOpen(false)}
              >
                <span className="workspace__icon" aria-hidden="true">
                  {WORKSPACES[w].icon}
                </span>
                <span className="workspace__label">{WORKSPACES[w].label}</span>
                <span className="workspace__hint">{WORKSPACES[w].hint}</span>
              </Link>
            ))}
          </div>
        )}

        <nav aria-label="Principal">
          {visibleGroups(current, isAdmin).map((group) => (
            <div key={group.label} className="side-nav__group">
              <span className="eyebrow side-nav__label">{group.label}</span>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="side-nav__link" onClick={() => setNavOpen(false)}>
                  <span className="side-nav__icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                  {item.to === '/aprobaciones' && pendingApprovals > 0 && (
                    <span className="pill pill--warn side-nav__badge" aria-label={`${pendingApprovals} pendientes`}>
                      {pendingApprovals}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <p className="shell__foot">VrutalOS · {import.meta.env.PROD ? 'prod' : 'dev'}</p>
      </aside>
      {navOpen && <div className="shell__scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <div className="shell__body">
        <div className="shell__head">
          {current === 'admin' && (
            <div className="workspace-band" role="note">
              <span className="workspace-band__label">Administración</span>
              <span className="workspace-band__text">
                Estás configurando la empresa: los cambios afectan a todas las personas del equipo
              </span>
              <Link className="workspace-band__exit" to={WORKSPACES.trabajo.home}>
                Ir a Mi trabajo →
              </Link>
            </div>
          )}
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
            <AccountMenu name={displayName} email={email} roleLabel={roleLabel} onSignOut={onSignOut} />
          </header>
        </div>
        <main className="shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Cuántas aprobaciones esperan a esta persona. Se actualiza al navegar y al decidir una. Si falla, no se enseña nada. */
function usePendingApprovals(pathname: string): number {
  const [count, setCount] = useState(0);
  const [nonce, setNonce] = useState(0);
  useEffect(() => onApprovalsChanged(() => setNonce((n) => n + 1)), []);
  useEffect(() => {
    const ctrl = new AbortController();
    countPendingApprovals(ctrl.signal).then(
      (n) => {
        if (!ctrl.signal.aborted) setCount(n);
      },
      () => {
        if (!ctrl.signal.aborted) setCount(0);
      },
    );
    return () => ctrl.abort();
  }, [pathname, nonce]);
  return count;
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
