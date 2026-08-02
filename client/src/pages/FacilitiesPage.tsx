import { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchFacilities, addFacility, editFacility, removeFacility } from '../store/facilitiesSlice';
import LoadingSpinner from '../components/LoadingSpinner';
import { Building2, Plus, Trash2, Pencil, MapPin, Users, X } from 'lucide-react';
import type { Facility } from '../types';
import { canWrite } from '../utils/permissions';

const emptyForm: Partial<Facility> = { Facility_Name: '', Type: 'PHC', District: '', Block: '', Capacity: 50 };

export default function FacilitiesPage() {
  const dispatch = useAppDispatch();
  const { items, loading } = useAppSelector(s => s.facilities);
  const { user } = useAppSelector(s => s.auth);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Facility>>(emptyForm);

  useEffect(() => {
    dispatch(fetchFacilities());
  }, [dispatch]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (facility: Facility) => {
    setEditingId(facility.ROWID);
    setForm({ Facility_Name: facility.Facility_Name, Type: facility.Type, District: facility.District, Block: facility.Block, Capacity: facility.Capacity });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await dispatch(editFacility({ id: editingId, data: form }));
    } else {
      await dispatch(addFacility(form));
    }
    setShowForm(false);
    setForm(emptyForm);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this facility?')) {
      dispatch(removeFacility(id));
    }
  };

  const isAdmin = user?.role === 'State_Admin' && canWrite(user?.role);

  if (loading && items.length === 0) return <LoadingSpinner message="Loading facilities..." />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Facilities</h1>
          <p className="page-subtitle">Manage health centers across the state network</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} /> Add Facility
          </button>
        )}
      </div>

      {/* Stats Summary */}
      <div className="facilities-stats">
        {['HWC', 'Sub_Center', 'PHC', 'CHC', 'Sub_District_Hospital', 'District_Hospital'].map(type => {
          const count = items.filter(f => f.Type === type).length;
          return (
            <div key={type} className="facility-stat-chip">
              <span className="chip-count">{count}</span>
              <span className="chip-label">{type.replace(/_/g, ' ')}s</span>
            </div>
          );
        })}
      </div>

      {/* Facilities Grid */}
      <div className="facilities-grid">
        {items.length > 0 ? items.map(facility => (
          <div key={facility.ROWID} className="facility-card">
            <div className="facility-card-header">
              <div className="facility-type-badge">{facility.Type?.replace(/_/g, ' ')}</div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="btn-icon" onClick={() => openEdit(facility)} title="Edit">
                    <Pencil size={16} />
                  </button>
                  <button className="btn-icon btn-danger-ghost" onClick={() => handleDelete(facility.ROWID)} title="Remove">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            <h3 className="facility-name">
              <Building2 size={18} />
              {facility.Facility_Name}
            </h3>
            <div className="facility-meta">
              <span><MapPin size={14} /> {facility.District}{facility.Block ? `, ${facility.Block}` : ''}</span>
              <span><Users size={14} /> Capacity: {facility.Capacity}</span>
            </div>
          </div>
        )) : (
          <div className="empty-state-card">
            <Building2 size={48} />
            <h3>No Facilities Yet</h3>
            <p>Add your first health facility to start reporting.</p>
            {isAdmin && (
              <button className="btn btn-primary" onClick={openCreate}>
                <Plus size={18} /> Add Facility
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Facility Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Facility' : 'Onboard New Facility'}</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Facility Name</label>
                <input
                  type="text"
                  value={form.Facility_Name}
                  onChange={e => setForm({ ...form, Facility_Name: e.target.value })}
                  placeholder="e.g., PHC Tambaram"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select value={form.Type} onChange={e => setForm({ ...form, Type: e.target.value as Facility['Type'] })}>
                    <option value="HWC">Health & Wellness Centre</option>
                    <option value="Sub_Center">Sub Centre</option>
                    <option value="PHC">Primary Health Centre</option>
                    <option value="CHC">Community Health Centre</option>
                    <option value="Sub_District_Hospital">Sub-District Hospital</option>
                    <option value="District_Hospital">District Hospital</option>
                    <option value="State_Hospital">State Hospital</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Capacity (Beds)</label>
                  <input
                    type="number"
                    value={form.Capacity}
                    onChange={e => setForm({ ...form, Capacity: Number(e.target.value) })}
                    min={0}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>District</label>
                  <input
                    type="text"
                    value={form.District}
                    onChange={e => setForm({ ...form, District: e.target.value })}
                    placeholder="e.g., Kanchipuram"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Block</label>
                  <input
                    type="text"
                    value={form.Block}
                    onChange={e => setForm({ ...form, Block: e.target.value })}
                    placeholder="e.g., Tambaram"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Save Changes' : 'Create Facility'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
