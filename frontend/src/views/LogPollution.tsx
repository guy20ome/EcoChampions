import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Indicator, PollutionLog } from '../api/types';

type Mode = 'single' | 'grid';

interface GridEntry {
  indicator_id: number;
  value: string;
  note: string;
}

export function LogPollution() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [logs, setLogs] = useState<PollutionLog[]>([]);
  const [mode, setMode] = useState<Mode>('single');
  
  // Single mode state
  const [indicatorId, setIndicatorId] = useState<number | null>(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  
  // Grid mode state
  const [gridYear, setGridYear] = useState(now.getFullYear());
  const [gridMonth, setGridMonth] = useState(now.getMonth() + 1);
  const [gridEntries, setGridEntries] = useState<Record<number, GridEntry>>({});
  const [existingLogs, setExistingLogs] = useState<Record<number, PollutionLog>>({});

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Paginated history state (10 per page)
  const [historyPage, setHistoryPage] = useState(1);
  const [historyData, setHistoryData] = useState<{
    periods: Array<{ year: number; month: number; logs: PollutionLog[] }>;
    page: number;
    limit: number;
    totalPages: number;
    totalPeriods: number;
  } | null>(null);

  const loadHistory = async () => {
    const res = await api.get<{
      periods: Array<{ year: number; month: number; logs: PollutionLog[] }>;
      page: number;
      limit: number;
      totalPages: number;
      totalPeriods: number;
    }>(`/pollution/history?page=${historyPage}&limit=10`);
    setHistoryData(res);
  };

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPage]);

  const load = async () => {
    const ind = await api.get<{ indicators: Indicator[] }>('/users/indicators');
    setIndicators(ind.indicators);
    
    // Initialize grid entries from indicators
    const initialEntries: Record<number, GridEntry> = {};
    ind.indicators.forEach((i) => {
      initialEntries[i.id] = { indicator_id: i.id, value: '', note: '' };
    });
    setGridEntries(initialEntries);
  };

  const loadLogs = async (y: number, m: number) => {
    const lg = await api.get<{ logs: PollutionLog[] }>(`/pollution?year=${y}&month=${m}`);
    setLogs(lg.logs);
    
    // Update grid entries with existing logs
    const logsMap: Record<number, PollutionLog> = {};
    lg.logs.forEach((log) => {
      logsMap[log.indicator_id] = log;
    });
    setExistingLogs(logsMap);
    
    // Pre-fill grid entries with existing values
    setGridEntries((prev) => {
      const newEntries = { ...prev };
      lg.logs.forEach((log) => {
        if (newEntries[log.indicator_id]) {
          newEntries[log.indicator_id] = {
            indicator_id: log.indicator_id,
            value: String(log.value),
            note: log.note ?? '',
          };
        }
      });
      return newEntries;
    });
  };

  useEffect(() => { 
    void load(); 
    void loadLogs(year, month); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === 'single') {
      void loadLogs(year, month);
    } else {
      void loadLogs(gridYear, gridMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, gridYear, gridMonth, mode]);

  const validateSingle = (): boolean => {
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

  const validateGrid = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (gridYear < 2000 || gridYear > 2100) {
      newErrors.year = 'Year must be between 2000 and 2100';
    }
    
    if (gridMonth < 1 || gridMonth > 12) {
      newErrors.month = 'Month must be between 1 and 12';
    }
    
    // Check each entry
    let hasValidEntry = false;
    for (const [indicatorIdStr, entry] of Object.entries(gridEntries)) {
      if (entry.value !== '') {
        hasValidEntry = true;
        const numValue = Number(entry.value);
        if (isNaN(numValue)) {
          newErrors[`value_${entry.indicator_id}`] = 'Value must be a number';
        } else if (numValue < 0) {
          newErrors[`value_${entry.indicator_id}`] = 'Value cannot be negative';
        } else if (numValue > 999999) {
          newErrors[`value_${entry.indicator_id}`] = 'Value is too large';
        }
      }
      
      if (entry.note && entry.note.length > 255) {
        newErrors[`note_${entry.indicator_id}`] = 'Note must be 255 characters or less';
      }
    }
    
    if (!hasValidEntry) {
      newErrors.grid = 'At least one value is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSingle()) return;
    
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
      void loadLogs(year, month);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Log failed');
    } finally {
      setBusy(false);
    }
  };

  const submitGrid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateGrid()) return;
    
    setBusy(true); setMsg(null);
    try {
      // Filter entries with values
      const entriesToSubmit = Object.values(gridEntries).filter((e) => e.value !== '');
      
      if (entriesToSubmit.length === 0) {
        setMsg('No values to submit.');
        return;
      }
      
      await api.post('/pollution/bulk', { 
        log_year: gridYear, 
        log_month: gridMonth, 
        entries: entriesToSubmit.map((e) => ({
          indicator_id: e.indicator_id,
          value: Number(e.value),
          note: e.note || undefined,
        }))
      });
      setMsg(`${entriesToSubmit.length} log(s) saved.`);
      void loadLogs(gridYear, gridMonth);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Bulk log failed');
    } finally {
      setBusy(false);
    }
  };

  const handleGridValueChange = (indicatorId: number, field: 'value' | 'note', val: string) => {
    setGridEntries((prev) => ({
      ...prev,
      [indicatorId]: {
        ...prev[indicatorId],
        [field]: val,
      },
    }));
  };

  const handleYearMonthChange = (y: number, m: number) => {
    if (mode === 'single') {
      setYear(y);
      setMonth(m);
    } else {
      setGridYear(y);
      setGridMonth(m);
    }
  };

  const clearGrid = () => {
    setGridEntries((prev) => {
      const cleared = { ...prev };
      for (const key in cleared) {
        cleared[Number(key)] = { ...cleared[Number(key)], value: '', note: '' };
      }
      return cleared;
    });
  };

  // Single mode form
  const renderSingleMode = () => (
    <form onSubmit={submitSingle}>
      <label>Indicator
        <select 
          value={indicatorId ?? ''} 
          onChange={(e) => setIndicatorId(Number(e.target.value) || null)} 
          style={{ width: '100%' }}
        >
          <option value="">Select indicator</option>
          {indicators.map((i) => <option key={i.id} value={i.id}>{i.label} ({i.unit})</option>)}
        </select>
        {errors.indicator && <span style={{ color: 'crimson', fontSize: 12, display: 'block', marginTop: 4 }}>{errors.indicator}</span>}
      </label>
      <label>Year
        <input 
          type="number" 
          value={year} 
          onChange={(e) => handleYearMonthChange(Number(e.target.value), month)} 
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
          onChange={(e) => handleYearMonthChange(year, Number(e.target.value))} 
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
      <button type="submit" disabled={busy} style={{ marginTop: 12 }}>{busy ? 'Saving...' : 'Submit log'}</button>
      {msg && <p>{msg}</p>}
    </form>
  );

  // Grid mode form
  const renderGridMode = () => (
    <form onSubmit={submitGrid}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <label>Year
          <input 
            type="number" 
            value={gridYear} 
            onChange={(e) => handleYearMonthChange(Number(e.target.value), gridMonth)} 
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
            value={gridMonth} 
            onChange={(e) => handleYearMonthChange(gridYear, Number(e.target.value))} 
            style={{ width: '100%' }} 
          />
          {errors.month && <span style={{ color: 'crimson', fontSize: 12, display: 'block', marginTop: 4 }}>{errors.month}</span>}
        </label>
      </div>
      
      <table style={{ width: '100%', marginBottom: '1rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Indicator</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Value</th>
            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Note</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map((indicator) => {
            const entry = gridEntries[indicator.id];
            const hasExistingLog = existingLogs[indicator.id];
            return (
              <tr key={indicator.id} style={{ backgroundColor: hasExistingLog ? '#f0f8ff' : 'transparent' }}>
                <td style={{ padding: '0.5rem' }}>
                  <strong>{indicator.label}</strong>
                  <div style={{ fontSize: 12, color: '#666' }}>{indicator.unit}</div>
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input
                    type="number"
                    step="0.001"
                    value={entry?.value ?? ''}
                    onChange={(e) => handleGridValueChange(indicator.id, 'value', e.target.value)}
                    min={0}
                    style={{ width: '100%', padding: '0.25rem' }}
                    placeholder="Enter value"
                  />
                  {errors[`value_${indicator.id}`] && (
                    <span style={{ color: 'crimson', fontSize: 12, display: 'block', marginTop: 4 }}>
                      {errors[`value_${indicator.id}`]}
                    </span>
                  )}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input
                    value={entry?.note ?? ''}
                    onChange={(e) => handleGridValueChange(indicator.id, 'note', e.target.value)}
                    maxLength={255}
                    style={{ width: '100%', padding: '0.25rem' }}
                    placeholder="Optional note"
                  />
                  {errors[`note_${indicator.id}`] && (
                    <span style={{ color: 'crimson', fontSize: 12, display: 'block', marginTop: 4 }}>
                      {errors[`note_${indicator.id}`]}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <button 
          type="button" 
          onClick={clearGrid}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#f0f0f0', border: '1px solid #ccc', cursor: 'pointer' }}
        >
          Clear All
        </button>
        <button type="submit" disabled={busy} style={{ padding: '0.5rem 1rem' }}>
          {busy ? 'Saving...' : `Save All (${Object.values(gridEntries).filter((e) => e.value !== '').length} entries)`}
        </button>
      </div>
      {errors.grid && <p style={{ color: 'crimson', marginTop: '0.5rem' }}>{errors.grid}</p>}
      {msg && <p>{msg}</p>}
    </form>
  );

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto' }}>
      <h1>Log monthly pollution</h1>
      
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ marginRight: '1rem' }}>
          <input
            type="radio"
            checked={mode === 'single'}
            onChange={() => setMode('single')}
          />
          Single Mode
        </label>
        <label>
          <input
            type="radio"
            checked={mode === 'grid'}
            onChange={() => setMode('grid')}
          />
          Grid Mode
        </label>
      </div>

      {mode === 'single' ? renderSingleMode() : renderGridMode()}

      <h2>Your logs for {mode === 'single' ? year : gridYear}-{String(mode === 'single' ? month : gridMonth).padStart(2, '0')}</h2>

      {/* Paginated history (10 per page) */}
      <div style={{ marginTop: 24, overflowX: 'auto' }}>
        <h3>Historical Summary (by year/month)</h3>
        {historyData && historyData.periods.length === 0 ? (
          <p style={{ color: '#666' }}>No historical data yet.</p>
        ) : historyData ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ddd', padding: 6, textAlign: 'left' }}>Year</th>
                <th style={{ border: '1px solid #ddd', padding: 6, textAlign: 'left' }}>Month</th>
                {indicators.map((i) => (
                  <th key={i.id} style={{ border: '1px solid #ddd', padding: 6, textAlign: 'left' }}>
                    {i.label}
                    <div style={{ fontSize: 10, color: '#666', fontWeight: 'normal' }}>{i.unit}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historyData.periods.map((period) => (
                <tr key={`${period.year}-${period.month}`}>
                  <td style={{ border: '1px solid #ddd', padding: 6, fontWeight: 600 }}>{period.year}</td>
                  <td style={{ border: '1px solid #ddd', padding: 6 }}>{String(period.month).padStart(2, '0')}</td>
                  {indicators.map((i) => {
                    const log = period.logs.find((l) => l.indicator_id === i.id);
                    return (
                      <td key={i.id} style={{ border: '1px solid #ddd', padding: 6, verticalAlign: 'top' }}>
                        {log ? (
                          <div>
                            <div><strong>{log.value}</strong></div>
                            {log.note && <div style={{ fontSize: 11, color: '#666' }}>{log.note}</div>}
                          </div>
                        ) : (
                          <span style={{ color: '#bbb' }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#666' }}>Loading history…</p>
        )}

        {/* Pagination controls */}
        {historyData && historyData.totalPeriods > 10 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
            <button
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              disabled={historyPage <= 1}
              style={{ padding: '6px 12px', cursor: 'pointer', opacity: historyPage <= 1 ? 0.5 : 1 }}
            >
              ← Previous
            </button>
            <span style={{ fontSize: 13, color: '#666' }}>
              Page {historyPage} of {historyData.totalPages} ({historyData.totalPeriods} periods)
            </span>
            <button
              onClick={() => setHistoryPage((p) => Math.min(historyData.totalPages, p + 1))}
              disabled={historyPage >= historyData.totalPages}
              style={{ padding: '6px 12px', cursor: 'pointer', opacity: historyPage >= historyData.totalPages ? 0.5 : 1 }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Current period logs */}
      {logs.length === 0 ? <p>No logs for this period.</p> : (
        <table style={{ width: '100%', marginTop: 16 }}>
          <thead><tr><th>Indicator</th><th>Value</th><th>Note</th></tr></thead>
          <tbody>
            {logs.map((l) => <tr key={l.id}><td>{l.label} ({l.unit})</td><td>{l.value}</td><td>{l.note ?? ''}</td></tr>)}
          </tbody>
        </table>
      )}
    </div>
  );
}
