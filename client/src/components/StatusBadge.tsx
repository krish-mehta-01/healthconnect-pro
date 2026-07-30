import type { ReportStatus } from '../types';

interface Props {
  status: ReportStatus | string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const statusClass = status.toLowerCase().replace(/\s+/g, '-');
  return (
    <span className={`status-badge status-${statusClass} status-${size}`}>
      {status}
    </span>
  );
}
