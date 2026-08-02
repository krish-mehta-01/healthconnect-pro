import { useEffect, useState } from 'react';
import { useAppSelector } from '../store/hooks';
import LoadingSpinner from '../components/LoadingSpinner';
import { Users, Plus, X, Pencil } from 'lucide-react';
import { getPatients, createPatient, updatePatient } from '../services/api';
import { canWrite, canRegisterPatient, canEditPatient } from '../utils/permissions';
import { enqueue, isNetworkError, registerQueueHandler } from '../utils/offlineQueue';
import type { Patient } from '../types';

// Only new registrations are queued offline, not edits — an edit needs the current record
// to diff against, which is a more complex offline scenario intentionally left out of this
// pass (see the offline-first plan: the highest-value case is a field worker registering a
// new patient with no signal, not editing one).
registerQueueHandler('createPatient', (payload) => createPatient(payload));

const emptyForm = { Patient_Name: '', Age: '', Gender: 'Male' };

export default function PatientsPage() {
  const { user } = useAppSelector(s => s.auth);
  const canCreate = canRegisterPatient(user?.role) && canWrite(user?.role);
  const canEdit = canEditPatient(user?.role) && canWrite(user?.role);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [queuedMessage, setQueuedMessage] = useState(false);

  const loadPatients = () => {
    setLoading(true);
    getPatients()
      .then(setPatients)
      .catch(err => console.error('Failed to load patients:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (p: Patient) => {
    setEditingId(p.ROWID);
    setForm({ Patient_Name: p.Patient_Name, Age: String(p.Age ?? ''), Gender: p.Gender || 'Male' });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Editing an existing record always needs a live connection (see registerQueueHandler
    // comment above) — only new-registration is offline-queueable.
    if (!editingId && !navigator.onLine) {
      enqueue('createPatient', form);
      setShowForm(false);
      setSubmitting(false);
      setQueuedMessage(true);
      setTimeout(() => setQueuedMessage(false), 4000);
      return;
    }

    try {
      if (editingId) {
        await updatePatient(editingId, form);
      } else {
        await createPatient(form);
      }
      setShowForm(false);
      loadPatients();
    } catch (err) {
      if (!editingId && isNetworkError(err)) {
        enqueue('createPatient', form);
        setShowForm(false);
        setQueuedMessage(true);
        setTimeout(() => setQueuedMessage(false), 4000);
      } else {
        console.error('Failed to save patient:', err);
        alert(err instanceof Error ? err.message : 'Failed to save patient. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading patients..." />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Patients</h1>
          <p className="page-subtitle">
            <Users size={16} /> Patient registry for your facility
          </p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} /> Register Patient
          </button>
        )}
      </div>

      {queuedMessage && (
        <div className="alert-banner alert-warning">
          Saved on this device — this patient will be registered automatically once you're back online.
        </div>
      )}

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Gender</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {patients.length > 0 ? patients.map(p => (
                <tr key={p.ROWID}>
                  <td>{p.Patient_Name}</td>
                  <td className="td-mono">{p.Age}</td>
                  <td>{p.Gender}</td>
                  {canEdit && (
                    <td>
                      <button className="btn-icon" onClick={() => openEdit(p)} title="Edit patient record">
                        <Pencil size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              )) : (
                <tr><td colSpan={canEdit ? 4 : 3} className="empty-state">No patients registered yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Patient Record' : 'Register New Patient'}</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label htmlFor="pat-name">Full Name</label>
                <input
                  id="pat-name"
                  type="text"
                  value={form.Patient_Name}
                  onChange={e => setForm({ ...form, Patient_Name: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="pat-age">Age</label>
                  <input
                    id="pat-age"
                    type="number"
                    min={0}
                    value={form.Age}
                    onChange={e => setForm({ ...form, Age: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="pat-gender">Gender</label>
                  <select id="pat-gender" value={form.Gender} onChange={e => setForm({ ...form, Gender: e.target.value })}>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
