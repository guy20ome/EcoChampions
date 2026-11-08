import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Dashboard() {
  const { user } = useAuth();
  return (
    <div style={{ maxWidth: 480, margin: '2rem auto' }}>
      <h1>Dashboard</h1>
      <p>Welcome back, <strong>{user?.username}</strong>!</p>
      <ul>
        <li><NavLink to="/log">Log pollution</NavLink></li>
        <li><NavLink to="/wall">Event wall & discussion</NavLink></li>
        <li><NavLink to="/leaderboard">Leaderboard</NavLink></li>
        <li><NavLink to="/settings">Settings</NavLink></li>
      </ul>
    </div>
  );
}
