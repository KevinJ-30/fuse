import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../lib/api';
import { getSocket } from '../lib/socket';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import '../styles/tokens.css';
import './RollbacksNew.css';

interface Rollback {
  id: string;
  executionId: string;
  strategy: 'SINGLE' | 'CHAIN' | 'TREE';
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'PENDING' | 'PARTIAL' | 'DRY_RUN';
  initiatedBy: string;
  reason: string;
  blastRadius: {
    total: number;
    maxDepth?: number;
  };
  compensations: {
    executed: number;
    failed: number;
    manual: number;
  };
  createdAt: string;
  completedAt?: string;
  execution?: {
    id: string;
    agentId: string;
    tool: string;
    status: string;
  };
}

interface RollbackStats {
  total: number;
  successful: number;
  failed: number;
  inProgress: number;
}

export default function RollbacksNew() {
  const navigate = useNavigate();
  const [rollbacks, setRollbacks] = useState<Rollback[]>([]);
  const [stats, setStats] = useState<RollbackStats>({
    total: 0,
    successful: 0,
    failed: 0,
    inProgress: 0,
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    loadRollbacks();

    const socket = getSocket();
    socket.on('rollback:completed', loadRollbacks);
    socket.on('rollback:updated', loadRollbacks);

    return () => {
      socket.off('rollback:completed', loadRollbacks);
      socket.off('rollback:updated', loadRollbacks);
    };
  }, [timeRange]);

  const loadRollbacks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/rollbacks?timeRange=${timeRange}`);
      const rollbackData = response.data.rollbacks || [];
      setRollbacks(rollbackData);
      calculateStats(rollbackData);
    } catch (error) {
      console.error('Failed to load rollbacks:', error);
      setRollbacks([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Rollback[]) => {
    const stats = {
      total: data.length,
      successful: data.filter(r => r.status === 'COMPLETED').length,
      failed: data.filter(r => r.status === 'FAILED').length,
      inProgress: data.filter(r => r.status === 'IN_PROGRESS').length,
    };
    setStats(stats);
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'danger' | 'success' | 'warning' | 'brand' => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'IN_PROGRESS':
        return 'warning';
      case 'FAILED':
        return 'danger';
      case 'PARTIAL':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStrategyLabel = (strategy: string) => {
    switch (strategy) {
      case 'SINGLE':
        return 'Single Execution';
      case 'CHAIN':
        return 'Execution Chain';
      case 'TREE':
        return 'Execution Tree';
      default:
        return strategy;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const durationMs = endTime - startTime;

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  };

  if (loading) {
    return (
      <div className="rollbacks-loading">
        <div className="loading-spinner" />
        <p>Loading rollback history...</p>
      </div>
    );
  }

  return (
    <div className="rollbacks-container">
      {/* Hero Section */}
      <div className="rollbacks-hero animate-in">
        <div className="hero-header">
          <div>
            <h1 className="heading heading-lg">Rollback Operations</h1>
            <p className="hero-description">
              Track and manage execution rollbacks across your agent infrastructure
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate('/executions')}>
            View Executions
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <Panel className="stat-card animate-in stagger-1" hover={false}>
            <div className="stat-label">Total Rollbacks</div>
            <div className="stat-value">{stats.total}</div>
          </Panel>
          <Panel className="stat-card animate-in stagger-2" hover={false}>
            <div className="stat-label">Successful</div>
            <div className="stat-value stat-success">{stats.successful}</div>
          </Panel>
          <Panel className="stat-card animate-in stagger-3" hover={false}>
            <div className="stat-label">Failed</div>
            <div className="stat-value stat-danger">{stats.failed}</div>
          </Panel>
          <Panel className="stat-card animate-in stagger-4" hover={false}>
            <div className="stat-label">In Progress</div>
            <div className="stat-value stat-warning">{stats.inProgress}</div>
          </Panel>
        </div>

        {/* Time Range Filter */}
        <div className="time-range-container">
          <label className="label">Time Range</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-range-select"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      {rollbacks.length === 0 ? (
        <Panel className="empty-state animate-in stagger-5">
          <div className="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="empty-title">No Rollbacks Found</h2>
          <p className="empty-description">
            Rollbacks allow you to reverse agent actions and restore previous states.
            When an execution needs to be undone, a rollback operation is created to
            compensate for the changes made.
          </p>
          <Button variant="secondary" onClick={() => navigate('/executions')}>
            View Execution Graph
          </Button>
        </Panel>
      ) : (
        <div className="timeline-container animate-in stagger-5">
          <div className="timeline-line" />
          {rollbacks.map((rollback, index) => (
            <div
              key={rollback.id}
              className={`timeline-item animate-in stagger-${Math.min(index + 6, 12)}`}
            >
              {/* Status Dot */}
              <div className={`timeline-dot timeline-dot-${rollback.status.toLowerCase()}`}>
                <div className="timeline-dot-inner" />
              </div>

              {/* Rollback Card */}
              <Panel className="rollback-card" gradient="subtle">
                <div className="rollback-header">
                  <div className="rollback-title-section">
                    <div className="rollback-id-badge">
                      <span className="rollback-id-label">Rollback</span>
                      <span className="rollback-id-value">{rollback.id.slice(0, 8)}</span>
                    </div>
                    <div className="rollback-timestamp">{formatTimestamp(rollback.createdAt)}</div>
                  </div>
                  <Badge variant={getStatusBadgeVariant(rollback.status)}>
                    {rollback.status.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Target Execution Info */}
                <div className="rollback-target">
                  <div className="target-label">Target Execution</div>
                  <div className="target-info">
                    <span className="target-tool">{rollback.execution?.tool || 'Unknown'}</span>
                    <span className="target-separator">•</span>
                    <span className="target-agent">{rollback.execution?.agentId || 'N/A'}</span>
                  </div>
                  <div className="target-execution-id">{rollback.executionId}</div>
                </div>

                {/* Metrics Grid */}
                <div className="rollback-metrics">
                  <div className="metric-item">
                    <div className="metric-item-value">{rollback.blastRadius?.total || 0}</div>
                    <div className="metric-item-label">Affected</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-item-value metric-success">
                      {rollback.compensations?.executed || 0}
                    </div>
                    <div className="metric-item-label">Executed</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-item-value metric-danger">
                      {rollback.compensations?.failed || 0}
                    </div>
                    <div className="metric-item-label">Failed</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-item-value">{getStrategyLabel(rollback.strategy)}</div>
                    <div className="metric-item-label">Strategy</div>
                  </div>
                </div>

                {/* Duration & Reason */}
                {rollback.reason && (
                  <div className="rollback-reason">
                    <span className="reason-label">Reason:</span> {rollback.reason}
                  </div>
                )}

                <div className="rollback-footer">
                  <div className="rollback-duration">
                    Duration: {formatDuration(rollback.createdAt, rollback.completedAt)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/rollbacks/${rollback.id}`)}
                  >
                    View Details →
                  </Button>
                </div>
              </Panel>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
