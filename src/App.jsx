import React from 'react';
import useAuth from './hooks/useAuth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { WorkspaceLoading } from './components/LoadingState';
import './App.css';

function App() {
  const { user, loading, error, login, logout, isAuthenticated } = useAuth();

  if (loading) {
    return <WorkspaceLoading />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={login} error={error} />;
  }

  return <Dashboard user={user} onLogout={logout} />;
}

export default App;
