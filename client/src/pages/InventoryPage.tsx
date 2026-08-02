import { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchInventoryMaster, fetchFacilityInventory, fetchSupplyRequests } from '../store/inventorySlice';
import { fetchFacilities } from '../store/facilitiesSlice';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import {
  Package, AlertTriangle, Plus, X, Send,
  TrendingDown, CheckCircle, ShoppingCart
} from 'lucide-react';
import { createSupplyRequest, createInventoryItem, updateFacilityStock } from '../services/api';
import { canWrite, canCreateSupplyRequest, canUpdateStock, isStateAdmin } from '../utils/permissions';

export default function InventoryPage() {
  const dispatch = useAppDispatch();
  const { masterItems, facilityStock, supplyRequests, loading } = useAppSelector(s => s.inventory);
  const { items: facilities } = useAppSelector(s => s.facilities);
  const { user } = useAppSelector(s => s.auth);
  // Reorder Watch is a Pharmacist/State_Admin planning view — not the officer-review roles,
  // Facility_Staff, Data_Entry_Clerk, or Auditor.
  const canSeeReorderWatch = user?.role === 'Pharmacist' || isStateAdmin(user?.role);
  const canEditStock = canUpdateStock(user?.role) && canWrite(user?.role);
  const [activeTab, setActiveTab] = useState<'stock' | 'requests' | 'master' | 'reorder'>('stock');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [newItem, setNewItem] = useState({ Item_Name: '', Category: 'Consumables', Minimum_Threshold: 10 });
  const [newRequest, setNewRequest] = useState({ Facility_ID: '', Item_ID: '', Quantity_Requested: 0 });
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockValue, setStockValue] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  useEffect(() => {
    dispatch(fetchInventoryMaster());
    dispatch(fetchFacilityInventory());
    dispatch(fetchSupplyRequests());
    dispatch(fetchFacilities());
  }, [dispatch]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    await createInventoryItem(newItem);
    dispatch(fetchInventoryMaster());
    setShowAddItem(false);
    setNewItem({ Item_Name: '', Category: 'Medical Supplies', Minimum_Threshold: 10 });
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSupplyRequest(newRequest);
    dispatch(fetchSupplyRequests());
    setShowRequest(false);
  };

  const startEditStock = (id: string, currentStock: number | string) => {
    setEditingStockId(id);
    setStockValue(String(currentStock));
  };

  const handleSaveStock = async (id: string) => {
    setSavingStock(true);
    try {
      await updateFacilityStock(id, Number(stockValue));
      dispatch(fetchFacilityInventory());
      setEditingStockId(null);
    } catch (err) {
      console.error('Failed to update stock:', err);
      alert('Failed to update stock. Please try again.');
    } finally {
      setSavingStock(false);
    }
  };

  if (loading && masterItems.length === 0) return <LoadingSpinner message="Loading inventory..." />;

  const lowStockItems = facilityStock.filter(fs => {
    const master = masterItems.find(m => m.ROWID === fs.Item_ID);
    return master && Number(fs.Current_Stock) < Number(master.Minimum_Threshold);
  });

  // Reorder Watch — items not yet below threshold (those are already the Low Stock alert
  // above) but trending toward it: Current_Stock < Minimum_Threshold * 1.5. Sorted ascending
  // by how close they are to the threshold (smallest margin first = most urgent).
  const reorderWatchItems = facilityStock
    .map(fs => {
      const master = masterItems.find(m => m.ROWID === fs.Item_ID);
      if (!master) return null;
      const current = Number(fs.Current_Stock);
      const threshold = Number(master.Minimum_Threshold);
      if (!(current >= threshold)) return null; // already below threshold — shown in Low Stock alert instead
      if (!(current < threshold * 1.5)) return null; // not within reorder watch range
      const margin = current - threshold;
      const ratio = threshold > 0 ? margin / threshold : 0;
      const urgency: 'Reorder soon' | 'Monitor' = ratio <= 0.2 ? 'Reorder soon' : 'Monitor';
      return { fs, master, current, threshold, margin, urgency };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.margin - b.margin);

  const facilityNameById = (id: string) => facilities.find(f => f.ROWID === id)?.Facility_Name || id;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Management</h1>
          <p className="page-subtitle">Track medical supplies & manage procurement requests</p>
        </div>
        <div className="header-actions">
          {canCreateSupplyRequest(user?.role) && canWrite(user?.role) && (
            <button className="btn btn-outline" onClick={() => setShowRequest(true)}>
              <Send size={18} /> Supply Request
            </button>
          )}
          {isStateAdmin(user?.role) && canWrite(user?.role) && (
            <button className="btn btn-primary" onClick={() => setShowAddItem(true)}>
              <Plus size={18} /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="alert-banner alert-warning">
          <AlertTriangle size={20} />
          <span><strong>{lowStockItems.length} item(s)</strong> below minimum threshold!</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>
          <Package size={16} /> Facility Stock
        </button>
        <button className={`tab ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
          <Send size={16} /> Supply Requests
        </button>
        <button className={`tab ${activeTab === 'master' ? 'active' : ''}`} onClick={() => setActiveTab('master')}>
          <CheckCircle size={16} /> Master Items
        </button>
        {canSeeReorderWatch && (
          <button className={`tab ${activeTab === 'reorder' ? 'active' : ''}`} onClick={() => setActiveTab('reorder')}>
            <ShoppingCart size={16} /> Reorder Watch
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'stock' && (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Item</th>
                  <th>Current Stock</th>
                  <th>Threshold</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  {canEditStock && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {facilityStock.length > 0 ? facilityStock.map(fs => {
                  const master = masterItems.find(m => m.ROWID === fs.Item_ID);
                  const isLow = master && Number(fs.Current_Stock) < Number(master.Minimum_Threshold);
                  const isEditing = editingStockId === fs.ROWID;
                  return (
                    <tr key={fs.ROWID} className={isLow ? 'row-warning' : ''}>
                      <td>{fs.Facility_ID}</td>
                      <td>{master?.Item_Name || fs.Item_ID}</td>
                      <td className="td-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={stockValue}
                            onChange={e => setStockValue(e.target.value)}
                            style={{ width: '80px', padding: '0.35rem', borderRadius: '6px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                          />
                        ) : fs.Current_Stock}
                      </td>
                      <td className="td-mono">{master?.Minimum_Threshold || '—'}</td>
                      <td>
                        {isLow ? (
                          <span className="stock-low"><TrendingDown size={14} /> Low</span>
                        ) : (
                          <span className="stock-ok"><CheckCircle size={14} /> OK</span>
                        )}
                      </td>
                      <td>{fs.Last_Updated || '—'}</td>
                      {canEditStock && (
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button className="btn btn-outline" style={{ padding: '0.3rem 0.6rem' }} disabled={savingStock} onClick={() => handleSaveStock(fs.ROWID)}>Save</button>
                              <button className="btn btn-ghost" style={{ padding: '0.3rem 0.6rem' }} onClick={() => setEditingStockId(null)}>Cancel</button>
                            </div>
                          ) : (
                            <button className="btn btn-outline" style={{ padding: '0.3rem 0.6rem' }} onClick={() => startEditStock(fs.ROWID, fs.Current_Stock)}>Update</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={canEditStock ? 7 : 6} className="empty-state">No inventory data recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Facility</th>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {supplyRequests.length > 0 ? supplyRequests.map(req => (
                  <tr key={req.ROWID}>
                    <td className="td-mono">#{req.ROWID}</td>
                    <td>{req.Facility_ID}</td>
                    <td>{masterItems.find(m => m.ROWID === req.Item_ID)?.Item_Name || req.Item_ID}</td>
                    <td className="td-mono">{req.Quantity_Requested}</td>
                    <td><StatusBadge status={req.Status} size="sm" /></td>
                    <td>{req.CREATEDTIME ? new Date(req.CREATEDTIME).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="empty-state">No supply requests.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'master' && (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Min. Threshold</th>
                </tr>
              </thead>
              <tbody>
                {masterItems.length > 0 ? masterItems.map(item => (
                  <tr key={item.ROWID}>
                    <td>{item.Item_Name}</td>
                    <td>{item.Category}</td>
                    <td className="td-mono">{item.Minimum_Threshold}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="empty-state">No master items. Add items to track inventory.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'reorder' && canSeeReorderWatch && (
        <div className="card">
          <div className="card-header">
            <h3>Reorder Watch</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Item</th>
                  <th>Current Stock</th>
                  <th>Threshold</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {reorderWatchItems.length > 0 ? reorderWatchItems.map(({ fs, master, current, threshold, urgency }) => (
                  <tr key={fs.ROWID}>
                    <td>{facilityNameById(fs.Facility_ID)}</td>
                    <td>{master.Item_Name}</td>
                    <td className="td-mono">{current}</td>
                    <td className="td-mono">{threshold}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--text-xs)', fontWeight: 600, color: urgency === 'Reorder soon' ? 'var(--color-warning)' : 'var(--color-info)' }}>
                        <AlertTriangle size={14} /> {urgency}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="empty-state">No items approaching their reorder threshold.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="modal-overlay" onClick={() => setShowAddItem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Inventory Item</h2>
              <button className="btn-icon" onClick={() => setShowAddItem(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddItem} className="modal-body">
              <div className="form-group">
                <label>Item Name</label>
                <input type="text" value={newItem.Item_Name} onChange={e => setNewItem({ ...newItem, Item_Name: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select value={newItem.Category} onChange={e => setNewItem({ ...newItem, Category: e.target.value })}>
                    <option>Consumables</option>
                    <option>Medicines</option>
                    <option>Equipment</option>
                    <option>PPE</option>
                    <option>Laboratory</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Min. Threshold</label>
                  <input type="number" value={newItem.Minimum_Threshold} onChange={e => setNewItem({ ...newItem, Minimum_Threshold: Number(e.target.value) })} min={0} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddItem(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supply Request Modal */}
      {showRequest && (
        <div className="modal-overlay" onClick={() => setShowRequest(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Supply Request</h2>
              <button className="btn-icon" onClick={() => setShowRequest(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateRequest} className="modal-body">
              <div className="form-group">
                <label>Facility</label>
                <select value={newRequest.Facility_ID} onChange={e => setNewRequest({ ...newRequest, Facility_ID: e.target.value })} required>
                  <option value="">Select facility...</option>
                  {facilities.map(f => <option key={f.ROWID} value={f.ROWID}>{f.Facility_Name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Item</label>
                <select value={newRequest.Item_ID} onChange={e => setNewRequest({ ...newRequest, Item_ID: e.target.value })} required>
                  <option value="">Select item...</option>
                  {masterItems.map(i => <option key={i.ROWID} value={i.ROWID}>{i.Item_Name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input type="number" value={newRequest.Quantity_Requested} onChange={e => setNewRequest({ ...newRequest, Quantity_Requested: Number(e.target.value) })} min={1} required />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowRequest(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
