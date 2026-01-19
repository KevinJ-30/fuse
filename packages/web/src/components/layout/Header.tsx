import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/approvals': 'Approval Queue',
  '/executions': 'Execution Graph',
  '/breakers': 'Emergency Stops',
  '/policies': 'Policies',
  '/rollbacks': 'Rollback History',
};

export default function Header() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Relay';

  return (
    <header className="bg-white shadow-sm">
      <div className="flex items-center justify-between h-16 px-6">
        <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Connected</span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-gray-700">AD</span>
            </div>
            <span className="text-sm text-gray-700">Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
