import { useState, useEffect } from 'react';
import { getReports, getFacilities, getCycles, approveReportById, getReport } from '../services/api';
import { ClipboardCheck, Eye, Check, X, History, Activity } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import StatusBadge from './StatusBadge';

export default function ReportAuditTable() {
  const [reports, setReports] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [reportDetails, setReportDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [comments, setComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reps, facs, cycs] = await Promise.all([
        getReports({ status: 'Submitted' }),
        getFacilities(),
        getCycles()
      ]);
      setReports(reps);
      setFacilities(facs);
      setCycles(cycs);
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setLoading(false);
    }
  };

  const openAuditModal = async (report: any) => {
    setSelectedReport(report);
    setComments('');
    setDetailsLoading(true);
    try {
      const details = await getReport(report.ROWID);
      setReportDetails(details);
    } catch (err) {
      console.error('Failed to load report details', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleAction = async (status: 'Approved' | 'Rejected') => {
    if (!selectedReport) return;
    setActionLoading(true);
    try {
      await approveReportById(selectedReport.ROWID, { status, comments });
      setSelectedReport(null);
      setReportDetails(null);
      loadData();
    } catch (err: any) {
      alert('Action failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading pending approvals..." />;
  if (reports.length === 0) return null;

  return (
    <>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <ClipboardCheck size={20} color="var(--color-primary)" />
            <h3>Pending Report Approvals</h3>
          </div>
          <span style={{ background: 'var(--color-primary)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
            {reports.length} Pending
          </span>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Facility</th>
                <th>Cycle</th>
                <th>Submitted On</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(report => {
                const fac = facilities.find(f => f.ROWID === report.Facility_ID);
                const cyc = cycles.find(c => c.ROWID === report.Cycle_ID);
                return (
                  <tr key={report.ROWID}>
                    <td className="td-mono">#{report.ROWID}</td>
                    <td className="td-value">{fac?.Facility_Name || 'Unknown'}</td>
                    <td>{cyc?.Cycle_Name || 'Unknown'}</td>
                    <td>{report.CREATEDTIME ? new Date(report.CREATEDTIME).toLocaleDateString() : 'Recent'}</td>
                    <td>
                      <button className="btn btn-primary" onClick={() => openAuditModal(report)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <Eye size={14} /> Audit & Approve
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', margin: '1rem', background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-xl)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
              <h3>Audit Report #{selectedReport.ROWID}</h3>
              <button onClick={() => setSelectedReport(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div className="card-body" style={{ overflowY: 'auto', flex: 1, padding: '1.5rem' }}>
              {detailsLoading ? (
                <LoadingSpinner message="Fetching report data and workflow history..." />
              ) : reportDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Facility Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--color-bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Facility</div>
                      <div style={{ fontWeight: 600 }}>{facilities.find(f => f.ROWID === reportDetails.Facility_ID)?.Facility_Name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Reporting Cycle</div>
                      <div style={{ fontWeight: 600 }}>{cycles.find(c => c.ROWID === reportDetails.Cycle_ID)?.Cycle_Name}</div>
                    </div>
                  </div>

                  {/* Health Indicators */}
                  <div>
                    <h4 style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}><Activity size={18} /> Reported Metrics</h4>
                    {reportDetails.indicators?.length > 0 ? (
                      <table className="data-table" style={{ background: 'var(--color-bg-primary)', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                          <tr>
                            <th>Indicator ID</th>
                            <th>Value</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportDetails.indicators.map((ind: any) => (
                            <tr key={ind.ROWID}>
                              <td className="td-mono">{ind.Indicator_ID}</td>
                              <td className="td-value" style={{ fontSize: '1.1rem' }}>{ind.Value || ind.Metric_Value}</td>
                              <td style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{ind.Notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No indicator data provided in this report.</div>
                    )}
                  </div>

                  {/* Workflow History */}
                  <div>
                    <h4 style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}><History size={18} /> Workflow Audit Log</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '2px solid var(--color-border)', marginLeft: '0.5rem', paddingLeft: '1.5rem' }}>
                      {reportDetails.history?.map((h: any, i: number) => (
                        <div key={h.ROWID || i} style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '-1.85rem', top: '0.2rem', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--color-bg-card)' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <strong style={{ fontSize: '0.95rem' }}>{h.Status_Change || h.Action}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{h.Action_Timestamp || h.CREATEDTIME ? new Date(h.Action_Timestamp || h.CREATEDTIME).toLocaleString() : ''}</span>
                          </div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                            By: {h.Action_By || 'System'} {h.Comments ? ` — "${h.Comments}"` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Approval Actions */}
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <textarea 
                      placeholder="Add official comments (optional)..."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', minHeight: '80px', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-outline" 
                        onClick={() => handleAction('Rejected')} 
                        disabled={actionLoading}
                        style={{ color: '#ef4444', borderColor: '#ef4444', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                      >
                        <X size={16} /> Reject Report
                      </button>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => handleAction('Approved')} 
                        disabled={actionLoading}
                        style={{ background: '#22c55e', borderColor: '#22c55e', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                      >
                        <Check size={16} /> Approve Report
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                <div style={{ color: '#ef4444' }}>Failed to load details.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
