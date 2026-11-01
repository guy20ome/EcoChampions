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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    const ind = await api.get<{ indicators: Indicator[] }>('/users/indicators');
    setIndicators(ind.indicators);
    const lg = await api.get<{ logs: PollutionLog[] }>(`/pollution?year=${year}&month=${month}`);
    setLogs(lg.logs);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [year, month]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!indicatorId) {
      newErrors.indicator = 'Please select an indicator';
    }
    
    if (value === '') {
      newErrors.value = 'Value is required';
    } else {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        newErrors.value = 'Value must be a number';
      } else if (numValue < 0) {
        newErrors.value = 'Value cannot be negative';
      } else if (numValue > 999999) {
        newErrors.value = 'Value is too large';
      }
    }
    
    if (year < 2000 || year > 2100) {
      newErrors.year = 'Year must be between 2000 and 2100';
    }
    
    if (month < 1 || month > 12) {
      newErrors.month = 'Month must be between 1 and 12';
    }
    
    if (note && note.length > 255) {
      newErrors.note = 'Note must be 255 characters or less';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    if (!indicatorId) { setMsg('Pick an indicator.'); return; }
    setBusy(true); setMsg(null);
    try {
      await api.post('/pollution', { 
        indicator_id: indicatorId, 
        log_year: year, 
        log_month: month, 
        value: Number(value), 
        note: note || undefined 
      });
      setMsg('Logged.');
      setValue('');
      setNote('');
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
          <select 
            value={indicatorId ?? ''} 
            onChange={(e) => setIndicatorId(Number(e.target.value) || null)} 
            style={{ width: '100%' }}
          >
            <option value=""> Select </option>
            {indicators.map((i) => <option key={i.id} value={i.id}>{i.label} ({i.unit})</option>)}
          </select>
          {errors.indicator && <span style={{ color: 'crimson', fontSize: 12, display: 'block', marginTop: 4 }}>{errors.indicator}</span>}
        </label>
        <label>Year
          <input 
            type="number" 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))} 
            min={2000} 
            max={2100}
            style={{ width: '100%' }} 
          />
          {errors.year && <span style={{ color: 'crimson', fontSize: 12, display: 'block', marginTop: 4 }}>{errors.year}</span>}
        </label>
        <label>Month
          <input 
            type="number" 
            min={1} 
            max={12} 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))} 
            style={{ width: '100%' }} 
          />
          {errors.month && <span style={{ color: 'crimson', fontSize: 12, display: 'block', marginTop: 4 }}>{errors.month}</span>}
        </label>
        <label>Value
          <input 
            type="number" 
            step="0.001" 
            value={value} 
            onChange={(e) => setValue(e.target.value)} 
            required 
            min={0}
            style={{ width: '100%' }} 
          />
          {errors.value && <span style={{ color: 'crimson', fontSize: 12, display: 'block', marginTop: 4 }}>{errors.value}</span>}
        </label>
        <label>Note
          <input 
            value={note} 
            onChange={(e) => setNote(e.target.value)} 
            maxLength={255}
            style={{ width: '100%' }} 
          />
          {errors.note && <span style={{ color: 'crimson', fontSize: 12, display: 'block', marginTop: 4 }}>{errors.note}</span>}
        </label>
        <button type="submit" disabled={busy} style={{ marginTop: 12 }}>{busy ? 'Saving' : 'Submit log'}</button>
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
