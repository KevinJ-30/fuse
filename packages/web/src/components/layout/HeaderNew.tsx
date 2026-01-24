import { useLocation } from 'react-router-dom';
import { StatusBadge } from '../ui/StatusBadge';
import './HeaderNew.css';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/approvals': 'Approval Queue',
  '/executions': 'Execution Graph',
  '/breakers': 'Emergency Stops',
  '/policies': 'Policies',
  '/rollbacks': 'Rollback History',
};

export default function HeaderNew() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Relay';

  // Only show title on non-dashboard pages
  const showTitle = location.pathname !== '/dashboard';

  return (
    <header className="header-new">
      <div className="header-content">
        {showTitle && <h2 className="header-title">{title}</h2>}

        <div className="header-actions">
          <StatusBadge status="connected" size="sm" pulse />

          <div className="header-user">
            <div className="header-user-avatar">AD</div>
            <span className="header-user-name">Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
