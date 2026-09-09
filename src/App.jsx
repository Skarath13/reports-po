import React, { useCallback, useState } from 'react';
import useAuth from './hooks/useAuth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { WorkspaceLoading } from './components/LoadingState';
import './App.css';

function App() {
  const { user, loading, error, login, logout, isAuthenticated } = useAuth();
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
