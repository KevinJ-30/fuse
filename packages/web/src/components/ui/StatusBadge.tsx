import './StatusBadge.css';

interface StatusBadgeProps {
  status: 'connected' | 'degraded' | 'down' | 'active' | 'inactive';
  pulse?: boolean;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, pulse = false, size = 'md' }: StatusBadgeProps) {
  const sizeClass = size === 'sm' ? 'status-badge-sm' : '';
  const pulseClass = pulse ? 'status-badge-pulse' : '';

  return (
    <div className={`status-badge status-badge-${status} ${sizeClass} ${pulseClass}`}>
      <span className="status-badge-dot" />
      <span className="status-badge-label">{status}</span>
    </div>
  );
}
