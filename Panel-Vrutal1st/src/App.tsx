import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import { ClientList } from './pages/ClientList';
import { ClientPanel } from './pages/ClientPanel';
import { LoginForm } from './pages/LoginForm';
import { RoleList } from './pages/RoleList';
import { RolePanel } from './pages/RolePanel';
import { ProviderCatalog } from './pages/ProviderCatalog';
import { SetNewPasswordForm } from './pages/SetNewPasswordForm';
import { SystemCatalog } from './pages/SystemCatalog';
import { TaskComponentLinker, type TaskRoleContext } from './pages/TaskComponentLinker';
import type { TaskSummary } from './lib/types';
import './App.css';

type View =
  | 'roles-list'
  | 'role-detail'
  | 'components'
  | 'clients-list'
  | 'client-detail'
  | 'systems'
  | 'providers';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [view, setView] = useState<View>('roles-list');
  const [selectedRoleKey, setSelectedRoleKey] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [preselectTask, setPreselectTask] = useState<TaskSummary | null>(null);
  const [roleContext, setRoleContext] = useState<TaskRoleContext | null>(null);

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
  if (recoveryMode) return <SetNewPasswordForm onDone={() => setRecoveryMode(false)} />;
  if (!session) return <LoginForm />;

  function openRole(key: string) {
    setSelectedRoleKey(key);
    setView('role-detail');
  }

  function openComponentsForTask(task: TaskSummary, context: TaskRoleContext) {
    setPreselectTask(task);
    setRoleContext(context);
    setView('components');
  }

  function openTenant(id: string) {
    setSelectedTenantId(id);
    setView('client-detail');
  }

  function goToRolesList() {
    setView('roles-list');
  }

  function goToComponentsTab() {
    setRoleContext(null);
    setPreselectTask(null);
    setView('components');
  }

  function goToClientsList() {
    setView('clients-list');
  }

  const rolesTabActive = view === 'roles-list' || view === 'role-detail';
  const clientsTabActive = view === 'clients-list' || view === 'client-detail';

  return (
    <div className="app">
      <header className="topbar">
        <h1>Vrutal1st · Catálogo</h1>
        <nav>
          <button className={rolesTabActive ? 'active' : ''} onClick={goToRolesList}>
            Roles
          </button>
          <button className={view === 'components' ? 'active' : ''} onClick={goToComponentsTab}>
            Componentes
          </button>
          <button className={clientsTabActive ? 'active' : ''} onClick={goToClientsList}>
            Clientes
          </button>
          <button className={view === 'systems' ? 'active' : ''} onClick={() => setView('systems')}>
            Sistemas
          </button>
          <button className={view === 'providers' ? 'active' : ''} onClick={() => setView('providers')}>
            Proveedores
          </button>
        </nav>
        <button className="signout" onClick={() => supabase.auth.signOut()}>
          Salir ({session.user.email})
        </button>
      </header>
      <main>
        {view === 'roles-list' && <RoleList onSelectRole={openRole} />}
        {view === 'role-detail' && (
          <RolePanel
            initialKey={selectedRoleKey}
            onBack={goToRolesList}
            onOpenComponents={openComponentsForTask}
          />
        )}
        {view === 'components' && (
          <TaskComponentLinker
            initialTask={preselectTask}
            roleContext={roleContext}
            onBack={roleContext ? () => setView('role-detail') : undefined}
          />
        )}
        {view === 'clients-list' && <ClientList onSelectTenant={openTenant} />}
        {view === 'client-detail' && (
          <ClientPanel tenantId={selectedTenantId} onBack={goToClientsList} onOpenRole={openRole} />
        )}
        {view === 'systems' && <SystemCatalog onOpenClient={openTenant} />}
        {view === 'providers' && <ProviderCatalog />}
      </main>
    </div>
  );
}

export default App;
