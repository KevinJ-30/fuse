import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../lib/api';
import { getSocket } from '../lib/socket';
import { Panel } from '../components/ui/Panel';
import { Metric } from '../components/ui/Metric';
import { RankedList } from '../components/ui/RankedList';
import { StatusBadge } from '../components/ui/StatusBadge';
import '../styles/tokens.css';
import './DashboardNew.css';

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

export default function DashboardNew() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    loadStats();

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
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
        <p>Loading system metrics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard-error">
        <p>Failed to load dashboard data</p>
        <button onClick={loadStats} className="retry-button">Retry</button>
      </div>
    );
  }

  const systemStatus = stats.activeBreakers > 0 ? 'degraded' : 'connected';
  const totalRisk = stats.riskDistribution.low + stats.riskDistribution.medium +
                     stats.riskDistribution.high + stats.riskDistribution.critical;

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header animate-in">
        <div>
          <h1 className="heading heading-lg">System Overview</h1>
          <p className="dashboard-subtitle">
            Last updated {Math.floor((Date.now() - lastUpdated.getTime()) / 1000)}s ago
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Hero: System Health */}
        <Panel className="dashboard-hero animate-in stagger-1" gradient="brand">
          <div className="hero-header">
            <div>
              <h2 className="heading heading-sm">System Health</h2>
              <StatusBadge status={systemStatus} pulse={systemStatus === 'connected'} />
            </div>
          </div>

          <div className="hero-metrics">
            <Metric
              label="Executions"
              value={stats.executions.total}
              size="lg"
              description={stats.executions.total === 0 ? 'No executions in this window' : `${Object.keys(stats.executions.byStatus).length} unique statuses`}
            />
            <Metric
              label="Active Breakers"
              value={stats.activeBreakers}
              size="md"
              variant={stats.activeBreakers > 0 ? 'danger' : 'default'}
              description={stats.activeBreakers > 0 ? 'Some agents are blocked' : 'All systems operational'}
            />
            <Metric
              label="Rollbacks"
              value={stats.rollbacks}
              size="md"
              description={stats.rollbacks === 0 ? 'No rollbacks needed' : 'Recovery operations performed'}
            />
          </div>

          {stats.executions.total === 0 && (
            <div className="hero-cta">
              <p>No activity detected in this time window</p>
              <button onClick={() => navigate('/executions')} className="cta-button">
                View Execution Graph
              </button>
            </div>
          )}
        </Panel>

        {/* Rail: Controls */}
        <Panel className="dashboard-rail animate-in stagger-2" hover={false}>
          <h3 className="heading heading-sm">Controls</h3>

          <div className="rail-section">
            <label className="label">Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="time-range-select"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          <div className="rail-section">
            <h4 className="label">Quick Actions</h4>
            <div className="rail-actions">
              <button onClick={() => navigate('/approvals')} className="rail-action">
                <span>Approval Queue</span>
                {stats.approvals.total > 0 && (
                  <span className="rail-action-badge">{stats.approvals.total}</span>
                )}
              </button>
              <button onClick={() => navigate('/breakers')} className="rail-action">
                <span>Emergency Stops</span>
                {stats.activeBreakers > 0 && (
                  <span className="rail-action-badge danger">{stats.activeBreakers}</span>
                )}
              </button>
              <button onClick={() => navigate('/policies')} className="rail-action">
                Policies
              </button>
            </div>
          </div>
        </Panel>

        {/* Detection Layer Narrative */}
        <Panel className="dashboard-detection animate-in stagger-3">
          <h2 className="heading heading-md">Detection Layer</h2>

          <div className="detection-statement">
            {stats.detection.anomalies === 0 && stats.detection.ruleViolations === 0 ? (
              <p className="statement-text">No anomalies detected in last {timeRange}</p>
            ) : (
              <p className="statement-text">
                {stats.detection.ruleViolations + stats.detection.anomalies} signals detected
              </p>
            )}
          </div>

          <div className="detection-metrics">
            <div className="detection-metric">
              <div className="detection-metric-value">{stats.detection.ruleViolations}</div>
              <div className="detection-metric-label">Rule Violations</div>
            </div>
            <div className="detection-metric">
              <div className="detection-metric-value">{stats.detection.anomalies}</div>
              <div className="detection-metric-label">Anomalies</div>
            </div>
            <div className="detection-metric">
              <div className="detection-metric-value">{stats.detection.semanticConcerns}</div>
              <div className="detection-metric-label">Semantic Concerns</div>
            </div>
            <div className="detection-metric">
              <div className="detection-metric-value">{stats.detection.detectionRate}%</div>
              <div className="detection-metric-label">Detection Rate</div>
            </div>
          </div>

          <div className="detection-threshold">
            <span className="label">Alert Threshold: 0.65</span>
            <span className="detection-current">
              Current avg: {stats.avgRiskScore.toFixed(2)}
              <span className={`risk-level ${getRiskLevel(stats.avgRiskScore)}`}>
                ({getRiskLabel(stats.avgRiskScore)})
              </span>
            </span>
          </div>
        </Panel>

        {/* Risk Distribution */}
        <Panel className="dashboard-risk animate-in stagger-4">
          <h2 className="heading heading-md">Risk Distribution</h2>

          {totalRisk === 0 ? (
            <div className="risk-empty">
              <p>No executions yet</p>
              <button onClick={() => navigate('/executions')} className="risk-empty-action">
                Generate test traffic
              </button>
            </div>
          ) : (
            <>
              <div className="risk-bar">
                {stats.riskDistribution.low > 0 && (
                  <div
                    className="risk-segment risk-low"
                    style={{ width: `${(stats.riskDistribution.low / totalRisk) * 100}%` }}
                    title={`Low: ${stats.riskDistribution.low}`}
                  />
                )}
                {stats.riskDistribution.medium > 0 && (
                  <div
                    className="risk-segment risk-medium"
                    style={{ width: `${(stats.riskDistribution.medium / totalRisk) * 100}%` }}
                    title={`Medium: ${stats.riskDistribution.medium}`}
                  />
                )}
                {stats.riskDistribution.high > 0 && (
                  <div
                    className="risk-segment risk-high"
                    style={{ width: `${(stats.riskDistribution.high / totalRisk) * 100}%` }}
                    title={`High: ${stats.riskDistribution.high}`}
                  />
                )}
                {stats.riskDistribution.critical > 0 && (
                  <div
                    className="risk-segment risk-critical"
                    style={{ width: `${(stats.riskDistribution.critical / totalRisk) * 100}%` }}
                    title={`Critical: ${stats.riskDistribution.critical}`}
                  />
                )}
              </div>

              <div className="risk-labels">
                <div className="risk-label-item">
                  <span className="risk-label-dot risk-low" />
                  <span className="risk-label-text">Low</span>
                  <span className="risk-label-count">{stats.riskDistribution.low}</span>
                </div>
                <div className="risk-label-item">
                  <span className="risk-label-dot risk-medium" />
                  <span className="risk-label-text">Medium</span>
                  <span className="risk-label-count">{stats.riskDistribution.medium}</span>
                </div>
                <div className="risk-label-item">
                  <span className="risk-label-dot risk-high" />
                  <span className="risk-label-text">High</span>
                  <span className="risk-label-count">{stats.riskDistribution.high}</span>
                </div>
                <div className="risk-label-item">
                  <span className="risk-label-dot risk-critical" />
                  <span className="risk-label-text">Critical</span>
                  <span className="risk-label-count">{stats.riskDistribution.critical}</span>
                </div>
              </div>
            </>
          )}
        </Panel>

        {/* Top Agents */}
        <Panel className="dashboard-ranked animate-in stagger-5">
          <h2 className="heading heading-md">Top Agents</h2>
          <RankedList
            items={stats.topAgents.map(agent => ({
              id: agent.agentId,
              name: agent.agentId,
              value: agent.count,
              subtitle: 'executions',
            }))}
            emptyMessage="No agent activity in this window"
            emptyAction={() => navigate('/executions')}
            emptyActionLabel="View All Executions"
          />
        </Panel>

        {/* Top Tools */}
        <Panel className="dashboard-ranked animate-in stagger-6">
          <h2 className="heading heading-md">Top Tools</h2>
          <RankedList
            items={stats.topTools.map(tool => ({
              id: tool.tool,
              name: tool.tool,
              value: tool.count,
              subtitle: 'calls',
            }))}
            emptyMessage="No tool usage in this window"
            emptyAction={() => navigate('/executions')}
            emptyActionLabel="View All Executions"
          />
        </Panel>
      </div>
    </div>
  );
}

function getRiskLevel(score: number): string {
  if (score >= 0.95) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

function getRiskLabel(score: number): string {
  if (score >= 0.95) return 'Critical';
  if (score >= 0.6) return 'High';
  if (score >= 0.3) return 'Medium';
  return 'Low';
}
