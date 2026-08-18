import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Indicator, PollutionLog } from '../api/types';

export function LogPollution() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [logs, setLogs] = useState<PollutionLog[]>([]);
  const [indicatorId, setIndicatorId] = useState<number | null>(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const ind = await api.get<{ indicators: Indicator[] }>('/users/indicators');
    setIndicators(ind.indicators);
    const lg = await api.get<{ logs: PollutionLog[] }>(`/pollution?year=${year}&month=${month}`);
    setLogs(lg.logs);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [year, month]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!indicatorId) { setMsg('Pick an indicator.'); return; }
    setBusy(true); setMsg(null);
    try {
      await api.post('/pollution', { indicator_id: indicatorId, log_year: year, log_month: month, value: Number(value), note: note || undefined });
      setMsg('Logged.');
      setValue('');
      void load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Log failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto' }}>
      <h1>Log monthly pollution</h1>
      <form onSubmit={submit}>
        <label>Indicator
          <select value={indicatorId ?? ''} onChange={(e) => setIndicatorId(Number(e.target.value) || null)} style={{ width: '100%' }}>
            <option value="">— Select —</option>
            {indicators.map((i) => <option key={i.id} value={i.id}>{i.label} ({i.unit})</option>)}
          </select>
        </label>
        <label>Year<input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: '100%' }} /></label>
        <label>Month<input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ width: '100%' }} /></label>
        <label>Value<input type="number" step="0.001" value={value} onChange={(e) => setValue(e.target.value)} required style={{ width: '100%' }} /></label>
        <label>Note<input value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%' }} /></label>
        <button type="submit" disabled={busy} style={{ marginTop: 12 }}>{busy ? 'Saving…' : 'Submit log'}</button>
        {msg && <p>{msg}</p>}
      </form>

      <h2>Your logs for {year}-{String(month).padStart(2, '0')}</h2>
      {logs.length === 0 ? <p>No logs for this period.</p> : (
        <table style={{ width: '100%' }}>
          <thead><tr><th>Indicator</th><th>Value</th><th>Note</th></tr></thead>
          <tbody>
            {logs.map((l) => <tr key={l.id}><td>{l.label} ({l.unit})</td><td>{l.value}</td><td>{l.note ?? ''}</td></tr>)}
          </tbody>
        </table>
      )}
    </div>
  );
}
