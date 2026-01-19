import { Link, useLocation } from 'react-router-dom';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Approval Queue', href: '/approvals', icon: '✋' },
  { name: 'Execution Graph', href: '/executions', icon: '🌳' },
  { name: 'Emergency Stops', href: '/breakers', icon: '🛑' },
  { name: 'Policies', href: '/policies', icon: '📋' },
  { name: 'Rollbacks', href: '/rollbacks', icon: '⏮️' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="flex flex-col w-64 bg-gray-900">
      <div className="flex items-center justify-center h-16 px-4 bg-gray-800">
        <h1 className="text-2xl font-bold text-white">Relay</h1>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-400">
          <p>Relay MVP v0.1.0</p>
          <p className="mt-1">AI Agent Safety Layer</p>
        </div>
      </div>
    </div>
  );
}
