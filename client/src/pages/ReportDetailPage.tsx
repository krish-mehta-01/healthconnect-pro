import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchReport, submitReport, reviewReport, endorseReport } from '../store/reportsSlice';
import { updateReportData } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ArrowLeft, Send, CheckCircle, XCircle, Clock,
  FileText, User, Stamp, Pencil, AlertTriangle
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
  const [isEditingData, setIsEditingData] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingData, setSavingData] = useState(false);

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

  const startEditData = () => {
    const values: Record<string, string> = {};
    (report.indicators || []).forEach((ind, i) => {
      values[ind.ROWID || String(i)] = ind.Metric_Value;
    });
    setEditValues(values);
    setIsEditingData(true);
  };

  const handleSaveData = async () => {
    if (!id) return;
    setSavingData(true);
    try {
      const payload = (report.indicators || []).map((ind, i) => ({
        ROWID: ind.ROWID,
        indicator_id: ind.Indicator_ID,
        value: editValues[ind.ROWID || String(i)] ?? ind.Metric_Value,
        notes: ind.Notes,
      }));
      await updateReportData(id, payload);
      await dispatch(fetchReport(id));
      setIsEditingData(false);
    } catch (err) {
      console.error('Failed to save indicator data:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSavingData(false);
    }
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
          <h3 id="reject-notes-heading">Rejection Notes</h3>
          <textarea
            aria-labelledby="reject-notes-heading"
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

      {/* Anomaly banner — flags indicator values far outside this facility's own history for
          that indicator (see attachAnomalyFlags in reports.routes.js). Not a diagnosis, just
          a "double-check this before approving" signal. */}
      {report.indicators && report.indicators.some(ind => ind.IsAnomaly) && (
        <div className="alert-banner alert-warning">
          <AlertTriangle size={20} />
          <span>
            <strong>{report.indicators.filter(ind => ind.IsAnomaly).length} indicator(s)</strong> are far outside this facility's usual range for this cycle — worth a second look before approving.
          </span>
        </div>
      )}

      {/* Indicator Data — editable while still a Draft, by the same roles that can submit it */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3><FileText size={18} /> Health Indicator Data</h3>
          {canSubmit && report.indicators && report.indicators.length > 0 && !isEditingData && (
            <button className="btn btn-outline btn-sm" onClick={startEditData}>
              <Pencil size={14} /> Edit Values
            </button>
          )}
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
              {report.indicators && report.indicators.length > 0 ? report.indicators.map((ind, i) => {
                const key = ind.ROWID || String(i);
                return (
                  <tr key={i} className={ind.IsAnomaly ? 'row-warning' : ''}>
                    <td>{ind.Indicator_ID || ind.indicator_name || `Indicator ${i + 1}`}</td>
                    <td className="td-mono td-value">
                      {isEditingData ? (
                        <input
                          type="text"
                          value={editValues[key] ?? ''}
                          onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                          style={{ width: '120px', padding: '0.35rem', borderRadius: '6px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                        />
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          {ind.Metric_Value}
                          {ind.IsAnomaly && (
                            <span title={`Usual average for this facility: ~${ind.HistoricalAverage} (from ${ind.HistoricalCount} prior reports)`}>
                              <AlertTriangle size={14} color="var(--color-warning)" />
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="td-muted">{ind.Notes || '—'}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={3} className="empty-state">No indicator data recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {isEditingData && (
          <div className="card-body" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: 0 }}>
            <button className="btn btn-ghost" onClick={() => setIsEditingData(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveData} disabled={savingData}>
              {savingData ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
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
