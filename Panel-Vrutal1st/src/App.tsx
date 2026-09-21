import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import { LoginForm } from './pages/LoginForm';
import { RoleList } from './pages/RoleList';
import { RolePanel } from './pages/RolePanel';
import { SetNewPasswordForm } from './pages/SetNewPasswordForm';
import { TaskComponentLinker, type TaskRoleContext } from './pages/TaskComponentLinker';
import type { TaskSummary } from './lib/types';
import './App.css';

type View = 'roles-list' | 'role-detail' | 'components';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [view, setView] = useState<View>('roles-list');
  const [selectedRoleKey, setSelectedRoleKey] = useState('');
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

  function goToRolesList() {
    setView('roles-list');
  }

  function goToComponentsTab() {
    setRoleContext(null);
    setPreselectTask(null);
    setView('components');
  }

  const rolesTabActive = view === 'roles-list' || view === 'role-detail';

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
      </main>
    </div>
  );
}

export default App;
