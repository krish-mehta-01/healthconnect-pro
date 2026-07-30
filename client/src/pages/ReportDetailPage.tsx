import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchReport, submitReport, reviewReport } from '../store/reportsSlice';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ArrowLeft, Send, CheckCircle, XCircle, Clock,
  FileText, User
} from 'lucide-react';

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { current: report, loading } = useAppSelector(s => s.reports);
  const { user } = useAppSelector(s => s.auth);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchReport(id));
  }, [dispatch, id]);

  if (loading || !report) return <LoadingSpinner message="Loading report..." />;

  const canSubmit = report.Status === 'Draft';
  const canReview = ['Block_Officer', 'District_Officer', 'State_Admin'].includes(user?.role || '') && report.Status === 'Submitted';

  const handleSubmit = () => {
    if (id) dispatch(submitReport(id));
  };

  const handleApprove = () => {
    if (id) dispatch(reviewReport({ report_id: id, status: 'Approved' }));
  };

  const handleReject = () => {
    if (id) dispatch(reviewReport({ report_id: id, status: 'Rejected', notes: rejectNotes }));
    setShowRejectForm(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reports')}>
            <ArrowLeft size={16} /> Back to Reports
          </button>
          <h1 className="page-title">Report #{report.ROWID}</h1>
          <p className="page-subtitle">
            Facility: {report.Facility_ID} • Cycle: {report.Cycle_ID || 'N/A'}
          </p>
        </div>
        <StatusBadge status={report.Status} />
      </div>

      {/* Action Bar */}
      <div className="action-bar">
        {canSubmit && (
          <button className="btn btn-primary" onClick={handleSubmit}>
            <Send size={18} /> Submit for Approval
          </button>
        )}
        {canReview && (
          <>
            <button className="btn btn-success" onClick={handleApprove}>
              <CheckCircle size={18} /> Approve
            </button>
            <button className="btn btn-danger" onClick={() => setShowRejectForm(!showRejectForm)}>
              <XCircle size={18} /> Reject
            </button>
          </>
        )}
      </div>

      {/* Reject Form */}
      {showRejectForm && (
        <div className="card reject-form">
          <h3>Rejection Notes</h3>
          <textarea
            value={rejectNotes}
            onChange={e => setRejectNotes(e.target.value)}
            placeholder="Provide reason for rejection..."
            rows={3}
          />
          <div className="reject-actions">
            <button className="btn btn-ghost" onClick={() => setShowRejectForm(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleReject}>Confirm Rejection</button>
          </div>
        </div>
      )}

      {/* Indicator Data */}
      <div className="card">
        <div className="card-header">
          <h3><FileText size={18} /> Health Indicator Data</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Indicator</th>
                <th>Value</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {report.indicators && report.indicators.length > 0 ? report.indicators.map((ind, i) => (
                <tr key={i}>
                  <td>{ind.Indicator_ID || ind.indicator_name || `Indicator ${i + 1}`}</td>
                  <td className="td-mono td-value">{ind.Metric_Value}</td>
                  <td className="td-muted">{ind.Notes || '—'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="empty-state">No indicator data recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workflow History */}
      <div className="card">
        <div className="card-header">
          <h3><Clock size={18} /> Workflow History</h3>
        </div>
        <div className="timeline">
          {report.history && report.history.length > 0 ? report.history.map((entry, i) => (
            <div key={i} className="timeline-item">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className="timeline-actor">
                    <User size={14} /> {entry.Action_By}
                  </span>
                  <span className="timeline-time">
                    {entry.Action_Timestamp ? new Date(entry.Action_Timestamp).toLocaleString('en-IN') : ''}
                  </span>
                </div>
                <p className="timeline-action">{entry.Status_Change}{entry.Comments ? ` — "${entry.Comments}"` : ''}</p>
              </div>
            </div>
          )) : (
            <p className="empty-state-inline">No workflow history yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
