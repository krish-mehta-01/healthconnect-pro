import { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchDashboard } from '../store/dashboardSlice';
import { getFacilities, getCycles, getIndicators, submitNewReport } from '../services/api';
import KPICard from '../components/KPICard';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Building2, FileText, CheckCircle, Clock,
  XCircle, FileEdit, AlertTriangle, MessageSquare, PlusCircle, LayoutDashboard
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import GrievanceTriage from '../components/GrievanceTriage';
import ResourceTransferModal from '../components/ResourceTransferModal';
import ReportAuditTable from '../components/ReportAuditTable';

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const { stats, loading: dashboardLoading } = useAppSelector(s => s.dashboard);
  const { user } = useAppSelector(s => s.auth);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'submit'>('dashboard');

  // Form State
  const [facilities, setFacilities] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  
  const [selectedFacility, setSelectedFacility] = useState('');
  const [selectedCycle, setSelectedCycle] = useState('');
  const [indicatorValues, setIndicatorValues] = useState<Record<string, string>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    dispatch(fetchDashboard());
    
    // Fetch data for the form
    Promise.all([
      getFacilities(),
      getCycles(),
      getIndicators()
    ]).then(([facData, cycleData, indData]) => {
      setFacilities(facData);
      setCycles(cycleData);
      setIndicators(indData);
      
      if (facData.length > 0) setSelectedFacility(facData[0].ROWID);
      if (cycleData.length > 0) setSelectedCycle(cycleData[0].ROWID);
    }).catch(err => console.error('Failed to load form data:', err));
  }, [dispatch]);

  const handleIndicatorChange = (id: string, value: string) => {
    setIndicatorValues(prev => ({ ...prev, [id]: value }));
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      const inds = Object.entries(indicatorValues).map(([indicator_id, value]) => ({
        indicator_id,
        value,
        notes: ''
      }));

      await submitNewReport({
        facility_id: selectedFacility,
        cycle_id: selectedCycle,
        indicators: inds
      });

      setSubmitSuccess(true);
      setIndicatorValues({});
      dispatch(fetchDashboard()); // Refresh dashboard data
      setTimeout(() => {
        setActiveTab('dashboard');
        setSubmitSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Submission failed:', err);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (dashboardLoading && !stats) return <LoadingSpinner message="Loading dashboard..." />;

  const reportStatusData = stats ? [
    { name: 'Draft', value: stats.draftReports, color: '#64748b' },
    { name: 'Submitted', value: stats.pendingReports, color: '#f59e0b' },
    { name: 'Approved', value: stats.approvedReports, color: '#22c55e' },
    { name: 'Rejected', value: stats.rejectedReports, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  const facilityPerformance = stats?.facilityPerformance ?? [];

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">
            Welcome back, <strong>{user?.name}</strong> • {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
        <button 
          className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '8px' }}
        >
          <LayoutDashboard size={18} />
          State Dashboard
        </button>
        <button 
          className={`btn ${activeTab === 'submit' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('submit')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '8px' }}
        >
          <PlusCircle size={18} />
          Submit New Report
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <>
          {/* High Urgency Alerts Feed */}
          <GrievanceTriage />

          {/* KPI Cards */}
          <div className="kpi-grid">
            <KPICard title="Total Facilities" value={stats?.totalFacilities ?? 0} icon={<Building2 size={24} />} color="#0d9488" trend={{ value: 'Active', positive: true }} />
            <KPICard title="Total Reports" value={stats?.totalReports ?? 0} icon={<FileText size={24} />} color="#6366f1" />
            <KPICard title="Pending Review" value={stats?.pendingReports ?? 0} icon={<Clock size={24} />} color="#f59e0b" />
            <KPICard title="Approved" value={stats?.approvedReports ?? 0} icon={<CheckCircle size={24} />} color="#22c55e" trend={{ value: 'Up to date', positive: true }} />
            <KPICard title="Rejected" value={stats?.rejectedReports ?? 0} icon={<XCircle size={24} />} color="#ef4444" />
            <KPICard title="Drafts" value={stats?.draftReports ?? 0} icon={<FileEdit size={24} />} color="#64748b" />
          </div>

          {/* Charts Row */}
          <div className="dashboard-charts">
            <div className="chart-card">
              <h3 className="chart-title">Facility Performance Overview</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={facilityPerformance} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#94a3b8' }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#e2e8f0' }} />
                  <Bar dataKey="score" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" />
                      <stop offset="100%" stopColor="#0d9488" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3 className="chart-title">Report Status Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={reportStatusData.length > 0 ? reportStatusData : [{ name: 'No Data', value: 1, color: '#334155' }]}
                    dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {(reportStatusData.length > 0 ? reportStatusData : [{ color: '#334155' }]).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ color: '#94a3b8' }} />
                  <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Smart Resource Re-Routing Widget */}
          <ResourceTransferModal />

          {/* Interactive Report Audit Table */}
          <ReportAuditTable />
        </>
      )}

      {activeTab === 'submit' && (
        <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card-header">
            <h3>Submit New Facility Report</h3>
          </div>
          <div className="card-body" style={{ padding: '2rem' }}>
            {submitSuccess && (
              <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={20} />
                Report submitted successfully! Redirecting...
              </div>
            )}
            
            <form onSubmit={handleReportSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Facility</label>
                  <select 
                    style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} 
                    value={selectedFacility} 
                    onChange={e => setSelectedFacility(e.target.value)}
                    required
                  >
                    <option value="">Select Facility...</option>
                    {facilities.map(f => (
                      <option key={f.ROWID} value={f.ROWID}>{f.Facility_Name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Reporting Cycle</label>
                  <select 
                    style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} 
                    value={selectedCycle} 
                    onChange={e => setSelectedCycle(e.target.value)}
                    required
                  >
                    <option value="">Select Cycle...</option>
                    {cycles.map(c => (
                      <option key={c.ROWID} value={c.ROWID}>{c.Cycle_Name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Health Indicators</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {indicators.map(ind => (
                  <div key={ind.ROWID} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{ind.Indicator_Name}</label>
                    <input 
                      type="number" 
                      placeholder="Enter value" 
                      style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                      value={indicatorValues[ind.ROWID] || ''}
                      onChange={e => handleIndicatorChange(ind.ROWID, e.target.value)}
                      required
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
