import { useState, useEffect } from 'react';
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
  status: string;
  createdAt: string;
  parentId: string | null;
  input?: any;
  output?: any;
}

interface ExecutionNode extends Execution {
  children: ExecutionNode[];
}

export default function ExecutionGraphNew() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTree, setSelectedTree] = useState<ExecutionNode | null>(null);
  const [showTreeModal, setShowTreeModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [blastRadius, setBlastRadius] = useState<any>(null);
  const [rollbackStrategy, setRollbackStrategy] = useState<'SINGLE' | 'TREE' | 'CHAIN'>('SINGLE');

  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutions = async () => {
    try {
      const response = await apiClient.get('/api/executions');
      setExecutions(response.data.executions || []);
    } catch (error) {
      console.error('Error loading executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutionTree = async (executionId: string) => {
    try {
      const response = await apiClient.get(`/api/executions/${executionId}/tree`);
      setSelectedTree(response.data.execution);
      setShowTreeModal(true);
    } catch (error) {
      console.error('Error loading execution tree:', error);
    }
  };

  const loadRollbackPreview = async (executionId: string, strategy: 'SINGLE' | 'TREE' | 'CHAIN') => {
    try {
      const response = await apiClient.post('/api/rollbacks/preview', {
        executionId,
        strategy,
      });
      setBlastRadius(response.data.blastRadius);
    } catch (error) {
      console.error('Error loading rollback preview:', error);
    }
  };

  const handleRollbackClick = async (execution: Execution) => {
    setSelectedExecution(execution);
    setShowRollbackModal(true);
    await loadRollbackPreview(execution.id, 'SINGLE');
  };

  const handleStrategyChange = async (strategy: 'SINGLE' | 'TREE' | 'CHAIN') => {
    setRollbackStrategy(strategy);
    if (selectedExecution) {
      await loadRollbackPreview(selectedExecution.id, strategy);
    }
  };

  const executeRollback = async () => {
    if (!selectedExecution) return;

    try {
      const response = await apiClient.post('/api/rollbacks', {
        executionId: selectedExecution.id,
        strategy: rollbackStrategy,
      });
      setShowRollbackModal(false);
      window.location.href = `/rollbacks/${response.data.rollback.id}`;
    } catch (error) {
      console.error('Error executing rollback:', error);
    }
  };

  const hasChildren = (executionId: string) => {
    return executions.some(e => e.parentId === executionId);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, any> = {
      'COMPLETED': 'success',
      'PENDING': 'warning',
      'FAILED': 'danger',
      'RUNNING': 'brand',
    };
    return statusMap[status] || 'default';
  };

  const renderTreeNode = (node: ExecutionNode, depth: number = 0) => {
    return (
      <div key={node.id} style={{ marginLeft: `${depth * 24}px` }} className="tree-node">
        <div className="tree-node-content">
          <Badge variant="brand" size="sm">{node.agentId}</Badge>
          <span className="tree-node-tool">{node.tool}</span>
          <Badge variant={getStatusBadge(node.status) as any} size="sm">{node.status}</Badge>
        </div>
        {node.children.map(child => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="execution-graph-container">
        <div className="loading-state">Loading executions...</div>
      </div>
    );
  }

  return (
    <div className="execution-graph-container">
      <div className="execution-header animate-in">
        <h1 className="heading heading-lg">Execution Graph</h1>
        <p className="execution-subtitle">View execution history and relationships</p>
      </div>

      {executions.length === 0 ? (
        <Panel className="animate-in stagger-1">
          <div className="empty-state">
            <h3>No executions found</h3>
            <p>Executions will appear here once agents start running</p>
          </div>
        </Panel>
      ) : (
        <div className="executions-list">
          {executions.map((execution, index) => (
            <Panel
              key={execution.id}
              className={`execution-card animate-in stagger-${Math.min(index + 1, 6)}`}
            >
              <div className="execution-card-header">
                <div>
                  <Badge variant="brand" size="sm">{execution.agentId}</Badge>
                  <span className="execution-tool">{execution.tool}</span>
                  <Badge variant={getStatusBadge(execution.status) as any} size="sm">
                    {execution.status}
                  </Badge>
                </div>
                <div className="execution-indicators">
                  {execution.parentId && (
                    <button
                      className="indicator-button"
                      onClick={() => loadExecutionTree(execution.parentId!)}
                      title="View parent"
                    >
                      ↑
                    </button>
                  )}
                  {hasChildren(execution.id) && (
                    <button
                      className="indicator-button"
                      onClick={() => loadExecutionTree(execution.id)}
                      title="View children"
                    >
                      ↓
                    </button>
                  )}
                </div>
              </div>

              <div className="execution-details">
                <div className="detail-section">
                  <label>Execution ID</label>
                  <code>{execution.id}</code>
                </div>
                <div className="detail-section">
                  <label>Timestamp</label>
                  <span>{new Date(execution.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {execution.status === 'COMPLETED' && (
                <div className="execution-actions">
                  <Button
                    variant="secondary"
                    onClick={() => handleRollbackClick(execution)}
                  >
                    Rollback
                  </Button>
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}

      {/* Tree View Modal */}
      {showTreeModal && selectedTree && (
        <div className="modal-overlay" onClick={() => setShowTreeModal(false)}>
          <Panel className="modal-panel tree-modal" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h2 className="heading heading-md">Execution Tree</h2>
            <div className="tree-view">
              {renderTreeNode(selectedTree)}
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setShowTreeModal(false)}>
                Close
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {/* Rollback Preview Modal */}
      {showRollbackModal && selectedExecution && (
        <div className="modal-overlay" onClick={() => setShowRollbackModal(false)}>
          <Panel className="modal-panel rollback-modal" gradient="brand" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h2 className="heading heading-md">Rollback Preview</h2>
            <p>Review the impact before executing this rollback</p>

            <div className="strategy-selector">
              <label>Rollback Strategy</label>
              <div className="strategy-options">
                <button
                  className={`strategy-option ${rollbackStrategy === 'SINGLE' ? 'active' : ''}`}
                  onClick={() => handleStrategyChange('SINGLE')}
                >
                  <strong>SINGLE</strong>
                  <span>Just this execution</span>
                </button>
                <button
                  className={`strategy-option ${rollbackStrategy === 'TREE' ? 'active' : ''}`}
                  onClick={() => handleStrategyChange('TREE')}
                >
                  <strong>TREE</strong>
                  <span>This + all descendants</span>
                </button>
                <button
                  className={`strategy-option ${rollbackStrategy === 'CHAIN' ? 'active' : ''}`}
                  onClick={() => handleStrategyChange('CHAIN')}
                >
                  <strong>CHAIN</strong>
                  <span>This + all ancestors</span>
                </button>
              </div>
            </div>

            {blastRadius && (
              <div className="blast-radius">
                <h3>Impact Analysis</h3>
                <div className="blast-stats">
                  <div className="blast-stat">
                    <span className="blast-label">Total Affected</span>
                    <span className="blast-value">{blastRadius.totalExecutions}</span>
                  </div>
                  <div className="blast-stat">
                    <span className="blast-label">Agents</span>
                    <span className="blast-value">{blastRadius.uniqueAgents}</span>
                  </div>
                  <div className="blast-stat">
                    <span className="blast-label">Tools</span>
                    <span className="blast-value">{blastRadius.uniqueTools}</span>
                  </div>
                </div>

                {blastRadius.warnings && blastRadius.warnings.length > 0 && (
                  <div className="blast-warnings">
                    {blastRadius.warnings.map((warning: string, i: number) => (
                      <div key={i} className="blast-warning">
                        <Badge variant="danger" size="sm">Warning</Badge>
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <Button variant="danger" onClick={executeRollback}>
                Execute Rollback
              </Button>
              <Button variant="secondary" onClick={() => setShowRollbackModal(false)}>
                Cancel
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
