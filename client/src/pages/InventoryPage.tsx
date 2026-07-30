import { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchInventoryMaster, fetchFacilityInventory, fetchSupplyRequests } from '../store/inventorySlice';
import { fetchFacilities } from '../store/facilitiesSlice';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import {
  Package, AlertTriangle, Plus, X, Send,
  TrendingDown, CheckCircle
} from 'lucide-react';
import { createSupplyRequest, createInventoryItem } from '../services/api';

export default function InventoryPage() {
  const dispatch = useAppDispatch();
  const { masterItems, facilityStock, supplyRequests, loading } = useAppSelector(s => s.inventory);
  const { items: facilities } = useAppSelector(s => s.facilities);
  const { user } = useAppSelector(s => s.auth);
  const [activeTab, setActiveTab] = useState<'stock' | 'requests' | 'master'>('stock');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [newItem, setNewItem] = useState({ Item_Name: '', Category: 'Medical Supplies', Minimum_Threshold: 10 });
  const [newRequest, setNewRequest] = useState({ Facility_ID: '', Item_ID: '', Quantity_Requested: 0 });

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

  if (loading && masterItems.length === 0) return <LoadingSpinner message="Loading inventory..." />;

  const lowStockItems = facilityStock.filter(fs => {
    const master = masterItems.find(m => m.ROWID === fs.Item_ID);
    return master && Number(fs.Current_Stock) < Number(master.Minimum_Threshold);
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Management</h1>
          <p className="page-subtitle">Track medical supplies & manage procurement requests</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={() => setShowRequest(true)}>
            <Send size={18} /> Supply Request
          </button>
          {user?.role === 'State_Admin' && (
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
                </tr>
              </thead>
              <tbody>
                {facilityStock.length > 0 ? facilityStock.map(fs => {
                  const master = masterItems.find(m => m.ROWID === fs.Item_ID);
                  const isLow = master && Number(fs.Current_Stock) < Number(master.Minimum_Threshold);
                  return (
                    <tr key={fs.ROWID} className={isLow ? 'row-warning' : ''}>
                      <td>{fs.Facility_ID}</td>
                      <td>{master?.Item_Name || fs.Item_ID}</td>
                      <td className="td-mono">{fs.Current_Stock}</td>
                      <td className="td-mono">{master?.Minimum_Threshold || '—'}</td>
                      <td>
                        {isLow ? (
                          <span className="stock-low"><TrendingDown size={14} /> Low</span>
                        ) : (
                          <span className="stock-ok"><CheckCircle size={14} /> OK</span>
                        )}
                      </td>
                      <td>{fs.Last_Updated || '—'}</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={6} className="empty-state">No inventory data recorded yet.</td></tr>
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
                    <option>Medical Supplies</option>
                    <option>Pharmaceuticals</option>
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
