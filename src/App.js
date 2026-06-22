import React from 'react';
import useAuth from './hooks/useAuth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const { user, loading, error, login, logout, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loader"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={login} error={error} />;
  }

  return <Dashboard user={user} onLogout={logout} />;
}

export default App;
