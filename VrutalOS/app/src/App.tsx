import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import { getMyProfile } from './lib/api/profile';
import { useAsyncData } from './lib/hooks/useAsyncData';
import { PENDING_SECTIONS } from './lib/sections';
import type { Profile } from './lib/types';
import { AppShell } from './components/AppShell';
import { AccessPage } from './pages/AccessPage';
import { BoardPage } from './pages/BoardPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { UsagePage } from './pages/UsagePage';
import { ErrorNotice, LoadingState } from './components/StatusViews';
import { LoginForm } from './pages/LoginForm';
import { NegocioPage } from './pages/NegocioPage';
import { PendingPage } from './pages/PendingPage';
import { canEditScope } from './lib/nav';
import { SetNewPasswordForm } from './pages/SetNewPasswordForm';
import { SpecialistDetail } from './pages/SpecialistDetail';
import { SpecialistList } from './pages/SpecialistList';
import { SupportPage } from './pages/SupportPage';
import { TeamPage } from './pages/TeamPage';
import './styles/pages/auth.css';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <LoadingState />;
  if (!session) return <LoginForm />;

  function signOut() {
    supabase.auth.signOut();
  }

  if (recoveryMode) {
    return (
      <SetNewPasswordForm
        onDone={() => {
          setRecoveryMode(false);
          navigate('/', { replace: true }); // no dejar el enlace de recuperación en el historial
        }}
      />
    );
  }
  // Enlace de invitación: la persona entra con sesión pero aún sin contraseña.
  if (location.pathname === '/bienvenida') {
    return <SetNewPasswordForm onDone={() => navigate('/', { replace: true })} />;
  }

  return <SignedIn key={session.user.id} userId={session.user.id} email={session.user.email ?? ''} onSignOut={signOut} />;
}

interface SignedInProps {
  userId: string;
  email: string;
  onSignOut: () => void;
}

/** Carga el perfil (rol y estado) y decide qué layout se monta. */
function SignedIn({ userId, email, onSignOut }: SignedInProps) {
  const loadProfile = useCallback((signal: AbortSignal) => getMyProfile(userId, signal), [userId]);
  const { state, reload } = useAsyncData(loadProfile);

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') {
    return (
      <AuthMessage onSignOut={onSignOut}>
        <ErrorNotice error={state.error} onRetry={reload} />
      </AuthMessage>
    );
  }
  const profile = state.data;
  if (profile === null) {
    return (
      <AuthMessage title="Sin acceso" onSignOut={onSignOut}>
        {email} no tiene acceso a esta empresa. Pide acceso a tu administrador.
      </AuthMessage>
    );
  }
  if (!profile.is_active) {
    return (
      <AuthMessage title="Cuenta desactivada" onSignOut={onSignOut}>
        Tu cuenta está desactivada. Habla con el administrador de tu empresa.
      </AuthMessage>
    );
  }

  return <Layouts profile={profile} email={email} onSignOut={onSignOut} />;
}

interface LayoutsProps {
  profile: Profile;
  email: string;
  onSignOut: () => void;
}

function Layouts({ profile, email, onSignOut }: LayoutsProps) {
  const isAdmin = profile.role === 'client_admin';
  // Solo UX: cada tabla se protege con RLS en el servidor.
  const sections = PENDING_SECTIONS.filter((s) => isAdmin || !s.adminOnly);

  return (
    <Routes>
      <Route element={<AppShell profile={profile} email={email} onSignOut={onSignOut} />}>
        {sections.map((s) => (
          <Route
            key={s.path}
            index={s.path === ''}
            path={s.path === '' ? undefined : s.path}
            element={<PendingPage eyebrow={s.eyebrow} title={s.title} source={s.source} />}
          />
        ))}
        {/* Solo UX: las rutas de Administración no existen para un usuario; el servidor decide con RLS. */}
        {isAdmin && <Route path="admin/equipo" element={<TeamPage profile={profile} />} />}
        {isAdmin && <Route path="admin/accesos" element={<AccessPage profile={profile} />} />}
        {isAdmin && <Route path="admin/integraciones" element={<IntegrationsPage />} />}
        {isAdmin && <Route path="admin/consumo" element={<UsagePage />} />}
        {isAdmin && <Route path="soporte" element={<SupportPage />} />}
        {canEditScope(profile.role) && <Route path="negocio" element={<NegocioPage profile={profile} />} />}
        <Route path="tablero" element={<BoardPage profile={profile} />} />
        <Route path="aprobaciones" element={<ApprovalsPage profile={profile} />} />
        <Route path="especialistas" element={<SpecialistList profile={profile} />} />
        <Route path="especialistas/:id" element={<SpecialistDetail profile={profile} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

interface AuthMessageProps {
  title?: string;
  children: React.ReactNode;
  onSignOut: () => void;
}

function AuthMessage({ title, children, onSignOut }: AuthMessageProps) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img className="auth-card__logo" src="/vrutal-lockup-dark.svg" alt="Vrutal Labs" />
        {title && <h1 className="auth-card__title">{title}</h1>}
        {title ? <p className="auth-card__subtitle">{children}</p> : children}
        <button type="button" className="btn btn--ghost btn--block" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export default App;
