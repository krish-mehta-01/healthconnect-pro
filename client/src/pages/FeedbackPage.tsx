import { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchFeedback, fetchTriageAlerts } from '../store/feedbackSlice';
import { fetchFacilities } from '../store/facilitiesSlice';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  MessageSquare, AlertTriangle, Plus, X,
  ThumbsUp, ThumbsDown, Minus, Brain
} from 'lucide-react';
import { submitFeedback, getPatients } from '../services/api';
import type { Patient } from '../types';

export default function FeedbackPage() {
  const dispatch = useAppDispatch();
  const { items, triageAlerts, loading } = useAppSelector(s => s.feedback);
  const { items: facilities } = useAppSelector(s => s.facilities);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'feedback' | 'triage'>('feedback');
  const [form, setForm] = useState({ Facility_ID: '', Patient_ID: '', Feedback_Text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [lastSentiment, setLastSentiment] = useState<{ score: string; flag: string } | null>(null);

  useEffect(() => {
    dispatch(fetchFeedback());
    dispatch(fetchTriageAlerts());
    dispatch(fetchFacilities());
    getPatients().then(setPatients).catch(err => console.error('Failed to load patients:', err));
  }, [dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await submitFeedback(form);
      if (result.sentiment) {
        setLastSentiment({
          score: result.sentiment.Sentiment_Score,
          flag: result.sentiment.Urgency_Flag ? 'Urgent' : 'Normal',
        });
      }
      dispatch(fetchFeedback());
      dispatch(fetchTriageAlerts());
      setForm({ Facility_ID: '', Patient_ID: '', Feedback_Text: '' });
      setShowForm(false);
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  const getSentimentIcon = (score: string) => {
    const s = Number(score);
    if (s > 0.3) return <ThumbsUp size={16} className="text-success" />;
    if (s < -0.3) return <ThumbsDown size={16} className="text-danger" />;
    return <Minus size={16} className="text-muted" />;
  };

  if (loading && items.length === 0) return <LoadingSpinner message="Loading feedback..." />;

  const urgentCount = triageAlerts.filter(t => t.Urgency_Flag).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Patient Feedback & AI Triage</h1>
          <p className="page-subtitle">
            <Brain size={16} /> Zia-powered sentiment analysis for feedback prioritization
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={18} /> Log Feedback
        </button>
      </div>

      {/* Urgent Alert */}
      {urgentCount > 0 && (
        <div className="alert-banner alert-danger">
          <AlertTriangle size={20} />
          <span><strong>{urgentCount} urgent</strong> feedback item(s) require immediate attention!</span>
        </div>
      )}

      {/* Last Sentiment Result */}
      {lastSentiment && (
        <div className="alert-banner alert-info" onClick={() => setLastSentiment(null)} style={{ cursor: 'pointer' }}>
          <Brain size={20} />
          <span>
            Zia Analysis: Score <strong>{lastSentiment.score}</strong> — Urgency: <strong>{lastSentiment.flag}</strong>
            <small className="ml-2">(click to dismiss)</small>
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'feedback' ? 'active' : ''}`} onClick={() => setActiveTab('feedback')}>
          <MessageSquare size={16} /> All Feedback
        </button>
        <button className={`tab ${activeTab === 'triage' ? 'active' : ''}`} onClick={() => setActiveTab('triage')}>
          <AlertTriangle size={16} /> Sentiment Triage
          {urgentCount > 0 && <span className="tab-badge">{urgentCount}</span>}
        </button>
      </div>

      {activeTab === 'feedback' && (
        <div className="feedback-list">
          {items.length > 0 ? items.map(fb => (
            <div key={fb.ROWID} className="feedback-card">
              <div className="feedback-card-header">
                <span className="feedback-facility">
                  {facilities.find(f => f.ROWID === fb.Facility_ID)?.Facility_Name || fb.Facility_ID}
                </span>
                <span className="feedback-date">
                  {fb.Created_Date ? new Date(fb.Created_Date).toLocaleDateString('en-IN') : fb.CREATEDTIME ? new Date(fb.CREATEDTIME).toLocaleDateString('en-IN') : '—'}
                </span>
              </div>
              <p className="feedback-text">{fb.Feedback_Text}</p>
              <div className="feedback-meta">
                {fb.Patient_ID && <span>Patient: {fb.Patient_ID}</span>}
              </div>
            </div>
          )) : (
            <div className="empty-state-card">
              <MessageSquare size={48} />
              <h3>No Feedback Yet</h3>
              <p>Log patient feedback to begin AI-powered sentiment analysis.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'triage' && (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Feedback ID</th>
                  <th>Sentiment</th>
                  <th>Score</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {triageAlerts.length > 0 ? triageAlerts.map(triage => (
                  <tr key={triage.ROWID} className={triage.Urgency_Flag ? 'row-danger' : ''}>
                    <td className="td-mono">#{triage.Feedback_ID}</td>
                    <td>{getSentimentIcon(triage.Sentiment_Score)}</td>
                    <td className="td-mono">{triage.Sentiment_Score}</td>
                    <td><StatusBadge status={triage.Urgency_Flag ? 'Urgent' : 'Normal'} size="sm" /></td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="empty-state">No triage data. Submit feedback to trigger Zia analysis.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submit Feedback Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Log Patient Feedback</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Facility</label>
                <select value={form.Facility_ID} onChange={e => setForm({ ...form, Facility_ID: e.target.value })} required>
                  <option value="">Select facility...</option>
                  {facilities.map(f => <option key={f.ROWID} value={f.ROWID}>{f.Facility_Name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Patient</label>
                <select value={form.Patient_ID} onChange={e => setForm({ ...form, Patient_ID: e.target.value })} required>
                  <option value="">Select patient...</option>
                  {patients
                    .filter(p => !form.Facility_ID || p.Facility_ID === form.Facility_ID)
                    .map(p => <option key={p.ROWID} value={p.ROWID}>{p.Patient_Name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Feedback Text</label>
                <textarea
                  value={form.Feedback_Text}
                  onChange={e => setForm({ ...form, Feedback_Text: e.target.value })}
                  placeholder="e.g., The ward heating is broken and the patient is suffering from hypothermia..."
                  rows={5}
                  required
                />
              </div>
              <div className="zia-info-box">
                <Brain size={18} />
                <span>Zia AI will automatically analyze sentiment and flag urgent items.</span>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Analyzing...' : 'Submit & Analyze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
