import { useEffect, useState } from 'react';
import apiClient from '../lib/api';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import '../styles/tokens.css';
import './ExecutionGraphNew.css';

interface Execution {
  id: string;
  agentId: string;
  tool: string;
  status: 'COMPLETED' | 'AWAITING_APPROVAL' | 'FAILED' | 'BLOCKED' | 'PENDING' | 'EXECUTING';
  createdAt: string;
}

export default function ExecutionGraphNew() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/api/executions');
      setExecutions(response.data.executions || response.data || []);
    } catch (err) {
      console.error('Failed to load executions:', err);
      setError('Failed to load executions. Please try again.');
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'danger' | 'success' | 'warning' | 'brand' => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'AWAITING_APPROVAL':
        return 'warning';
      case 'FAILED':
      case 'BLOCKED':
        return 'danger';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) {
        return 'Just now';
      } else if (diffMins < 60) {
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
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="executions-loading">
        <div className="loading-spinner" />
        <p>Loading execution history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="executions-container">
        <div className="executions-header animate-in">
          <h1 className="heading heading-lg">Execution History</h1>
        </div>
        <Panel className="empty-state animate-in">
          <div className="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="empty-title">Error Loading Executions</h2>
          <p className="empty-description">{error}</p>
          <Button variant="primary" onClick={loadExecutions}>
            Retry
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="executions-container">
      <div className="executions-header animate-in">
        <div>
          <h1 className="heading heading-lg">Execution History</h1>
          <p className="executions-subtitle">
            Real-time view of agent tool executions
          </p>
        </div>
        <Button variant="secondary" onClick={loadExecutions}>
          Refresh
        </Button>
      </div>

      {executions.length === 0 ? (
        <Panel className="empty-state animate-in">
          <div className="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h2 className="empty-title">No Executions Yet</h2>
          <p className="empty-description">
            Agent tool executions will appear here as they occur in your system.
          </p>
        </Panel>
      ) : (
        <div className="executions-list">
          {executions.map((execution, index) => (
            <Panel
              key={execution.id}
              className={`execution-card animate-in stagger-${Math.min(index + 1, 12)}`}
              gradient="subtle"
            >
              <div className="execution-content">
                <div className="execution-header">
                  <div className="execution-title-section">
                    <Badge variant="default" size="sm">
                      {execution.id.slice(0, 8)}
                    </Badge>
                    <span className="execution-timestamp">{formatTimestamp(execution.createdAt)}</span>
                  </div>
                  <Badge variant={getStatusBadgeVariant(execution.status)}>
                    {execution.status.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="execution-info">
                  <div className="execution-info-item">
                    <span className="info-label">Agent</span>
                    <span className="info-value">{execution.agentId}</span>
                  </div>
                  <div className="execution-info-item">
                    <span className="info-label">Tool</span>
                    <span className="info-value">{execution.tool}</span>
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
