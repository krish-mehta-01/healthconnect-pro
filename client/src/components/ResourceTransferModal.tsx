import { useState, useEffect } from 'react';
import { getSupplyRequests, getFacilityInventory, transferInventory, getInventoryMaster, getFacilities } from '../services/api';
import { PackageOpen, ArrowRightLeft, CheckCircle, X, AlertTriangle } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

export default function ResourceTransferModal() {
  const [requests, setRequests] = useState<any[]>([]);
  const [inventoryMaster, setInventoryMaster] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeRequest, setActiveRequest] = useState<any | null>(null);
  const [surplusOptions, setSurplusOptions] = useState<any[]>([]);
  const [transferring, setTransferring] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqs, invMaster, facs] = await Promise.all([
        getSupplyRequests(),
        getInventoryMaster(),
        getFacilities()
      ]);
      setRequests(reqs.filter((r: any) => r.Status === 'Pending' || r.Status === 'PENDING'));
      setInventoryMaster(invMaster);
      setFacilities(facs);
    } catch (err) {
      console.error('Failed to load supply requests', err);
    } finally {
      setLoading(false);
    }
  };

  const openReRouteModal = async (req: any) => {
    setActiveRequest(req);
    try {
      const allInventory = await getFacilityInventory();
      // Find facilities that have surplus (current > min threshold + requested)
      const options = allInventory.filter(inv => 
        inv.Item_ID === req.Item_ID && 
        inv.Facility_ID !== req.Facility_ID &&
        Number(inv.Current_Stock) >= Number(req.Quantity_Requested)
      ).map(inv => {
        const fac = facilities.find(f => f.ROWID === inv.Facility_ID);
        return {
          facility_id: inv.Facility_ID,
          facility_name: fac?.Facility_Name || 'Unknown Facility',
          stock: inv.Current_Stock
        };
      });
      setSurplusOptions(options);
    } catch (err) {
      console.error('Failed to find surplus', err);
    }
  };

  const handleTransfer = async (originFacilityId: string) => {
    setTransferring(true);
    try {
      await transferInventory({
        origin_facility_id: originFacilityId,
        destination_facility_id: activeRequest.Facility_ID,
        item_id: activeRequest.Item_ID,
        quantity: Number(activeRequest.Quantity_Requested),
        request_id: activeRequest.ROWID
      });
      setSuccessMsg('Resources re-routed successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        setActiveRequest(null);
        loadData();
      }, 2000);
    } catch (err: any) {
      alert('Transfer failed: ' + err.message);
    } finally {
      setTransferring(false);
    }
  };

  if (loading) return <LoadingSpinner message="Checking supply chain..." />;
  if (requests.length === 0) return null;

  return (
    <>
      <div className="card" style={{ marginBottom: '2rem', borderColor: 'var(--color-primary)' }}>
        <div className="card-header" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <PackageOpen size={20} color="var(--color-primary)" />
          <h3 style={{ color: 'var(--color-primary)' }}>Smart Resource Re-Routing</h3>
        </div>
        <div className="card-body">
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
            AI has detected pending supply requests that can be fulfilled by nearby facilities with surplus stock.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {requests.map(req => {
              const fac = facilities.find(f => f.ROWID === req.Facility_ID);
              const item = inventoryMaster.find(i => i.ROWID === req.Item_ID);
              return (
                <div key={req.ROWID} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{fac?.Facility_Name} requests {req.Quantity_Requested} {item?.Item_Name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Request ID: #{req.ROWID}</div>
                  </div>
                  <button className="btn btn-primary" onClick={() => openReRouteModal(req)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <ArrowRightLeft size={16} /> Smart Re-Route
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {activeRequest && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', margin: '1rem', background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-xl)' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3>Re-Route Approval</h3>
              <button onClick={() => setActiveRequest(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div className="card-body">
              {successMsg ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0', color: '#10b981' }}>
                  <CheckCircle size={48} />
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{successMsg}</div>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div style={{ fontWeight: 600 }}>Fulfill Request For:</div>
                    <div style={{ fontSize: '0.95rem' }}>{facilities.find(f => f.ROWID === activeRequest.Facility_ID)?.Facility_Name}</div>
                    <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>Item:</div>
                    <div style={{ fontSize: '0.95rem' }}>{activeRequest.Quantity_Requested} x {inventoryMaster.find(i => i.ROWID === activeRequest.Item_ID)?.Item_Name}</div>
                  </div>

                  <h4 style={{ marginBottom: '1rem' }}>Available Surplus Sources</h4>
                  {surplusOptions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {surplusOptions.map(opt => (
                        <div key={opt.facility_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{opt.facility_name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Current Stock: {opt.stock}</div>
                          </div>
                          <button 
                            className="btn btn-outline" 
                            onClick={() => handleTransfer(opt.facility_id)}
                            disabled={transferring}
                          >
                            {transferring ? 'Routing...' : 'Approve Transfer'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#f59e0b', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px' }}>
                      <AlertTriangle size={20} />
                      No facilities have enough surplus stock.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
