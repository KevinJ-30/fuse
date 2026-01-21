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
        <div className="text-gray-400">Loading dashboard...</div>
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
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Executions" value={stats.executions.total.toString()} />
        <StatCard
          title="Approval Rate"
          value={stats.approvals.rate > 0 ? `${stats.approvals.rate}%` : 'N/A'}
        />
        <StatCard title="Active Breakers" value={stats.activeBreakers.toString()} highlight />
        <StatCard title="Recent Rollbacks" value={stats.rollbacks.toString()} />
      </div>

      {/* Detection Stats */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4 text-white">Detection Layer Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <DetectionStat
            label="Rule Violations"
            value={stats.detection.ruleViolations}
          />
          <DetectionStat label="Anomalies Detected" value={stats.detection.anomalies} />
          <DetectionStat
            label="Semantic Concerns"
            value={stats.detection.semanticConcerns}
          />
          <DetectionStat
            label="Detection Rate"
            value={`${stats.detection.detectionRate}%`}
          />
        </div>
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">Average Risk Score:</span>
            <RiskBadge score={stats.avgRiskScore} />
          </div>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4 text-white">Risk Score Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <RiskDistributionCard
            label="Low"
            count={stats.riskDistribution.low}
          />
          <RiskDistributionCard
            label="Medium"
            count={stats.riskDistribution.medium}
          />
          <RiskDistributionCard
            label="High"
            count={stats.riskDistribution.high}
          />
          <RiskDistributionCard
            label="Critical"
            count={stats.riskDistribution.critical}
          />
        </div>
      </div>

      {/* Top Agents and Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-white">Top Agents</h3>
          {stats.topAgents.length > 0 ? (
            <div className="space-y-2">
              {stats.topAgents.map((agent) => (
                <div key={agent.agentId} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{agent.agentId}</span>
                  <span className="text-sm text-gray-500">{agent.count} executions</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data yet</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-white">Top Tools</h3>
          {stats.topTools.length > 0 ? (
            <div className="space-y-2">
              {stats.topTools.map((tool) => (
                <div key={tool.tool} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-300">{tool.tool}</span>
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

function StatCard({ title, value, highlight }: { title: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-400 mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${highlight ? 'text-red-500' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}

function DetectionStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-red-500">
        {value}
      </div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  let color = 'bg-gray-800 text-gray-300 border-gray-700';
  let label = 'Low';

  if (score >= 0.95) {
    color = 'bg-red-950 text-red-400 border-red-800';
    label = 'Critical';
  } else if (score >= 0.6) {
    color = 'bg-red-950 text-red-500 border-red-800';
    label = 'High';
  } else if (score >= 0.3) {
    color = 'bg-gray-800 text-gray-300 border-gray-700';
    label = 'Medium';
  }

  return (
    <span className={`px-3 py-1 text-sm font-medium rounded-full border ${color}`}>
      {score.toFixed(2)} - {label}
    </span>
  );
}

function RiskDistributionCard({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  const isHighRisk = label === 'High' || label === 'Critical';

  return (
    <div className="text-center p-4 bg-black border border-gray-800 rounded-lg">
      <div className={`text-2xl font-bold ${isHighRisk ? 'text-red-500' : 'text-gray-300'}`}>{count}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  );
}
