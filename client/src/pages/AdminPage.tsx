import { useEffect, useState } from 'react';
import {
  getDepartments, createDepartment,
  getCycles, createCycle,
  getIndicators, createIndicator,
  getUsers, createUser, getActivityLog, getFacilities,
} from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { Settings, Plus, X, Layers, CalendarClock, Activity, Users as UsersIcon, History } from 'lucide-react';
import type { Department, ReportingCycle, Indicator, User, WorkflowHistoryEntry, Facility, UserRole } from '../types';
import { useAppSelector } from '../store/hooks';
import { canWrite } from '../utils/permissions';

type Tab = 'departments' | 'cycles' | 'indicators' | 'users' | 'activity';

const ALL_ROLES: UserRole[] = [
  'State_Admin', 'District_Officer', 'Block_Officer', 'Auditor',
  'Facility_Head', 'Facility_Supervisor', 'Community_Health_Officer', 'Doctor', 'Staff_Nurse',
  'ASHA_Worker', 'ANM', 'Registration_Clerk', 'Facility_Staff',
  'Data_Entry_Clerk', 'Pharmacist', 'Store_Keeper',
];

export default function AdminPage() {
  const { user } = useAppSelector(s => s.auth);
  // Users tab is visibility for State_Admin only — Auditor's read-only remit stops short
  // of seeing the full staff directory (name/role/facility/email of everyone in the system).
  const isStateAdminUser = user?.role === 'State_Admin';
  // Activity Log is the opposite: it's exactly the kind of system-wide, read-only oversight
  // Auditor exists for, so both State_Admin and Auditor see it (this page is unreachable by
  // any other role — see ProtectedRoute in App.tsx).
  const canSeeActivityLog = user?.role === 'State_Admin' || user?.role === 'Auditor';
  const [activeTab, setActiveTab] = useState<Tab>('departments');
  // As disease-program-specific indicators (TB, Polio, etc.) get added alongside general
  // ones, a flat list stops being scannable — this filters the Indicators tab by
  // Department without needing any backend change (Dept_ID already exists on Indicator).
  const [indicatorDeptFilter, setIndicatorDeptFilter] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [cycles, setCycles] = useState<ReportingCycle[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [activityLog, setActivityLog] = useState<WorkflowHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [deptForm, setDeptForm] = useState({ Dept_Name: '', Head_Officer_ID: '' });
  const [cycleForm, setCycleForm] = useState({ Cycle_Name: '', Start_Date: '', End_Date: '', Status: 'Active' as 'Active' | 'Closed' });
  const [indForm, setIndForm] = useState({ Indicator_Name: '', Data_Type: 'number' as Indicator['Data_Type'], Dept_ID: '' });
  const [userForm, setUserForm] = useState({ name: '', email_id: '', role: 'Facility_Staff' as UserRole, facility_id: '', password: '' });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [d, c, i] = await Promise.all([getDepartments(), getCycles(), getIndicators()]);
      setDepartments(d);
      setCycles(c);
      setIndicators(i);
      if (i.length === 0 && d.length > 0) setIndForm(f => ({ ...f, Dept_ID: d[0].ROWID }));
      if (isStateAdminUser) {
        getUsers().then(setUsers).catch(err => console.error('Failed to load users:', err));
        getFacilities().then(setFacilities).catch(err => console.error('Failed to load facilities:', err));
      }
      if (canSeeActivityLog) {
        getActivityLog().then(setActivityLog).catch(err => console.error('Failed to load activity log:', err));
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    await createDepartment(deptForm);
    setDeptForm({ Dept_Name: '', Head_Officer_ID: '' });
    setShowForm(false);
    loadAll();
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    await createCycle(cycleForm);
    setCycleForm({ Cycle_Name: '', Start_Date: '', End_Date: '', Status: 'Active' });
    setShowForm(false);
    loadAll();
  };

  const handleCreateIndicator = async (e: React.FormEvent) => {
    e.preventDefault();
    await createIndicator(indForm);
    setIndForm(f => ({ ...f, Indicator_Name: '' }));
    setShowForm(false);
    loadAll();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    await createUser(userForm);
    setUserForm({ name: '', email_id: '', role: 'Facility_Staff', facility_id: '', password: '' });
    setShowForm(false);
    loadAll();
  };

  if (loading) return <LoadingSpinner message="Loading configuration..." />;

  const deptNameById = (id: string) => departments.find(d => d.ROWID === id)?.Dept_Name || id;
  const userNameById = (id?: string) => (id ? users.find(u => u.ROWID === id)?.Full_Name || id : '—');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Settings size={28} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />Network Configuration</h1>
          <p className="page-subtitle">Manage departments, reporting cycles, and health indicators for the whole network</p>
        </div>
        {canWrite(user?.role) && (activeTab === 'departments' || activeTab === 'cycles' || activeTab === 'indicators' || (activeTab === 'users' && isStateAdminUser)) && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={18} /> Add {activeTab === 'departments' ? 'Department' : activeTab === 'cycles' ? 'Cycle' : activeTab === 'users' ? 'User' : 'Indicator'}
          </button>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'departments' ? 'active' : ''}`} onClick={() => setActiveTab('departments')}>
          <Layers size={16} /> Departments
        </button>
        <button className={`tab ${activeTab === 'cycles' ? 'active' : ''}`} onClick={() => setActiveTab('cycles')}>
          <CalendarClock size={16} /> Reporting Cycles
        </button>
        <button className={`tab ${activeTab === 'indicators' ? 'active' : ''}`} onClick={() => setActiveTab('indicators')}>
          <Activity size={16} /> Indicators
        </button>
        {isStateAdminUser && (
          <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            <UsersIcon size={16} /> Users
          </button>
        )}
        {canSeeActivityLog && (
          <button className={`tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>
            <History size={16} /> Activity Log
          </button>
        )}
      </div>

      {activeTab === 'departments' && (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Department Name</th><th>Head Officer</th></tr></thead>
              <tbody>
                {departments.length > 0 ? departments.map(d => (
                  <tr key={d.ROWID}><td>{d.Dept_Name}</td><td>{userNameById(d.Head_Officer_ID)}</td></tr>
                )) : <tr><td colSpan={2} className="empty-state">No departments yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'cycles' && (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Cycle Name</th><th>Start Date</th><th>End Date</th><th>Status</th></tr></thead>
              <tbody>
                {cycles.length > 0 ? cycles.map(c => (
                  <tr key={c.ROWID}>
                    <td>{c.Cycle_Name}</td>
                    <td>{c.Start_Date}</td>
                    <td>{c.End_Date}</td>
                    <td>{c.Status}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="empty-state">No reporting cycles yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'indicators' && (
        <div className="card">
          <div className="card-header">
            <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
              <label>Filter by Department</label>
              <select value={indicatorDeptFilter} onChange={e => setIndicatorDeptFilter(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.ROWID} value={d.ROWID}>{d.Dept_Name}</option>)}
              </select>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Indicator Name</th><th>Data Type</th><th>Department</th></tr></thead>
              <tbody>
                {(() => {
                  const filtered = indicatorDeptFilter
                    ? indicators.filter(i => i.Dept_ID === indicatorDeptFilter)
                    : indicators;
                  return filtered.length > 0 ? filtered.map(i => (
                    <tr key={i.ROWID}>
                      <td>{i.Indicator_Name}</td>
                      <td>{i.Data_Type}</td>
                      <td>{deptNameById(i.Dept_ID)}</td>
                    </tr>
                  )) : <tr><td colSpan={3} className="empty-state">No indicators {indicatorDeptFilter ? 'in this department' : 'yet'}.</td></tr>;
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && isStateAdminUser && (
        <div className="card">
          <div className="card-header">
            <h3>Network Users</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Role</th><th>Facility ID</th><th>Email</th></tr></thead>
              <tbody>
                {users.length > 0 ? users.map(u => (
                  <tr key={u.ROWID}>
                    <td>{u.Full_Name}</td>
                    <td>{u.Role?.replace(/_/g, ' ')}</td>
                    <td className="td-mono">{u.Facility_ID || '—'}</td>
                    <td>{u.email_id || '—'}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="empty-state">No users found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'activity' && canSeeActivityLog && (
        <div className="card">
          <div className="card-header">
            <h3>System-Wide Activity Log</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Timestamp</th><th>Actor</th><th>Facility</th><th>Status Change</th><th>Comments</th></tr></thead>
              <tbody>
                {activityLog.length > 0 ? activityLog.map(h => (
                  <tr key={h.ROWID}>
                    <td>{h.Action_Timestamp}</td>
                    <td>{h.Action_By}</td>
                    <td className="td-mono">{h.Facility_ID || '—'}</td>
                    <td>{h.Status_Change}</td>
                    <td>{h.Comments || '—'}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="empty-state">No activity recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add {activeTab === 'departments' ? 'Department' : activeTab === 'cycles' ? 'Reporting Cycle' : activeTab === 'users' ? 'User' : 'Indicator'}</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            {activeTab === 'departments' && (
              <form onSubmit={handleCreateDept} className="modal-body">
                <div className="form-group">
                  <label>Department Name</label>
                  <input type="text" value={deptForm.Dept_Name} onChange={e => setDeptForm({ ...deptForm, Dept_Name: e.target.value })} placeholder="e.g., Emergency & Trauma" required />
                </div>
                <div className="form-group">
                  <label>Head Officer</label>
                  <select value={deptForm.Head_Officer_ID} onChange={e => setDeptForm({ ...deptForm, Head_Officer_ID: e.target.value })}>
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.ROWID} value={u.ROWID}>{u.Full_Name} ({u.Role?.replace(/_/g, ' ')})</option>)}
                  </select>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Department</button>
                </div>
              </form>
            )}

            {activeTab === 'cycles' && (
              <form onSubmit={handleCreateCycle} className="modal-body">
                <div className="form-group">
                  <label>Cycle Name</label>
                  <input type="text" value={cycleForm.Cycle_Name} onChange={e => setCycleForm({ ...cycleForm, Cycle_Name: e.target.value })} placeholder="e.g., August 2026" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input type="date" value={cycleForm.Start_Date} onChange={e => setCycleForm({ ...cycleForm, Start_Date: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input type="date" value={cycleForm.End_Date} onChange={e => setCycleForm({ ...cycleForm, End_Date: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={cycleForm.Status} onChange={e => setCycleForm({ ...cycleForm, Status: e.target.value as 'Active' | 'Closed' })}>
                    <option value="Active">Active</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Cycle</button>
                </div>
              </form>
            )}

            {activeTab === 'indicators' && (
              <form onSubmit={handleCreateIndicator} className="modal-body">
                <div className="form-group">
                  <label>Indicator Name</label>
                  <input type="text" value={indForm.Indicator_Name} onChange={e => setIndForm({ ...indForm, Indicator_Name: e.target.value })} placeholder="e.g., OPD Attendance" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Data Type</label>
                    <select value={indForm.Data_Type} onChange={e => setIndForm({ ...indForm, Data_Type: e.target.value as Indicator['Data_Type'] })}>
                      <option value="number">Number</option>
                      <option value="percentage">Percentage</option>
                      <option value="text">Text</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select value={indForm.Dept_ID} onChange={e => setIndForm({ ...indForm, Dept_ID: e.target.value })} required>
                      <option value="">Select department...</option>
                      {departments.map(d => <option key={d.ROWID} value={d.ROWID}>{d.Dept_Name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Indicator</button>
                </div>
              </form>
            )}

            {activeTab === 'users' && (
              <form onSubmit={handleCreateUser} className="modal-body">
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} placeholder="e.g., Dr. Rajesh Thakur" required />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" value={userForm.email_id} onChange={e => setUserForm({ ...userForm, email_id: e.target.value })} placeholder="name@healthconnect.gov.in" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value as UserRole })}>
                      {ALL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Facility</label>
                    <select value={userForm.facility_id} onChange={e => setUserForm({ ...userForm, facility_id: e.target.value })} required>
                      <option value="">Select facility...</option>
                      {facilities.map(f => <option key={f.ROWID} value={f.ROWID}>{f.Facility_Name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Password (optional)</label>
                  <input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} placeholder="Leave blank to auto-generate" />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create User</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
