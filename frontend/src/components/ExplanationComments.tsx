import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ExplanationComment } from '../api/types';

interface ExplanationCommentsProps {
  explanationId: number;
  initialComments?: ExplanationComment[];
}

export function ExplanationComments({ explanationId, initialComments = [] }: ExplanationCommentsProps) {
  const [comments, setComments] = useState<ExplanationComment[]>(initialComments);
  const [expanded, setExpanded] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expanded && comments.length === 0) {
      loadComments();
    }
  }, [expanded]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const res = await api.explanations.getComments(explanationId);
      setComments(res.comments);
    } catch (e) {
      console.error('Failed to load comments:', e);
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      await api.explanations.addComment(explanationId, newComment.trim());
      setNewComment('');
      await loadComments();
    } catch (e) {
      console.error('Failed to post comment:', e);
    } finally {
      setLoading(false);
    }
  };

  const submitReply = async (parentId: number, text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      await api.explanations.addComment(explanationId, text.trim(), parentId);
      setReplyingTo(null);
      setReplyText('');
      await loadComments();
    } catch (e) {
      console.error('Failed to post reply:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderComments = (commentList: ExplanationComment[], depth = 0) => (
    <div style={{ marginLeft: depth * 24 }}>
      {commentList.map((comment) => (
        <div key={comment.id} style={{ marginBottom: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: depth === 0 ? '#fafafa' : '#fefefe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <strong style={{ fontSize: 13 }}>{comment.username}</strong>
            <span style={{ fontSize: 11, color: '#999' }}>
              {new Date(comment.created_at).toLocaleString()}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{comment.content}</p>
          {!comment.replies.length && (
            <button
              style={{ marginTop: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer', background: 'transparent', border: '1px solid #cbd5e0', borderRadius: 3 }}
              onClick={() => setReplyingTo(comment.id)}
            >
              Reply
            </button>
          )}
          {replyingTo === comment.id && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                style={{ flex: 1, padding: 6, fontSize: 13, border: '1px solid #cbd5e0', borderRadius: 4 }}
                placeholder="Write a reply..."
              />
              <button
                style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4 }}
                onClick={() => submitReply(comment.id, replyText)}
              >
                Reply
              </button>
            </div>
          )}
          {comment.replies.length > 0 && (
            <div style={{ marginTop: 8, borderLeft: '2px solid #e2e8f0', paddingLeft: 8 }}>
              {renderComments(comment.replies, depth + 1)}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  if (!expanded) {
    return (
      <button
        style={{ width: '100%', padding: '6px 12px', fontSize: 13, cursor: 'pointer', background: 'transparent', border: '1px solid #cbd5e0', borderRadius: 4, marginTop: 8 }}
        onClick={() => setExpanded(true)}
      >
        View {comments.length || '0'} comment{comments.length !== 1 ? 's' : ''}
      </button>
    );
  }

  return (
    <div>
      {loading ? (
        <p style={{ textAlign: 'center', padding: 16, color: '#666' }}>Loading comments…</p>
      ) : comments.length === 0 ? (
        <p style={{ textAlign: 'center', padding: 16, color: '#666' }}>No comments yet. Be the first!</p>
      ) : (
        renderComments(comments)
      )}
      <form onSubmit={submitComment} style={{ marginTop: 16 }}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: 8, marginBottom: 8, fontSize: 13, border: '1px solid #cbd5e0', borderRadius: 4 }}
          placeholder="Write a comment..."
        />
        <button
          type="submit"
          disabled={loading || !newComment.trim()}
          style={{ padding: '8px 16px', fontSize: 13, cursor: 'pointer', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4 }}
        >
          {loading ? 'Posting…' : 'Post Comment'}
        </button>
      </form>
    </div>
  );
}