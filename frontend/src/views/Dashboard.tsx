import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import type { Country } from '../api/types';

export function Dashboard() {
  const { user, logout } = useAuth();
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState<number | null>(user?.country_iso ? null : null);
  const [cityId, setCityId] = useState<number | null>(null);
  const [cities, setCities] = useState<{ id: number; name: string }[]>([]);
  const [optOut, setOptOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void api.get<{ countries: Country[] }>('/users/countries').then((r) => setCountries(r.countries));
  }, []);

  // City id is unknown here without a cities table join in /auth/me; user selects city each save (Phase 1 simplicity).
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.patch('/users/me', { country_id: countryId, city_id: cityId, opt_out_leaderboard: optOut });
      setMsg('Profile saved.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard</h1>
        <button onClick={logout}>Sign out</button>
      </header>
      <p>Signed in as <strong>{user?.username}</strong> ({user?.email})</p>

      <h2>Profile</h2>
      <form onSubmit={save}>
        <label>Country
          <select value={countryId ?? ''} onChange={(e) => {
            const id = Number(e.target.value) || null;
            setCountryId(id);
            setCityId(null);
            if (id) void api.get<{ cities: { id: number; name: string }[] }>(`/users/cities?country_id=${id}`).then((r) => setCities(r.cities));
            else setCities([]);
          }} style={{ width: '100%' }}>
            <option value="">— Select —</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>City
          <select value={cityId ?? ''} onChange={(e) => setCityId(Number(e.target.value) || null)} disabled={!cities.length} style={{ width: '100%' }}>
            <option value="">— Select —</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'block', marginTop: 12 }}>
          <input type="checkbox" checked={optOut} onChange={(e) => setOptOut(e.target.checked)} /> Opt out of leaderboards
        </label>
        <button type="submit" disabled={saving} style={{ marginTop: 12 }}>{saving ? 'Saving…' : 'Save profile'}</button>
        {msg && <p>{msg}</p>}
      </form>
    </div>
  );
}
