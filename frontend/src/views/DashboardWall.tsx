import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { EventExplanation, PendingExplanation, ExplanationEvent } from '../api/types';
import { ExplanationComments } from '../components/ExplanationComments';

export function DashboardWall() {
  const { user } = useAuth();
  const [explanations, setExplanations] = useState<EventExplanation[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingExplanation>({
    pending: false,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    has_logs: false,
    has_explanation: false,
  });
  const [eventTypes, setEventTypes] = useState<ExplanationEvent[]>([]);
  const [newExplanationContent, setNewExplanationContent] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<number | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<number | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState(false);
  const [expandedExplanationId, setExpandedExplanationId] = useState<number | null>(null);

  const loadExplanations = async () => {
    setLoading(true);
    try {
      const res = await api.explanations.get({});
      setExplanations(res.explanations);
    } catch (e) {
      console.error('Failed to load explanations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExplanations();
  }, []);

  // Load event types
  useEffect(() => {
    void api.explanations.getTypes().then((res) => setEventTypes(res.event_types));
  }, []);

  // Load pending explanation status for current user
  useEffect(() => {
    if (user) {
      void api.explanations
        .hasPending({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })
        .then(setPending);
    }
  }, [user]);

  const handlePostExplanation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExplanationContent.trim() || !user) return;
    if (!selectedEventType) {
      setPostError('Please select an event type');
      return;
    }
    setPosting(true);
    setPostError(null);
    try {
      await api.postExplanation(
        newExplanationContent.trim(),
        selectedEventType,
        selectedIndicator || undefined,
        new Date().getFullYear(),
        new Date().getMonth() + 1,
      );
      setPostSuccess(true);
      setNewExplanationContent('');
      setSelectedEventType(null);
      setSelectedIndicator(null);
      void loadExplanations();
    } catch (e) {
      setPostError(e instanceof Error ? e.message : 'Failed to post explanation');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto' }}>
      <h1>Dashboard Wall</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Community explanations and discussions about sustainability events.
      </p>

      {/* Current Period Status */}
      {user && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 8px' }}>Current Period: {pending.year}-{String(pending.month).padStart(2, '0')}</h3>
          {pending.has_logs ? (
            pending.pending ? (
              <p style={{ margin: 0, color: '#0c4a6e' }}>
                <strong>You have a pending explanation.</strong> You submitted data this month but haven't shared your
                experience yet. Help others learn from your journey!
              </p>
            ) : (
              <p style={{ margin: 0, color: '#0c4a6e' }}>You're up to date for this period. 🎉</p>
            )
          ) : (
            <p style={{ margin: 0, color: '#0c4a6e' }}>
              No data logged yet for this period. <a href="/log" style={{ color: '#0369a1' }}>Log pollution</a> to get
              started.
            </p>
          )}
        </div>
      )}

      {/* Explanations Feed */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 16 }}>Recent Explanations</h2>
        {loading ? (
          <p style={{ textAlign: 'center', padding: 32, color: '#666' }}>Loading explanations…</p>
        ) : explanations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#666' }}>
            <p>No explanations posted yet.</p>
            {user && (
              <p>Be the first to <strong>post your explanation</strong> below after logging your data!</p>
            )}
          </div>
        ) : (
          <div>
            {explanations.map((exp) => {
              const isExpanded = expandedExplanationId === exp.explanation_id;
              return (
                <div
                  key={exp.explanation_id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                    background: '#fff',
                    transition: 'box-shadow 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 9999,
                            background: getEventBadgeColor(exp.event_code),
                            color: '#fff',
                            textTransform: 'uppercase',
                          }}
                        >
                          {exp.event_code.replace('_', ' ')}
                        </span>
                        <span style={{ fontSize: 13, color: '#666' }}>
                          {exp.log_year}-{String(exp.log_month).padStart(2, '0')}
                        </span>
                      </div>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                        {exp.event_label} by <strong>{exp.username}</strong>
                      </h4>
                      {exp.indicator_label && (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#3182ce' }}>
                          Indicator: {exp.indicator_label} ({exp.indicator_unit})
                        </p>
                      )}
                      {exp.country_iso && (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
                          📍 {exp.country_iso}{exp.city_name ? `, ${exp.city_name}` : ''}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 100 }}>
                      <span style={{ fontSize: 11, color: '#999' }}>
                        {new Date(exp.created_at).toLocaleDateString()}
                      </span>
                      {exp.comment_count > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <span
                            style={{ fontSize: 12, color: '#3182ce', cursor: 'pointer' }}
                            onClick={() =>
                              setExpandedExplanationId(
                                isExpanded ? null : exp.explanation_id,
                              )
                            }
                          >
                            ▼ {exp.comment_count} comment{exp.comment_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {exp.content || '<em style="color:#999">No explanation provided yet.</em>'}
                  </div>

                  {isExpanded && exp.comment_count > 0 && (
                    <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                      <ExplanationComments explanationId={exp.explanation_id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Post New Explanation */}
      {user && (
        <section style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
          <h2>Post Your Explanation</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Share what happened this month. Was it a change in habits, a new product, seasonal variation?
          </p>
          <form onSubmit={handlePostExplanation}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Event Type</label>
              <select
                value={selectedEventType ?? ''}
                onChange={(e) => setSelectedEventType(Number(e.target.value) || null)}
                style={{ width: '100%', padding: 8, border: '1px solid #cbd5e0', borderRadius: 4 }}
                required
              >
                <option value="">Select event type</option>
                {eventTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} — {t.description}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Explanation</label>
              <textarea
                value={newExplanationContent}
                onChange={(e) => setNewExplanationContent(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Describe what happened... what changed? what did you learn? tips for others?"
                style={{
                  width: '100%',
                  padding: 8,
                  border: '1px solid #cbd5e0',
                  borderRadius: 4,
                  fontSize: 14,
                  fontFamily: 'inherit',
                }}
                required
              />
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
                {newExplanationContent.length}/2000 characters
              </p>
            </div>

            {postError && <p style={{ color: 'crimson', marginBottom: 8 }}>{postError}</p>}
            {postSuccess && (
              <p style={{ color: 'green', marginBottom: 8 }}>Explanation posted! It will appear in the feed above.</p>
            )}

            <button
              type="submit"
              disabled={posting || !newExplanationContent.trim() || !selectedEventType}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                background: '#3182ce',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                opacity: posting || !newExplanationContent.trim() || !selectedEventType ? 0.6 : 1,
              }}
            >
              {posting ? 'Posting…' : 'Post Explanation'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

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