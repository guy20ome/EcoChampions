import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto' }}>
      <h1>Ecology Champions</h1>
      <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
      <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%' }} /></label>
        {mode === 'register' && (
          <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} required style={{ width: '100%' }} /></label>
        )}
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'register' ? 8 : 1} style={{ width: '100%' }} /></label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ marginTop: 12 }}>{busy ? '…' : 'Submit'}</button>
      </form>
      <p>
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer' }}>
          {mode === 'login' ? 'Register' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}
