import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../lib/api';
import { getSocket } from '../lib/socket';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import '../styles/tokens.css';
import './RollbackDetailNew.css';

interface Execution {
  id: string;
  agentId: string;
  tool: string;
  status: string;
  input?: any;
  output?: any;
  startedAt: string;
  completedAt?: string;
}

interface CompensationPlan {
  type: 'AUTO_REVERSE' | 'SUGGESTED' | 'MANUAL_REQUIRED' | 'NOT_REVERSIBLE';
  tool: string;
  input: any;
  description: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasoning?: string;
}

interface AffectedExecution {
  execution: Execution;
  compensation: {
    plans: CompensationPlan[];
    hasAutoReverse: boolean;
    requiresManual: boolean;
    isReversible: boolean;
  };
  depth: number;
}

interface BlastRadius {
  rootExecution: Execution;
  affected: Execution[];
  affectedCount: number;
  groupedByAgent: Record<string, Execution[]>;
  groupedByTool: Record<string, Execution[]>;
  groupedByStatus: Record<string, Execution[]>;
  maxDepth: number;
}

interface RollbackDetail {
  id: string;
  executionId: string;
  strategy: 'SINGLE' | 'CHAIN' | 'TREE';
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'PENDING' | 'PARTIAL' | 'DRY_RUN';
  initiatedBy: string;
  reason: string;
  blastRadius: {
    total: number;
    affected?: number;
    maxDepth?: number;
    warnings?: string[];
    recommendations?: string[];
  };
  compensations: {
    executed: number;
    failed: number;
    manual: number;
    skipped?: number;
  };
  createdAt: string;
  completedAt?: string;
  execution?: Execution;
  blastRadiusDetails?: BlastRadius;
  affectedExecutions?: AffectedExecution[];
}

