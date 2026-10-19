import React, { useCallback, useState } from 'react';
import useAuth from './hooks/useAuth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { WorkspaceLoading } from './components/LoadingState';
import './App.css';

function App() {
  const { user, loading, error, login, logout, isAuthenticated, restoreError, restoreSession } = useAuth();
  const [initialInterfaceMode, setInitialInterfaceMode] = useState(null);
  const loginWithInterface = useCallback(
    (pin, interfaceMode) => {
      setInitialInterfaceMode(interfaceMode);
      return login(pin);
    },
    [login],
  );

  if (loading) {
    return <WorkspaceLoading />;
  }

  if (restoreError) {
    return (
      <main className="reports-session-recovery" role="alert">
        <h1>Reports is temporarily unavailable</h1>
        <p>We couldn’t verify your session. Try again in a moment.</p>
        <div className="reports-session-recovery-actions">
          <button type="button" onClick={restoreSession}>Try again</button>
          <button type="button" onClick={logout}>Sign out</button>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={loginWithInterface} error={error} />;
  }

  return (
    <Dashboard
      user={user}
      onLogout={logout}
      initialInterfaceMode={initialInterfaceMode}
    />
  );
}

export default App;
