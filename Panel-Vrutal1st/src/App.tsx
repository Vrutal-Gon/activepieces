import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import { AppShell } from './components/AppShell';
import { MfaGate } from './components/MfaGate';
import { ClientList } from './pages/ClientList';
import { ClientPanel } from './pages/ClientPanel';
import { Dashboard } from './pages/Dashboard';
import { LoginForm } from './pages/LoginForm';
import { RoleList } from './pages/RoleList';
import { RolePanel } from './pages/RolePanel';
import { BlockLibrary } from './pages/BlockLibrary';
import { Compositions } from './pages/Compositions';
import { ProviderCatalog } from './pages/ProviderCatalog';
import { SetNewPasswordForm } from './pages/SetNewPasswordForm';
import { StaffTeam } from './pages/StaffTeam';
import { PendingPage } from './pages/PendingPage';
import { SystemCatalog } from './pages/SystemCatalog';
import { TaskComponentLinker, type TaskRoleContext } from './pages/TaskComponentLinker';
import type { TaskSummary } from './lib/types';
import './App.css';

// Secciones del diseño aprobado que aún no tienen fuente de datos.
const PENDING_SECTIONS = [
  {
    path: 'incidencias',
    eyebrow: 'Operación',
    title: 'Incidencias',
    source: 'Detectadas por el sistema a partir del latido de los VPS (VPS sin respuesta, pieces que fallan). Se podrán enlazar a tickets.',
  },
  {
    path: 'tickets',
    eyebrow: 'Operación',
    title: 'Tickets',
    source: 'Los tickets viven en client_ticket de cada cliente. Se agregarán aquí vía Edge Function.',
  },
  {
    path: 'flota',
    eyebrow: 'Operación',
    title: 'Flota VPS',
    source: 'Estado de cada VPS a partir de su latido (LAB08 cap. 13). El aprovisionamiento aún es manual.',
  },
  {
    path: 'aprobaciones',
    eyebrow: 'Operación',
    title: 'Aprobaciones bloqueadas',
    source: 'Aprobaciones de más de 24 h sin firmar, detectadas por el latido en la base de cada cliente.',
  },
  {
    path: 'tareas',
    eyebrow: 'Catálogo',
    title: 'Tareas',
    source: 'Biblioteca de tareas del catálogo (catalog.task). Pantalla pendiente de construir; los datos ya existen.',
  },
  {
    path: 'catalogo-kpis',
    eyebrow: 'Catálogo',
    title: 'KPIs y reportes',
    source: 'Definiciones de reportes y KPIs por rol (catalog.report_definition, kpi_definition). Pantalla pendiente; los datos ya existen.',
  },
  {
    path: 'auditoria',
    eyebrow: 'Administración',
    title: 'Auditoría',
    source: 'Registro de acciones del staff de Vrutal. Falta crear la tabla de auditoría en Vrutal1st.',
  },
];

interface ComponentsPreselection {
  task: TaskSummary;
  context: TaskRoleContext;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  // La tarea preseleccionada al saltar de un rol a Componentes vive en memoria, no en la URL.
  const [preselection, setPreselection] = useState<ComponentsPreselection | null>(null);
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

  if (loading) return <p className="center">Cargando…</p>;
  if (!session) return <LoginForm />;

  function openComponentsForTask(task: TaskSummary, context: TaskRoleContext) {
    setPreselection({ task, context });
    navigate('/componentes', { state: { fromRole: true } });
  }

  function signOut() {
    setPreselection(null);
    supabase.auth.signOut();
  }

  // Todo lo que requiere sesión pasa por la 2FA, incluida la recuperación de contraseña.
  let content;
  if (recoveryMode) {
    content = (
      <SetNewPasswordForm
        onDone={() => {
          setRecoveryMode(false);
          navigate('/', { replace: true }); // no dejar el enlace de recuperación en el historial
        }}
      />
    );
  } else if (location.pathname === '/bienvenida') {
    // Enlace de invitación: la persona entra con sesión pero aún sin contraseña.
    content = <SetNewPasswordForm onDone={() => navigate('/', { replace: true })} />;
  } else {
    content = (
      <Routes>
        <Route element={<AppShell email={session.user.email ?? ''} onSignOut={signOut} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="clientes" element={<ClientsRoute />} />
          <Route path="clientes/:tenantId/:tab?" element={<ClientDetailRoute />} />
          <Route path="roles" element={<RolesRoute />} />
          <Route path="roles/:roleKey" element={<RoleDetailRoute onOpenComponents={openComponentsForTask} />} />
          <Route path="componentes" element={<ComponentsRoute preselection={preselection} />} />
          <Route path="composiciones" element={<Compositions />} />
          <Route path="bloques" element={<BlockLibrary />} />
          <Route path="sistemas" element={<SystemsRoute />} />
          <Route path="proveedores" element={<ProviderCatalog />} />
          <Route path="equipo" element={<StaffTeam />} />
          {PENDING_SECTIONS.map((p) => (
            <Route key={p.path} path={p.path} element={<PendingPage eyebrow={p.eyebrow} title={p.title} source={p.source} />} />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <MfaGate session={session} onSignOut={signOut}>
      {content}
    </MfaGate>
  );
}

// Adaptadores entre la URL y las props de las páginas existentes.

function ClientsRoute() {
  const navigate = useNavigate();
  return <ClientList onSelectTenant={(id) => navigate(`/clientes/${encodeURIComponent(id)}`)} />;
}

function ClientDetailRoute() {
  const { tenantId = '', tab } = useParams();
  const navigate = useNavigate();
  return (
    <ClientPanel
      key={tenantId}
      tenantId={tenantId}
      tab={tab}
      onOpenRole={(key) => navigate(`/roles/${encodeURIComponent(key)}`)}
    />
  );
}

function RolesRoute() {
  const navigate = useNavigate();
  return <RoleList onSelectRole={(key) => navigate(`/roles/${encodeURIComponent(key)}`)} />;
}

interface RoleDetailRouteProps {
  onOpenComponents: (task: TaskSummary, context: TaskRoleContext) => void;
}

function RoleDetailRoute({ onOpenComponents }: RoleDetailRouteProps) {
  const { roleKey = '' } = useParams();
  const navigate = useNavigate();
  return <RolePanel initialKey={roleKey} onBack={() => navigate('/roles')} onOpenComponents={onOpenComponents} />;
}

interface ComponentsRouteProps {
  preselection: ComponentsPreselection | null;
}

function ComponentsRoute({ preselection }: ComponentsRouteProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const state: unknown = location.state;
  // Desde el menú lateral se entra sin preselección; solo desde un rol se conserva.
  const fromRole = typeof state === 'object' && state !== null && 'fromRole' in state && state.fromRole === true;
  const active = fromRole ? preselection : null;
  return (
    <TaskComponentLinker
      key={location.key}
      initialTask={active?.task ?? null}
      roleContext={active?.context ?? null}
      onBack={active ? () => navigate(-1) : undefined}
    />
  );
}

function SystemsRoute() {
  const navigate = useNavigate();
  return <SystemCatalog onOpenClient={(id) => navigate(`/clientes/${encodeURIComponent(id)}`)} />;
}

export default App;
