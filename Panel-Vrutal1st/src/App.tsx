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
import { ProviderCatalog } from './pages/ProviderCatalog';
import { SetNewPasswordForm } from './pages/SetNewPasswordForm';
import { StaffTeam } from './pages/StaffTeam';
import { PendingPage } from './pages/PendingPage';
import { SystemCatalog } from './pages/SystemCatalog';
import { TaskList } from './pages/TaskList';
import { TaskPanel } from './pages/TaskPanel';
import { TaskNew } from './pages/TaskNew';
import { TicketsPage } from './pages/TicketsPage';
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
    path: 'catalogo-kpis',
    eyebrow: 'Referencias',
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

  if (loading) return <p className="center">Cargando…</p>;
  if (!session) return <LoginForm />;

  function signOut() {
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
          <Route path="roles" element={<RoleList />} />
          <Route path="roles/:roleKey/:tab?" element={<RoleDetailRoute />} />
          <Route
            path="tareas"
            element={<TaskList target="componentes" crumbs={[{ label: 'Construcción · paso 2' }]} title="Tareas" />}
          />
          <Route path="tareas/nueva" element={<TaskNew />} />
          <Route path="tareas/:taskId/:tab?" element={<TaskDetailRoute />} />
          <Route
            path="componentes"
            element={
              <TaskList
                target="componentes"
                crumbs={[{ label: 'Referencias' }]}
                title="Componentes"
                intro="Los componentes se enlazan en la ficha de cada tarea. Elige la tarea para ver o enlazar los suyos."
              />
            }
          />
          <Route
            path="composiciones"
            element={
              <TaskList
                target="composiciones"
                crumbs={[{ label: 'Construcción · paso 4' }]}
                title="Composiciones"
                intro="Cada composición realiza una tarea. Elige la tarea para ver o crear sus composiciones."
              />
            }
          />
          <Route path="bloques" element={<BlockLibrary />} />
          <Route path="sistemas" element={<SystemCatalog />} />
          <Route path="proveedores" element={<ProviderCatalog />} />
          <Route path="equipo" element={<StaffTeam />} />
          <Route path="tickets" element={<TicketsPage />} />
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

function RoleDetailRoute() {
  const { roleKey = '', tab } = useParams();
  return <RolePanel initialKey={roleKey} tab={tab} />;
}

function TaskDetailRoute() {
  const { taskId = '', tab } = useParams();
  return <TaskPanel key={taskId} taskId={taskId} tab={tab} />;
}

export default App;
