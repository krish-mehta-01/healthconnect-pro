import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchReport, submitReport, reviewReport, endorseReport } from '../store/reportsSlice';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ArrowLeft, Send, CheckCircle, XCircle, Clock,
  FileText, User, Stamp
} from 'lucide-react';
import { canWrite, canSubmitReport, canReviewReports, canEndorseReport } from '../utils/permissions';

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

  const canSubmit = report.Status === 'Draft' && canSubmitReport(user?.role) && canWrite(user?.role);
  // Facility_Head can only endorse their own facility's reports, and only while Submitted
  // (the endorsement gate on the backend enforces the same two checks authoritatively).
  const canEndorse = canEndorseReport(user?.role) && report.Status === 'Submitted'
    && report.Facility_ID === user?.facility_id && canWrite(user?.role);
  // Officers may act on Submitted (no Facility_Head at this facility yet) or Endorsed
  // (Facility_Head already signed off) reports — the backend's hard gate is the actual
  // authority on which of the two is currently valid; a blocked attempt surfaces its
  // reason via the alert in handleApprove/handleReject below.
  const canReview = canReviewReports(user?.role) && ['Submitted', 'Endorsed'].includes(report.Status) && canWrite(user?.role);

  const handleSubmit = () => {
    if (id) dispatch(submitReport(id));
  };

  const handleEndorse = () => {
    if (id) dispatch(endorseReport({ report_id: id }));
  };

  const handleApprove = () => {
    if (id) dispatch(reviewReport({ report_id: id, status: 'Approved' })).unwrap().catch((err: any) => alert(err.message || 'Approval failed'));
  };

  const handleReject = () => {
    if (id) dispatch(reviewReport({ report_id: id, status: 'Rejected', notes: rejectNotes })).unwrap().catch((err: any) => alert(err.message || 'Rejection failed'));
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
        {canEndorse && (
          <button className="btn btn-primary" onClick={handleEndorse}>
            <Stamp size={18} /> Endorse Report
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
