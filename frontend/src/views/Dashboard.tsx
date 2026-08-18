import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import type { Country } from '../api/types';

interface City {
  id: number;
  name: string;
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState<number | null>(null);
  const [cityId, setCityId] = useState<number | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [optOut, setOptOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadCities = async (cId: number, preselectCityId?: number | null) => {
    const r = await api.get<{ cities: City[] }>(`/users/cities?country_id=${cId}`);
    setCities(r.cities);
    setCityId(preselectCityId ?? null);
  };

  // Initialize the form from the loaded user, then fetch that country's cities
  // so the saved city can be preselected.
  useEffect(() => {
    void api.get<{ countries: Country[] }>('/users/countries').then((r) => setCountries(r.countries));
    if (user) {
      setCountryId(user.country_id);
      setOptOut(user.opt_out_leaderboard);
      if (user.country_id) {
        void loadCities(user.country_id, user.city_id);
      } else {
        setCities([]);
        setCityId(null);
      }
    }
  }, [user]);

  const onCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value) || null;
    setCountryId(id);
    if (id) void loadCities(id);
    else {
      setCities([]);
      setCityId(null);
    }
  };

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
          <select value={countryId ?? ''} onChange={onCountryChange} style={{ width: '100%' }}>
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
