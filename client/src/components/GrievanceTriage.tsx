import { useState, useEffect } from 'react';
import { getEscalatedGrievances, getFacilities, getPatients } from '../services/api';
import { AlertOctagon, TrendingDown, Clock, ShieldAlert } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { useAppSelector } from '../store/hooks';
import { canWrite } from '../utils/permissions';

export default function GrievanceTriage() {
  const { user } = useAppSelector(s => s.auth);
  const [grievances, setGrievances] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [alerts, facs, pats] = await Promise.all([
          getEscalatedGrievances(),
          getFacilities(),
          getPatients()
        ]);
        setGrievances(alerts);
        setFacilities(facs);
        setPatients(pats);
      } catch (err) {
        console.error('Failed to load escalated grievances', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner message="Scanning feedback..." />;
  if (grievances.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: '2rem', borderColor: '#ef4444' }}>
      <div className="card-header" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(239, 68, 68, 0.05)' }}>
        <AlertOctagon size={20} color="#ef4444" />
        <h3 style={{ color: '#ef4444' }}>High-Urgency Grievance Auto-Escalation</h3>
      </div>
      <div className="card-body">
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Zia AI has flagged the following feedback as highly negative or urgent. Immediate action required.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {grievances.map(g => {
            const fac = facilities.find(f => f.ROWID === g.Facility_ID);
            const pat = patients.find(p => p.ROWID === g.Patient_ID);
            return (
              <div key={g.ROWID} style={{ borderLeft: '4px solid #ef4444', background: 'var(--color-bg-secondary)', padding: '1rem', borderRadius: '4px 8px 8px 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 600 }}>{fac?.Facility_Name || 'Unknown Facility'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                    <TrendingDown size={14} /> Score: {Number(g.Sentiment_Score).toFixed(2)}
                  </div>
                </div>
                
                <div style={{ fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
                  "{g.Feedback_Text}"
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ShieldAlert size={14} /> Patient: {pat?.Patient_Name || 'Anonymous'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={14} /> {g.Created_Date ? new Date(g.Created_Date).toLocaleDateString() : 'Recent'}</span>
                  </div>
                  {canWrite(user?.role) && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#ef4444', fontWeight: 600 }}>
                      <ShieldAlert size={14} /> Auto-escalated
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
