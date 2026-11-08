import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EventExplanation, Indicator, PollutionLog } from '../api/types';
import { TrendChart } from '../components/TrendChart';

interface HistoryPeriod {
  year: number;
  month: number;
  logs: PollutionLog[];
}

export function Dashboard() {
  const { user } = useAuth();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [historyData, setHistoryData] = useState<HistoryPeriod[]>([]);
  const [explanations, setExplanations] = useState<EventExplanation[]>([]);
  const [loading, setLoading] = useState(true);

  // Load indicators and historical logs for trends chart (last 10 periods)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load indicators
        const indicatorsRes = await api.get<{ indicators: Indicator[] }>('/users/indicators');
        setIndicators(indicatorsRes.indicators);

        // Load historical logs (all periods, paginated - first page = latest 10)
        const historyRes = await api.get<{
          periods: HistoryPeriod[];
          page: number;
          limit: number;
          totalPages: number;
          totalPeriods: number;
        }>('/pollution/history?page=1&limit=10');
        setHistoryData(historyRes.periods);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Load community explanations for the wall preview
  useEffect(() => {
    const loadExplanations = async () => {
      try {
        const res = await api.explanations.get({});
        setExplanations(res.explanations);
      } catch (error) {
        console.error('Failed to load community explanations:', error);
      }
    };

    loadExplanations();
  }, []);

  // Calculate trend score from last 10 logged periods per indicator
  const getTrendScore = (indicator: Indicator) => {
    // Collect all logs for this indicator across all history periods
    const allIndicatorLogs: PollutionLog[] = [];
    for (const period of historyData) {
      const log = period.logs.find(l => l.indicator_id === indicator.id);
      if (log) {
        allIndicatorLogs.push({ ...log, log_year: period.year, log_month: period.month });
      }
    }

    // Sort by date newest first
    allIndicatorLogs.sort((a, b) => b.log_year * 12 + b.log_month - (a.log_year * 12 + a.log_month));

    // Take last 10 logs (or fewer if available)
    const recentLogs = allIndicatorLogs.slice(0, 10);

    if (recentLogs.length === 0) return null;

    // Normalize value to 0-100 scale based on typical ranges
    const ranges: Record<string, { min: number; max: number }> = {
      'co2_emissions': { min: 0, max: 1000 },
      'plastic_waste': { min: 0, max: 50 },
      'water_consumption': { min: 0, max: 300 },
      'waste_recycled_pct': { min: 0, max: 100 },
    };

    const range = ranges[indicator.code] || { min: 0, max: 100 };

    if (recentLogs.length === 1) {
      // Only one data point - show current normalized value
      const log = recentLogs[0];
      if (indicator.lower_is_better) {
        return Math.max(0, Math.min(100, ((range.max - log.value) / (range.max - range.min)) * 100));
      } else {
        return Math.max(0, Math.min(100, ((log.value - range.min) / (range.max - range.min)) * 100));
      }
    }

    // Multiple data points: calculate trend direction and current score
    const firstLog = recentLogs[recentLogs.length - 1]; // oldest
    const lastLog = recentLogs[0]; // newest

    const firstVal = firstLog.value;
    const lastVal = lastLog.value;

    // Calculate percentage change
    let pctChange = 0;
    if (indicator.lower_is_better) {
      // Lower is better - improvement = value decreased
      if (firstVal !== 0) {
        pctChange = ((firstVal - lastVal) / firstVal) * 100;
      }
    } else {
      // Higher is better - improvement = value increased
      if (firstVal !== 0) {
        pctChange = ((lastVal - firstVal) / firstVal) * 100;
      }
    }

    // Score based on trend quality and current value
    // Base score from current value
    const currentLog = recentLogs[0];
    let baseScore: number;
    if (indicator.lower_is_better) {
      baseScore = Math.max(0, Math.min(100, ((range.max - currentLog.value) / (range.max - range.min)) * 100));
    } else {
      baseScore = Math.max(0, Math.min(100, ((currentLog.value - range.min) / (range.max - range.min)) * 100));
    }

    // Adjust score based on trend direction
    // Positive trend (+5 to +15 points), negative trend (-5 to -15 points)
    const trendAdjustment = Math.max(-15, Math.min(15, pctChange * 3));

    // Clamp final score
    return Math.max(0, Math.min(100, baseScore + trendAdjustment));
  };

  // Get color for trend indicator
  const getTrendColor = (indicator: Indicator) => {
    const score = getTrendScore(indicator);
    if (score === null) return '#e2e8f0';
    if (score >= 80) return '#38a169';
    if (score >= 60) return '#48bb78';
    if (score >= 40) return '#ed8936';
    return '#e53e3e';
  };

  return (
    <div style={{ maxWidth: 1200, margin: '2rem auto' }}>
      <h1>Dashboard</h1>
      <p>Welcome back, <strong>{user?.username}</strong>!</p>

      {/* Quick Navigation */}
      <div style={{ marginTop: 24, marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Quick Actions</h2>
        <ul style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', listStyle: 'none', padding: 0 }}>
          <li>
            <NavLink
              to="/log"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                background: '#3182ce',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 4,
                fontWeight: 500
              }}
            >
              Log Pollution
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/wall"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                background: '#48bb78',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 4,
                fontWeight: 500
              }}
            >
              Event Wall
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/leaderboard"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                background: '#805ad5',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 4,
                fontWeight: 500
              }}
            >
              Leaderboard
            </NavLink>
          </li>
        </ul>
      </div>

      {/* Trends Chart and Community Wall - Two Column Layout */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          Loading dashboard data...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Left Column: User Trends Chart */}
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#2d3748' }}>Your Sustainability Trends</h2>
            <p style={{ margin: '0 0 20px', color: '#666', fontSize: 14 }}>
              Trends based on last 10 logged periods per indicator
            </p>

            {indicators.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#666', background: '#f7fafc', borderRadius: 4 }}>
                <p>No indicators configured yet.</p>
                <p style={{ marginTop: 8 }}>
                  <NavLink to="/log" style={{ color: '#3182ce', textDecoration: 'none' }}>Log some data</NavLink> to get started!
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {indicators.map((indicator) => {
                  const score = getTrendScore(indicator);

                  return (
                    <div
                      key={indicator.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: 16,
                        background: score === null ? '#f8f9fa' : '#fff',
                        opacity: score === null ? 0.6 : 1,
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 12
                      }}>
                        <div>
                          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>{indicator.label}</h3>
                          <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{indicator.unit}</p>
                        </div>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: getTrendColor(indicator),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: 14
                        }}>
                          {score === null ? '?' : Math.round(score)}
                        </div>
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <TrendChart
                          indicator={indicator}
                          logs={historyData.flatMap(period => period.logs.filter(log => log.indicator_id === indicator.id))}
                          width={340}
                          height={140}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary section */}
            <div style={{ marginTop: 24, padding: 16, background: '#f7fafc', borderRadius: 4 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>This Month's Summary</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#4a5568' }}>
                {historyData.length > 0 && historyData[0].logs.length === 4 ? (
                  <>
                    Great job! You've logged all <strong>4 indicators</strong> this month.
                    Your sustainability performance is contributing to your <strong>combined score</strong> and leaderboard ranking.
                  </>
                ) : (
                  <>
                    You've logged data for <strong>{historyData.length > 0 ? historyData[0].logs.length : 0}</strong> of the <strong>4 indicators</strong> recently.
                    {historyData.length > 0 && historyData[0].logs.length > 0 ? (
                      <>Log the remaining indicators to see your complete sustainability profile.</>
                    ) : (
                      <>Start logging your environmental impact data to track your progress.</>
                    )}
                  </>
                )}
              </p>
              <div style={{ marginTop: 12 }}>
                <NavLink
                  to="/log"
                  style={{
                    color: '#3182ce',
                    textDecoration: 'none',
                    fontWeight: 500,
                    fontSize: 14
                  }}
                >
                  Go to Log Pollution →
                </NavLink>
              </div>
            </div>
          </div>

          {/* Right Column: Community Wall Preview */}
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#2d3748' }}>Community Updates</h2>
              <NavLink
                to="/wall"
                style={{
                  color: '#3182ce',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                View full wall →
              </NavLink>
            </div>

            {/* Link to DashboardWall for the full community view */}
            <NavLink
              to="/wall"
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit'
              }}
            >
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 8,
                padding: 20,
                marginBottom: 16,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                (e.target as HTMLElement).style.transform = 'translateY(-2px)';
                (e.target as HTMLElement).style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
              }}
              onMouseOut={(e) => {
                (e.target as HTMLElement).style.transform = 'translateY(0)';
                (e.target as HTMLElement).style.boxShadow = 'none';
              }}
              >
                <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#0c4a6e' }}>📊 Event Wall</h3>
                <p style={{ margin: 0, color: '#0c4a6e', lineHeight: 1.6 }}>
                  See what other users are doing! Top performers share their <strong>explaining their sustainability achievements</strong> and <strong>discuss strategies</strong>.
                  {explanations.length > 0 && (
                    <>We've got <strong>{explanations.length} explanations</strong> from the community.</>
                  )}
                  {explanations.length === 0 && (
                    <>Be the first to <strong>share your story</strong>!</>
                  )}
                </p>

                {/* Quick preview of recent explanations */}
                {explanations.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: 14, color: '#0369a1' }}>Recent Community Stories:</h4>
                    {explanations.slice(0, 2).map((exp) => (
                      <div key={exp.explanation_id} style={{ marginBottom: 8, padding: 8, background: '#fff', borderRadius: 4, border: '1px solid #e0f2fe' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 9999,
                              background: getEventBadgeColor(exp.event_code),
                              color: '#fff',
                              textTransform: 'uppercase'
                            }}
                          >
                            {exp.event_code.replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>by {exp.username}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {new Date(exp.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.4 }}>
                          "{exp.content.substring(0, 80)}..."
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </NavLink>

            {/* Quick stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginTop: 20
            }}>
              <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 14, color: '#166534' }}>Community Engagement</h4>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#15803d' }}>
                  {explanations.length}
                  <span style={{ fontSize: 12, fontWeight: 400 }}>explanations</span>
                </p>
              </div>
              <div style={{ padding: 12, background: '#fef3c7', borderRadius: 6, border: '1px solid #fde68a' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 14, color: '#92400e' }}>Event Types</h4>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#d97706' }}>
                  {new Set(explanations.map(e => e.event_code)).size}
                  <span style={{ fontSize: 12, fontWeight: 400 }}>categories</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Event badge color helper
function getEventBadgeColor(code: string): string {
  switch (code) {
    case 'first_report':
      return '#38a169'; // green
    case 'significant_increase':
      return '#e53e3e'; // red
    case 'significant_decrease':
      return '#3182ce'; // blue
    case 'combined_improvement':
      return '#805ad5'; // purple
    case 'combined_decline':
      return '#dd6b20'; // orange
    default:
      return '#4a5568'; // gray
  }
}
