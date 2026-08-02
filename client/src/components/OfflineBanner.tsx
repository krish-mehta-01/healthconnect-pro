import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { getQueue, subscribeToQueue, flushQueue } from '../utils/offlineQueue';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getQueue().length);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const unsubscribe = subscribeToQueue(() => setPendingCount(getQueue().length));
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'white',
        background: isOnline ? 'var(--color-warning)' : '#64748b',
      }}
    >
      {isOnline ? (
        <>
          <RefreshCw size={16} />
          {pendingCount} action{pendingCount === 1 ? '' : 's'} waiting to sync — syncing now...
        </>
      ) : (
        <>
          <WifiOff size={16} />
          You're offline — reports and patient registrations will be saved and sent automatically once you're back online
          {pendingCount > 0 ? ` (${pendingCount} pending)` : ''}
        </>
      )}
    </div>
  );
}
