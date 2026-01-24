import { ReactNode } from 'react';
import './Metric.css';

interface MetricProps {
  label: string;
  value: string | number;
  delta?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  suffix?: string;
  description?: string;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'danger' | 'success';
}

export function Metric({
  label,
  value,
  delta,
  suffix,
  description,
  icon,
  size = 'md',
  variant = 'default',
}: MetricProps) {
  const sizeClass = size === 'lg' ? 'metric-lg' : size === 'sm' ? 'metric-sm' : 'metric-md';
  const variantClass = `metric-${variant}`;

  return (
    <div className={`metric ${sizeClass} ${variantClass}`}>
      {icon && <div className="metric-icon">{icon}</div>}
      <div className="metric-content">
        <div className="metric-label">{label}</div>
        <div className="metric-value-row">
          <span className="metric-value">
            {value}
            {suffix && <span className="metric-suffix">{suffix}</span>}
          </span>
          {delta && (
            <span className={`metric-delta metric-delta-${delta.trend}`}>
              {delta.trend === 'up' && '↑'}
              {delta.trend === 'down' && '↓'}
              {Math.abs(delta.value)}%
            </span>
          )}
        </div>
        {description && <div className="metric-description">{description}</div>}
      </div>
    </div>
  );
}
