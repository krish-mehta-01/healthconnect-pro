import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchReports, createReport } from '../store/reportsSlice';
import { fetchFacilities } from '../store/facilitiesSlice';
import { getIndicators } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { FileText, Plus, Search, X, Eye } from 'lucide-react';
import type { Indicator } from '../types';

export default function ReportsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, loading } = useAppSelector(s => s.reports);
  const { items: facilities } = useAppSelector(s => s.facilities);

  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newReport, setNewReport] = useState<{ facility_id: string; values: Record<string, string> }>({
    facility_id: '',
    values: {},
  });

  useEffect(() => {
    dispatch(fetchReports(filterStatus ? { status: filterStatus } : undefined));
    dispatch(fetchFacilities());
    getIndicators().then(setIndicators).catch(err => console.error('Failed to load indicators:', err));
  }, [dispatch, filterStatus]);

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const indicatorData = Object.entries(newReport.values)
      .filter(([, value]) => value)
      .map(([indicator_id, value]) => ({ indicator_id, value, notes: '' }));

    await dispatch(createReport({
      facility_id: newReport.facility_id,
      indicators: indicatorData,
    }));
    setShowCreate(false);
    setNewReport({ facility_id: '', values: {} });
  };

  const filteredItems = items.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.ROWID.includes(q) || r.Facility_ID?.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading && items.length === 0) return <LoadingSpinner message="Loading reports..." />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Health Reports</h1>
          <p className="page-subtitle">Monthly facility reporting & approval workflow</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={18} /> New Report
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by ID or facility..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-chips">
          <button
            className={`filter-chip ${filterStatus === '' ? 'active' : ''}`}
            onClick={() => setFilterStatus('')}
          >All</button>
          {['Draft', 'Submitted', 'Approved', 'Rejected'].map(s => (
            <button
              key={s}
              className={`filter-chip ${filterStatus === s ? 'active' : ''}`}
              onClick={() => setFilterStatus(s)}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Reports Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Facility</th>
                <th>Cycle</th>
                <th>Score</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? filteredItems.map(report => (
                <tr key={report.ROWID} className="table-row-hover">
                  <td className="td-mono">#{report.ROWID}</td>
                  <td>{report.Facility_ID}</td>
                  <td>{report.Cycle_ID || '—'}</td>
                  <td>{report.Total_Score || '—'}</td>
                  <td><StatusBadge status={report.Status} size="sm" /></td>
                  <td>{report.CREATEDTIME ? new Date(report.CREATEDTIME).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => navigate(`/reports/${report.ROWID}`)}
                    >
                      <Eye size={16} /> View
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="empty-state">
                    <FileText size={32} />
                    <p>No reports found. Create a new report to get started.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Report Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Monthly Health Report</h2>
              <button className="btn-icon" onClick={() => setShowCreate(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateReport} className="modal-body">
              <div className="form-group">
                <label>Facility</label>
                <select
                  value={newReport.facility_id}
                  onChange={e => setNewReport({ ...newReport, facility_id: e.target.value })}
                  required
                >
                  <option value="">Select facility...</option>
                  {facilities.map(f => (
                    <option key={f.ROWID} value={f.ROWID}>{f.Facility_Name} ({f.Type})</option>
                  ))}
                </select>
              </div>

              <h3 className="form-section-title">Health Indicators</h3>
              <div className="indicators-grid">
                {indicators.length > 0 ? indicators.map(ind => (
                  <div key={ind.ROWID} className="indicator-input">
                    <label>{ind.Indicator_Name}</label>
                    <input
                      type="number"
                      value={newReport.values[ind.ROWID] || ''}
                      onChange={e => setNewReport({
                        ...newReport,
                        values: { ...newReport.values, [ind.ROWID]: e.target.value },
                      })}
                      placeholder="Enter value"
                      min={0}
                    />
                  </div>
                )) : (
                  <p className="empty-state-inline">No indicators configured yet.</p>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Report (Draft)</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
