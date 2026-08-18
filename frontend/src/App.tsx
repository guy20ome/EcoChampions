import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AuthPage } from './views/AuthPage';
import { Dashboard } from './views/Dashboard';
import { LogPollution } from './views/LogPollution';
import { Leaderboard } from './views/Leaderboard';

function Nav() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #eee' }}>
      <NavLink to="/dashboard">Dashboard</NavLink>
      <NavLink to="/log">Log pollution</NavLink>
      <NavLink to="/leaderboard">Leaderboard</NavLink>
      <button onClick={logout} style={{ marginLeft: 'auto' }}>Sign out</button>
    </nav>
  );
}

export function App() {
  const { user, ready } = useAuth();
  if (!ready) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <>
      <Nav />
      <Routes>
        {user ? (
          <>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/log" element={<LogPollution />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        ) : (
          <>
            <Route path="*" element={<AuthPage />} />
          </>
        )}
      </Routes>
    </>
  );
}
