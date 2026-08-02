import { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchDashboard } from '../store/dashboardSlice';
import { getOverdueReports } from '../services/api';
import KPICard from '../components/KPICard';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Building2, FileText, CheckCircle, Clock,
  XCircle, FileEdit, AlertTriangle, PlusCircle, LayoutDashboard,
  CalendarX2, Users, Package, Send
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import GrievanceTriage from '../components/GrievanceTriage';
import ResourceTransferModal from '../components/ResourceTransferModal';
import ReportAuditTable from '../components/ReportAuditTable';
import SubmitReportForm from '../components/SubmitReportForm';
import { canSubmitReport } from '../utils/permissions';
import { useLanguage } from '../context/LanguageContext';
import type { OverdueFacility } from '../types';

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const { stats, loading: dashboardLoading } = useAppSelector(s => s.dashboard);
  const { user } = useAppSelector(s => s.auth);
  const { t } = useLanguage();
  const isOfficerOrAdmin = ['State_Admin', 'District_Officer', 'Block_Officer'].includes(user?.role || '');
  // Report submission is only meaningful for roles that own a facility's reporting duty —
  // see utils/permissions.ts for the canonical role list (single source of truth).
  const isReportSubmitter = canSubmitReport(user?.role);
  // Officer/admin review widgets (grievance escalation, resource re-routing, approval queue)
  // are shown to Auditor too (full read-only visibility) but never to Pharmacist, whose
  // dashboard is scoped to KPI cards + charts only.
  const showOfficerWidgets = isOfficerOrAdmin || user?.role === 'Auditor';
  // KPI row tiering: network-wide roles keep the original report-centric cards (their
  // numbers are already jurisdiction-scoped and meaningful). Inventory-domain roles get
  // inventory-centric cards instead — "Total Reports/Approved/Rejected" means nothing to
  // someone who never touches the report workflow. Everyone else (facility-scoped clinical/
  // admin roles) gets facility-possessive language and a Patients count instead of the
  // always-1, meaningless "Total Facilities" card.
  const isNetworkWideTier = isOfficerOrAdmin || user?.role === 'Auditor';
  const isInventoryTier = user?.role === 'Pharmacist' || user?.role === 'Store_Keeper';
  const isFacilityScopedTier = !isNetworkWideTier && !isInventoryTier;

  const [activeTab, setActiveTab] = useState<'dashboard' | 'submit'>(isReportSubmitter ? 'submit' : 'dashboard');

  // Overdue-facilities widget (officers/admin) — facilities with no report yet in the
  // currently Active reporting cycle.
  const [overdueFacilities, setOverdueFacilities] = useState<OverdueFacility[]>([]);
  const [overdueLoading, setOverdueLoading] = useState(false);
  const [overdueError, setOverdueError] = useState('');

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  useEffect(() => {
    // Gated to isOfficerOrAdmin (not showOfficerWidgets) — the backend route is role-gated
    // to District_Officer/Block_Officer/State_Admin only, and Auditor would get a 403.
    if (!isOfficerOrAdmin) return;
    setOverdueLoading(true);
    getOverdueReports()
      .then(setOverdueFacilities)
      .catch(err => {
        console.error('Failed to load overdue facilities:', err);
        setOverdueError('Could not load overdue facilities.');
      })
      .finally(() => setOverdueLoading(false));
  }, [isOfficerOrAdmin]);

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
          <h1 className="page-title">{t('commandCenter')}</h1>
          <p className="page-subtitle">
            {t('welcomeBackUser')}, <strong>{user?.name}</strong> • {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Tabs — report submission is a Facility Staff / Data Entry Clerk task; every other
          role (officers/admin, Pharmacist, Auditor) only reviews, so they get a single
          unified dashboard view with no tab bar */}
      {isReportSubmitter && (
        <div className="dashboard-tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
          <button
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '8px' }}
          >
            <LayoutDashboard size={18} />
            {t('overview')}
          </button>
          <button
            className={`btn ${activeTab === 'submit' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('submit')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '8px' }}
          >
            <PlusCircle size={18} />
            {t('submitNewReport')}
          </button>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <>
          {/* High Urgency Alerts Feed — officers/admin act on these, Auditor sees them read-only */}
          {showOfficerWidgets && <GrievanceTriage />}

          {/* Facilities Overdue This Cycle — District_Officer/Block_Officer/State_Admin only
              (matches the backend route's role gate; Auditor is excluded here). */}
          {isOfficerOrAdmin && (
            <div className="card" style={{ marginBottom: '2rem' }}>
              <div className="card-header">
                <h3><CalendarX2 size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />Facilities Overdue This Cycle</h3>
              </div>
              <div className="card-body">
                {overdueLoading ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Checking reporting status…</p>
                ) : overdueError ? (
                  <p style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>{overdueError}</p>
                ) : overdueFacilities.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', fontSize: '0.9rem' }}>
                    <CheckCircle size={18} /> All facilities in your jurisdiction have reported this cycle.
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead><tr><th>Facility</th><th>District</th><th>Block</th></tr></thead>
                      <tbody>
                        {overdueFacilities.map(f => (
                          <tr key={f.Facility_ID}>
                            <td>{f.Facility_Name}</td>
                            <td>{f.District}</td>
                            <td>{f.Block || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* KPI Cards — role-tiered, see isNetworkWideTier/isInventoryTier/isFacilityScopedTier above */}
          <div className="kpi-grid">
            {isNetworkWideTier && (
              <>
                <KPICard title="Total Facilities" value={stats?.totalFacilities ?? 0} icon={<Building2 size={24} />} color="#0d9488" trend={{ value: 'Active', positive: true }} />
                <KPICard title="Total Reports" value={stats?.totalReports ?? 0} icon={<FileText size={24} />} color="#6366f1" />
                <KPICard title="Pending Review" value={stats?.pendingReports ?? 0} icon={<Clock size={24} />} color="#f59e0b" />
                <KPICard title="Approved" value={stats?.approvedReports ?? 0} icon={<CheckCircle size={24} />} color="#22c55e" trend={{ value: 'Up to date', positive: true }} />
                <KPICard title="Rejected" value={stats?.rejectedReports ?? 0} icon={<XCircle size={24} />} color="#ef4444" />
                <KPICard title="Drafts" value={stats?.draftReports ?? 0} icon={<FileEdit size={24} />} color="#64748b" />
              </>
            )}
            {isInventoryTier && (
              <>
                <KPICard title="Low Stock Items" value={stats?.lowStockAlerts.length ?? 0} icon={<AlertTriangle size={24} />} color="#ef4444" />
                <KPICard title="Total Inventory Items" value={stats?.totalInventoryItems ?? 0} icon={<Package size={24} />} color="#0d9488" trend={{ value: 'Tracked', positive: true }} />
                <KPICard title="Pending Supply Requests" value={stats?.pendingSupplyRequests ?? 0} icon={<Send size={24} />} color="#f59e0b" />
              </>
            )}
            {isFacilityScopedTier && (
              <>
                <KPICard title="My Facility's Reports" value={stats?.totalReports ?? 0} icon={<FileText size={24} />} color="#6366f1" />
                <KPICard title="Pending Review" value={stats?.pendingReports ?? 0} icon={<Clock size={24} />} color="#f59e0b" />
                <KPICard title="Approved" value={stats?.approvedReports ?? 0} icon={<CheckCircle size={24} />} color="#22c55e" trend={{ value: 'Up to date', positive: true }} />
                <KPICard title="Rejected" value={stats?.rejectedReports ?? 0} icon={<XCircle size={24} />} color="#ef4444" />
                <KPICard title="Drafts" value={stats?.draftReports ?? 0} icon={<FileEdit size={24} />} color="#64748b" />
                <KPICard title="Patients Registered" value={stats?.totalPatients ?? 0} icon={<Users size={24} />} color="#0d9488" trend={{ value: 'At my facility', positive: true }} />
              </>
            )}
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
                  <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: '12px', color: 'var(--color-text-primary)' }} />
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
                  <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: '12px', color: 'var(--color-text-primary)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Smart Resource Re-Routing + Report Approval Queue — officer/admin actions; Auditor sees them read-only */}
          {showOfficerWidgets && (
            <>
              <ResourceTransferModal />
              <ReportAuditTable />
            </>
          )}
        </>
      )}

      {activeTab === 'submit' && (
        <SubmitReportForm onSuccess={() => setActiveTab('dashboard')} />
      )}
    </div>
  );
}
