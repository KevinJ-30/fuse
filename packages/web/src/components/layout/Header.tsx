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
    <header className="bg-dark-100 border-b border-gray-800 shadow-lg">
      <div className="flex items-center justify-between h-16 px-6">
        <h2 className="text-2xl font-bold text-gray-100">{title}</h2>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-dark-50 rounded-lg border border-gray-800">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-400">Connected</span>
          </div>

          <div className="flex items-center space-x-3 px-3 py-1.5 bg-dark-50 rounded-lg border border-gray-800">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold text-white">AD</span>
            </div>
            <span className="text-sm text-gray-300 font-medium">Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
