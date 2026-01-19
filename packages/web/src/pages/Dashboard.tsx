import { useState, useEffect } from 'react';
import apiClient from '../lib/api';
import { getSocket } from '../lib/socket';

interface DashboardStats {
  executions: {
    total: number;
    byStatus: Record<string, number>;
  };
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  avgRiskScore: number;
  detection: {
    ruleViolations: number;
    anomalies: number;
    semanticConcerns: number;
    detectionRate: number;
  };
  activeBreakers: number;
  approvals: {
    total: number;
    approved: number;
    rate: number;
  };
  rollbacks: number;
  topAgents: Array<{ agentId: string; count: number }>;
  topTools: Array<{ tool: string; count: number }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    loadStats();

    // Set up Socket.io listeners for real-time updates
    const socket = getSocket();
    socket.on('execution:new', loadStats);
    socket.on('execution:updated', loadStats);
    socket.on('breaker:created', loadStats);
    socket.on('breaker:toggled', loadStats);

    return () => {
      socket.off('execution:new');
      socket.off('execution:updated');
      socket.off('breaker:created');
      socket.off('breaker:toggled');
    };
  }, [timeRange]);

  const loadStats = async () => {
    try {
      const response = await apiClient.get(`/api/analytics/dashboard?timeRange=${timeRange}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error loading dashboard stats</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Executions" value={stats.executions.total.toString()} color="blue" />
        <StatCard
          title="Approval Rate"
          value={stats.approvals.rate > 0 ? `${stats.approvals.rate}%` : 'N/A'}
          color="green"
        />
        <StatCard title="Active Breakers" value={stats.activeBreakers.toString()} color="red" />
        <StatCard title="Recent Rollbacks" value={stats.rollbacks.toString()} color="yellow" />
      </div>

      {/* Detection Stats */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Detection Layer Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <DetectionStat
            label="Rule Violations"
            value={stats.detection.ruleViolations}
            color="orange"
          />
          <DetectionStat label="Anomalies Detected" value={stats.detection.anomalies} color="purple" />
          <DetectionStat
            label="Semantic Concerns"
            value={stats.detection.semanticConcerns}
            color="red"
          />
          <DetectionStat
            label="Detection Rate"
            value={`${stats.detection.detectionRate}%`}
            color="blue"
          />
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Average Risk Score:</span>
            <RiskBadge score={stats.avgRiskScore} />
          </div>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Risk Score Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <RiskDistributionCard
            label="Low"
            count={stats.riskDistribution.low}
            color="bg-green-100 text-green-800"
          />
          <RiskDistributionCard
            label="Medium"
            count={stats.riskDistribution.medium}
            color="bg-yellow-100 text-yellow-800"
          />
          <RiskDistributionCard
            label="High"
            count={stats.riskDistribution.high}
            color="bg-orange-100 text-orange-800"
          />
          <RiskDistributionCard
            label="Critical"
            count={stats.riskDistribution.critical}
            color="bg-red-100 text-red-800"
          />
        </div>
      </div>

      {/* Top Agents and Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Top Agents</h3>
          {stats.topAgents.length > 0 ? (
            <div className="space-y-2">
              {stats.topAgents.map((agent) => (
                <div key={agent.agentId} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{agent.agentId}</span>
                  <span className="text-sm text-gray-500">{agent.count} executions</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data yet</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Top Tools</h3>
          {stats.topTools.length > 0 ? (
            <div className="space-y-2">
              {stats.topTools.map((tool) => (
                <div key={tool.tool} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{tool.tool}</span>
                  <span className="text-sm text-gray-500">{tool.count} executions</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>
        {value}
      </p>
    </div>
  );
}

function DetectionStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  const colorClasses = {
    orange: 'text-orange-600',
    purple: 'text-purple-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  };

  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>
        {value}
      </div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  let color = 'bg-green-100 text-green-800';
  let label = 'Low';

  if (score >= 0.95) {
    color = 'bg-red-100 text-red-800';
    label = 'Critical';
  } else if (score >= 0.6) {
    color = 'bg-orange-100 text-orange-800';
    label = 'High';
  } else if (score >= 0.3) {
    color = 'bg-yellow-100 text-yellow-800';
    label = 'Medium';
  }

  return (
    <span className={`px-3 py-1 text-sm font-medium rounded-full ${color}`}>
      {score.toFixed(2)} - {label}
    </span>
  );
}

function RiskDistributionCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="text-center p-4 bg-gray-50 rounded-lg">
      <div className={`text-2xl font-bold ${color}`}>{count}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  );
}
