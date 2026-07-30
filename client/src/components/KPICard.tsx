import type { ReactNode } from 'react';

interface Props {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
  color?: string;
}

export default function KPICard({ title, value, icon, trend, color }: Props) {
  return (
    <div className="kpi-card" style={color ? { '--kpi-accent': color } as React.CSSProperties : undefined}>
      <div className="kpi-card-header">
        <div className="kpi-icon">{icon}</div>
        {trend && (
          <span className={`kpi-trend ${trend.positive ? 'positive' : 'negative'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-title">{title}</div>
    </div>
  );
}