export default function RollbackDetailNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rollback, setRollback] = useState<RollbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [selectedCompensations, setSelectedCompensations] = useState<Set<string>>(new Set());
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionResults, setExecutionResults] = useState<Array<{ executionId: string; success: boolean; error?: string }>>([]);

  useEffect(() => {
    loadRollbackDetails();

    const socket = getSocket();
    socket.on('rollback:updated', handleRollbackUpdate);
    socket.on('compensation:executed', handleCompensationExecuted);

    return () => {
      socket.off('rollback:updated', handleRollbackUpdate);
      socket.off('compensation:executed', handleCompensationExecuted);
    };
  }, [id]);

  const loadRollbackDetails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/rollbacks/${id}`);
      const rollbackData = response.data;

      // Load blast radius details
      const blastRadiusResponse = await apiClient.get(`/api/blast-radius/${rollbackData.executionId}`);
      const blastRadiusData = blastRadiusResponse.data;

      // Load compensation plans for affected executions
      const affectedExecutions: AffectedExecution[] = [];
      for (const execution of blastRadiusData.affected || []) {
        try {
          const compensationResponse = await apiClient.get(`/api/compensations/${execution.id}`);
          affectedExecutions.push({
            execution,
            compensation: compensationResponse.data,
            depth: 0, // Will be calculated if needed
          });
        } catch (error) {
          console.error(`Failed to load compensation for ${execution.id}`, error);
        }
      }

      setRollback({
        ...rollbackData,
        blastRadiusDetails: blastRadiusData,
        affectedExecutions,
      });
    } catch (error) {
      console.error('Failed to load rollback details:', error);
      setRollback(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRollbackUpdate = (data: any) => {
    if (data.rollbackId === id) {
      loadRollbackDetails();
    }
  };

  const handleCompensationExecuted = (data: any) => {
    if (data.rollbackId === id) {
      setExecutionResults(prev => [...prev, {
        executionId: data.executionId,
        success: data.success,
        error: data.error,
      }]);
      setExecutionProgress(prev => prev + 1);
    }
  };

  const toggleCompensationSelection = (executionId: string) => {
    setSelectedCompensations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(executionId)) {
        newSet.delete(executionId);
      } else {
        newSet.add(executionId);
      }
      return newSet;
    });
  };

  const selectAllAutoReverse = () => {
    const autoReverseExecutions = rollback?.affectedExecutions
      ?.filter(ae => ae.compensation.hasAutoReverse)
      .map(ae => ae.execution.id) || [];
    setSelectedCompensations(new Set(autoReverseExecutions));
  };

  const executeSelectedCompensations = async () => {
    if (selectedCompensations.size === 0) return;

    try {
      setExecuting(true);
      setExecutionProgress(0);
      setExecutionResults([]);

      const executions = Array.from(selectedCompensations);
      for (let i = 0; i < executions.length; i++) {
        const executionId = executions[i];
        try {
          await apiClient.post(`/api/compensations/${executionId}/execute`, {
            rollbackId: id,
          });
          setExecutionProgress(i + 1);
        } catch (error: any) {
          console.error(`Failed to execute compensation for ${executionId}`, error);
          setExecutionResults(prev => [...prev, {
            executionId,
            success: false,
            error: error.message,
          }]);
        }
      }

      // Reload rollback details after execution
      await loadRollbackDetails();
    } catch (error) {
      console.error('Failed to execute compensations:', error);
    } finally {
      setExecuting(false);
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
      case 'PENDING':
        return 'default';
      default:
        return 'default';
    }
  };

  const getCompensationTypeColor = (type: string) => {
    switch (type) {
      case 'AUTO_REVERSE':
        return 'var(--ok)';
      case 'SUGGESTED':
        return 'var(--warn)';
      case 'MANUAL_REQUIRED':
        return '#FB923C'; // Orange
      case 'NOT_REVERSIBLE':
        return 'var(--danger)';
      default:
        return 'var(--muted)';
    }
  };

  const getCompensationTypeIcon = (type: string) => {
    switch (type) {
      case 'AUTO_REVERSE':
        return '↻';
      case 'SUGGESTED':
        return '⚡';
      case 'MANUAL_REQUIRED':
        return '⚠';
      case 'NOT_REVERSIBLE':
        return '✗';
      default:
        return '○';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
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
      <div className="rollback-detail-loading">
        <div className="loading-spinner" />
        <p>Loading rollback details...</p>
      </div>
    );
  }

  if (!rollback) {
    return (
      <div className="rollback-detail-container">
        <Panel className="empty-state">
          <div className="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="empty-title">Rollback Not Found</h2>
          <p className="empty-description">
            The rollback you're looking for doesn't exist or has been removed.
          </p>
          <Button variant="secondary" onClick={() => navigate('/rollbacks')}>
            Back to Rollbacks
          </Button>
        </Panel>
      </div>
    );
  }

  // Group compensations by type
  const compensationsByType: Record<string, AffectedExecution[]> = {
    AUTO_REVERSE: [],
    SUGGESTED: [],
    MANUAL_REQUIRED: [],
    NOT_REVERSIBLE: [],
  };

  rollback.affectedExecutions?.forEach(ae => {
    const primaryPlan = ae.compensation.plans[0];
    if (primaryPlan) {
      compensationsByType[primaryPlan.type]?.push(ae);
    }
  });

  const totalCompensations = rollback.affectedExecutions?.length || 0;
  const progressPercent = executing ? (executionProgress / selectedCompensations.size) * 100 : 0;

  return (
    <div className="rollback-detail-container">
      {/* Header Section */}
      <div className="rollback-detail-header animate-in">
        <div className="header-top">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rollbacks')}>
            ← Back to Rollbacks
          </Button>
          <Badge variant={getStatusBadgeVariant(rollback.status)}>
            {rollback.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="header-main">
          <div>
            <div className="rollback-id-section">
              <span className="rollback-id-label">Rollback</span>
              <span className="rollback-id-value">{rollback.id.slice(0, 12)}</span>
            </div>
            <div className="rollback-meta">
              <span className="meta-item">{formatTimestamp(rollback.createdAt)}</span>
              <span className="meta-separator">•</span>
              <span className="meta-item">Duration: {formatDuration(rollback.createdAt, rollback.completedAt)}</span>
              <span className="meta-separator">•</span>
              <span className="meta-item">Strategy: {rollback.strategy}</span>
            </div>
          </div>
        </div>

        {rollback.reason && (
          <div className="header-reason">
            <span className="reason-label">Reason:</span> {rollback.reason}
          </div>
        )}

        {/* Progress Metrics */}
        <div className="progress-metrics">
          <div className="metric">
            <div className="metric-value">{rollback.blastRadius.total}</div>
            <div className="metric-label">Total Affected</div>
          </div>
          <div className="metric">
            <div className="metric-value metric-success">{rollback.compensations.executed}</div>
            <div className="metric-label">Executed</div>
          </div>
          <div className="metric">
            <div className="metric-value metric-danger">{rollback.compensations.failed}</div>
            <div className="metric-label">Failed</div>
          </div>
          <div className="metric">
            <div className="metric-value metric-warning">{rollback.compensations.manual}</div>
            <div className="metric-label">Manual Required</div>
          </div>
        </div>
      </div>

      {/* Blast Radius Panel */}
      <Panel className="blast-radius-panel animate-in stagger-1" gradient="subtle">
        <div className="panel-header">
          <h2 className="heading heading-md">Impact Analysis</h2>
          <div className="panel-header-stats">
            <span className="stat-item">{rollback.blastRadiusDetails?.affectedCount || 0} executions</span>
            <span className="stat-separator">•</span>
            <span className="stat-item">{Object.keys(rollback.blastRadiusDetails?.groupedByAgent || {}).length} agents</span>
            <span className="stat-separator">•</span>
            <span className="stat-item">{Object.keys(rollback.blastRadiusDetails?.groupedByTool || {}).length} tools</span>
          </div>
        </div>

        <div className="blast-radius-groups">
          {/* By Agent */}
          <div className="group-section">
            <div className="group-title">By Agent</div>
            <div className="group-items">
              {Object.entries(rollback.blastRadiusDetails?.groupedByAgent || {}).map(([agent, executions]) => (
                <div key={agent} className="group-item">
                  <span className="group-item-label">{agent}</span>
                  <span className="group-item-count">{executions.length}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Tool */}
          <div className="group-section">
            <div className="group-title">By Tool</div>
            <div className="group-items">
              {Object.entries(rollback.blastRadiusDetails?.groupedByTool || {}).map(([tool, executions]) => (
                <div key={tool} className="group-item">
                  <span className="group-item-label">{tool}</span>
                  <span className="group-item-count">{executions.length}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Status */}
          <div className="group-section">
            <div className="group-title">By Status</div>
            <div className="group-items">
              {Object.entries(rollback.blastRadiusDetails?.groupedByStatus || {}).map(([status, executions]) => (
                <div key={status} className="group-item">
                  <span className="group-item-label">{status}</span>
                  <span className="group-item-count">{executions.length}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {rollback.blastRadius.warnings && rollback.blastRadius.warnings.length > 0 && (
          <div className="blast-radius-warnings">
            <div className="warning-title">Warnings</div>
            {rollback.blastRadius.warnings.map((warning, index) => (
              <div key={index} className="warning-item">⚠ {warning}</div>
            ))}
          </div>
        )}
      </Panel>

      {/* Compensation Actions Panel */}
      <Panel className="compensation-panel animate-in stagger-2" gradient="subtle">
        <div className="panel-header">
          <h2 className="heading heading-md">Compensation Plan</h2>
          <div className="panel-header-actions">
            <Button variant="ghost" size="sm" onClick={selectAllAutoReverse}>
              Select All Auto-Reverse
            </Button>
            <span className="selection-count">
              {selectedCompensations.size} of {totalCompensations} selected
            </span>
          </div>
        </div>

        {/* Compensation Groups */}
        <div className="compensation-groups">
          {Object.entries(compensationsByType).map(([type, executions]) => {
            if (executions.length === 0) return null;

            return (
              <div key={type} className="compensation-type-group">
                <div className="compensation-type-header" style={{ borderLeftColor: getCompensationTypeColor(type) }}>
                  <span className="type-icon" style={{ color: getCompensationTypeColor(type) }}>
                    {getCompensationTypeIcon(type)}
                  </span>
                  <span className="type-label">{type.replace('_', ' ')}</span>
                  <span className="type-count">{executions.length}</span>
                </div>

                <div className="compensation-items">
                  {executions.map(ae => {
                    const plan = ae.compensation.plans[0];
                    const isSelected = selectedCompensations.has(ae.execution.id);
                    const canExecute = type === 'AUTO_REVERSE' || type === 'SUGGESTED';

                    return (
                      <div
                        key={ae.execution.id}
                        className={`compensation-card ${isSelected ? 'selected' : ''}`}
                        style={{ borderLeftColor: getCompensationTypeColor(type) }}
                      >
                        <div className="compensation-header">
                          {canExecute && rollback.status === 'PENDING' && (
                            <input
                              type="checkbox"
                              className="compensation-checkbox"
                              checked={isSelected}
                              onChange={() => toggleCompensationSelection(ae.execution.id)}
                            />
                          )}
                          <div className="compensation-info">
                            <div className="compensation-execution-id">
                              {ae.execution.id.slice(0, 8)}
                            </div>
                            <div className="compensation-tool">{ae.execution.tool}</div>
                          </div>
                          {plan && (
                            <Badge variant={
                              plan.riskLevel === 'LOW' ? 'success' :
                              plan.riskLevel === 'MEDIUM' ? 'warning' :
                              plan.riskLevel === 'HIGH' ? 'danger' :
                              'danger'
                            } size="sm">
                              {plan.riskLevel}
                            </Badge>
                          )}
                        </div>

                        {plan && (
                          <>
                            <div className="compensation-description">
                              {plan.description}
                            </div>
                            {plan.reasoning && (
                              <div className="compensation-reasoning">
                                <span className="reasoning-label">Reasoning:</span> {plan.reasoning}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Execution Controls */}
        {rollback.status === 'PENDING' && (
          <div className="execution-controls">
            {executing ? (
              <div className="execution-progress">
                <div className="progress-bar-container">
                  <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="progress-text">
                  Executing {executionProgress} of {selectedCompensations.size} compensations...
                </div>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={executeSelectedCompensations}
                disabled={selectedCompensations.size === 0}
              >
                Execute Selected Compensations ({selectedCompensations.size})
              </Button>
            )}
          </div>
        )}

        {/* Execution Results */}
        {executionResults.length > 0 && (
          <div className="execution-results">
            <div className="results-title">Execution Results</div>
            {executionResults.map((result, index) => (
              <div key={index} className={`result-item ${result.success ? 'success' : 'error'}`}>
                <span className="result-icon">{result.success ? '✓' : '✗'}</span>
                <span className="result-execution">{result.executionId.slice(0, 8)}</span>
                {result.error && <span className="result-error">{result.error}</span>}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
