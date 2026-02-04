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

interface RecentExecution {
  id: string;
  agentId: string;
  tool: string;
  status: string;
  startedAt: string;
  riskScore?: number;
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

  // Initiate Rollback Modal State
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [recentExecutions, setRecentExecutions] = useState<RecentExecution[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState('');
  const [manualExecutionId, setManualExecutionId] = useState('');
  const [rollbackStrategy, setRollbackStrategy] = useState<'SINGLE' | 'CHAIN' | 'TREE'>('SINGLE');
  const [rollbackReason, setRollbackReason] = useState('');
  const [initiating, setInitiating] = useState(false);

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

  const loadRecentExecutions = async () => {
    try {
      setLoadingExecutions(true);
      const response = await apiClient.get('/api/executions?limit=20&status=COMPLETED');
      setRecentExecutions(response.data.executions || []);
    } catch (error) {
      console.error('Failed to load recent executions:', error);
      setRecentExecutions([]);
    } finally {
      setLoadingExecutions(false);
    }
  };

  const handleOpenInitiateModal = () => {
    setShowInitiateModal(true);
    setSelectedExecutionId('');
    setManualExecutionId('');
    setRollbackReason('');
    setRollbackStrategy('SINGLE');
    loadRecentExecutions();
  };

  const handleInitiateRollback = async () => {
    const executionId = manualExecutionId || selectedExecutionId;

    if (!executionId) {
      alert('Please select or enter an execution ID');
      return;
    }

    if (!rollbackReason.trim()) {
      alert('Please provide a reason for the rollback');
      return;
    }

    try {
      setInitiating(true);
      const response = await apiClient.post('/api/rollbacks', {
        executionId,
        strategy: rollbackStrategy,
        reason: rollbackReason,
      });

      const rollbackId = response.data.rollback?.id || response.data.id;

      // Close modal and refresh list
      setShowInitiateModal(false);
      await loadRollbacks();

      // Navigate to rollback detail page
      if (rollbackId) {
        navigate(`/rollbacks/${rollbackId}`);
      }
    } catch (error: any) {
      console.error('Failed to initiate rollback:', error);
      alert(`Failed to initiate rollback: ${error.response?.data?.error || error.message}`);
    } finally {
      setInitiating(false);
    }
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
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="primary" onClick={handleOpenInitiateModal}>
              Initiate Rollback
            </Button>
            <Button variant="secondary" onClick={() => navigate('/executions')}>
              View Executions
            </Button>
          </div>
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

      {/* Initiate Rollback Modal */}
      {showInitiateModal && (
        <div className="modal-overlay" onClick={() => setShowInitiateModal(false)}>
          <Panel
            className="modal-content initiate-rollback-modal animate-in"
            onClick={(e) => e.stopPropagation()}
            gradient="subtle"
          >
            <div className="modal-header">
              <h2 className="heading heading-md">Initiate Rollback</h2>
              <button
                className="modal-close"
                onClick={() => setShowInitiateModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Execution Selection */}
              <div className="form-section">
                <label className="label">Select Recent Execution</label>
                {loadingExecutions ? (
                  <div className="loading-executions">Loading recent executions...</div>
                ) : (
                  <select
                    className="select-input"
                    value={selectedExecutionId}
                    onChange={(e) => {
                      setSelectedExecutionId(e.target.value);
                      setManualExecutionId('');
                    }}
                    disabled={!!manualExecutionId}
                  >
                    <option value="">Select an execution...</option>
                    {recentExecutions.map((exec) => (
                      <option key={exec.id} value={exec.id}>
                        {exec.agentId} → {exec.tool} ({exec.status}) - {new Date(exec.startedAt).toLocaleString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-divider">
                <span className="form-divider-text">OR</span>
              </div>

              {/* Manual Execution ID */}
              <div className="form-section">
                <label className="label">Enter Execution ID</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="exec_..."
                  value={manualExecutionId}
                  onChange={(e) => {
                    setManualExecutionId(e.target.value);
                    setSelectedExecutionId('');
                  }}
                  disabled={!!selectedExecutionId}
                />
              </div>

              {/* Strategy Selection */}
              <div className="form-section">
                <label className="label">Rollback Strategy</label>
                <div className="strategy-options">
                  <label className={`strategy-option ${rollbackStrategy === 'SINGLE' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="strategy"
                      value="SINGLE"
                      checked={rollbackStrategy === 'SINGLE'}
                      onChange={(e) => setRollbackStrategy(e.target.value as 'SINGLE')}
                    />
                    <div className="strategy-content">
                      <div className="strategy-title">Single Execution</div>
                      <div className="strategy-description">Rollback only this execution</div>
                    </div>
                  </label>

                  <label className={`strategy-option ${rollbackStrategy === 'CHAIN' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="strategy"
                      value="CHAIN"
                      checked={rollbackStrategy === 'CHAIN'}
                      onChange={(e) => setRollbackStrategy(e.target.value as 'CHAIN')}
                    />
                    <div className="strategy-content">
                      <div className="strategy-title">Execution Chain</div>
                      <div className="strategy-description">Rollback all child executions</div>
                    </div>
                  </label>

                  <label className={`strategy-option ${rollbackStrategy === 'TREE' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="strategy"
                      value="TREE"
                      checked={rollbackStrategy === 'TREE'}
                      onChange={(e) => setRollbackStrategy(e.target.value as 'TREE')}
                    />
                    <div className="strategy-content">
                      <div className="strategy-title">Execution Tree</div>
                      <div className="strategy-description">Rollback entire execution tree</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Reason */}
              <div className="form-section">
                <label className="label">Reason (required)</label>
                <textarea
                  className="textarea-input"
                  placeholder="Explain why this rollback is necessary..."
                  rows={3}
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <Button
                variant="secondary"
                onClick={() => setShowInitiateModal(false)}
                disabled={initiating}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleInitiateRollback}
                disabled={initiating || (!selectedExecutionId && !manualExecutionId) || !rollbackReason.trim()}
              >
                {initiating ? 'Initiating...' : 'Initiate Rollback'}
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
