import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Indicator, LeaderboardEntry } from '../api/types';

export function Leaderboard() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [indicatorId, setIndicatorId] = useState<number | null>(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [country, setCountry] = useState('');
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void api.get<{ indicators: Indicator[] }>('/users/indicators').then((r) => {
      setIndicators(r.indicators);
      if (r.indicators.length) setIndicatorId(r.indicators[0].id);
    });
  }, []);

  const load = async () => {
    if (!indicatorId) return;
    setLoading(true); setErr(null);
    try {
      const qs = new URLSearchParams({ indicator_id: String(indicatorId), year: String(year), month: String(month), limit: '50' });
      if (country) qs.set('country', country.toUpperCase());
      const res = await api.get<{ leaderboard: LeaderboardEntry[] }>(`/leaderboards?${qs}`);
      setRows(res.leaderboard);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [indicatorId, year, month, country]);

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <h1>Leaderboard</h1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={indicatorId ?? ''} onChange={(e) => setIndicatorId(Number(e.target.value))}>
          {indicators.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 80 }} />
        <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ width: 60 }} />
        <input placeholder="Country (ISO, e.g. FR)" value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: 140 }} />
      </div>

      {loading ? <p>Loading…</p> : err ? <p style={{ color: 'crimson' }}>{err}</p> : (
        <table style={{ width: '100%', marginTop: 16 }}>
          <thead><tr><th>Rank</th><th>User</th><th>Country</th><th>City</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={4}>No data yet for this period.</td></tr> :
              rows.map((r) => (
                <tr key={r.user_id}>
                  <td>{r.rank}</td>
                  <td>{r.username}</td>
                  <td>{r.country_iso ?? '—'}</td>
                  <td>{r.city_name ?? '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
