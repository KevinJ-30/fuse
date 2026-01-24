import { useState, useEffect } from 'react';
import apiClient from '../lib/api';
import { getSocket } from '../lib/socket';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import '../styles/tokens.css';
import './ApprovalQueueNew.css';

interface ApprovalRequest {
  id: string;
  executionId: string;
  status: string;
  riskScore: number;
  riskBreakdown: {
    rules: number;
    semantic: boolean;
    anomalies: number;
  };
  detectionFlags: any;
  createdAt: string;
  execution?: {
    agentId: string;
    tool: string;
    input: any;
    output?: any;
  };
}

export default function ApprovalQueueNew() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [reviewerName, setReviewerName] = useState('Admin');
  const [denyReason, setDenyReason] = useState('');

  useEffect(() => {
    loadApprovals();

    const socket = getSocket();
    socket.on('approval:new', loadApprovals);
    socket.on('approval:resolved', loadApprovals);

    return () => {
      socket.off('approval:new');
      socket.off('approval:resolved');
    };
  }, []);

  const loadApprovals = async () => {
    try {
      const response = await apiClient.get('/api/approvals?status=PENDING');
      setApprovals(response.data.approvals || []);
    } catch (error) {
      console.error('Error loading approvals:', error);
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApproval) return;

    try {
      await apiClient.post(`/api/approvals/${selectedApproval.id}/approve`, {
        reviewedBy: reviewerName,
      });
      setShowApproveModal(false);
      setSelectedApproval(null);
      loadApprovals();
    } catch (error) {
      console.error('Error approving:', error);
    }
  };

  const handleDeny = async () => {
    if (!selectedApproval || !denyReason) return;

    try {
      await apiClient.post(`/api/approvals/${selectedApproval.id}/deny`, {
        reviewedBy: reviewerName,
        comments: denyReason,
      });
      setShowDenyModal(false);
      setSelectedApproval(null);
      setDenyReason('');
      loadApprovals();
    } catch (error) {
      console.error('Error denying:', error);
    }
  };

  const getRiskLabel = (score: number) => {
    if (score >= 0.95) return 'Critical';
    if (score >= 0.6) return 'High';
    if (score >= 0.3) return 'Medium';
    return 'Low';
  };

  const getRiskColor = (score: number) => {
    if (score >= 0.95) return 'danger';
    if (score >= 0.6) return 'warning';
    if (score >= 0.3) return 'warning';
    return 'success';
  };

  if (loading) {
    return (
      <div className="approval-queue-container">
        <div className="loading-state">Loading approvals...</div>
      </div>
    );
  }

  return (
    <div className="approval-queue-container">
      <div className="approval-header animate-in">
        <div>
          <h1 className="heading heading-lg">Approval Queue</h1>
          <p className="approval-subtitle">Review and approve pending executions</p>
        </div>
      </div>

      {approvals.length === 0 ? (
        <Panel className="animate-in stagger-1">
          <div className="empty-state">
            <h3>No pending approvals</h3>
            <p>All executions have been reviewed or auto-approved</p>
          </div>
        </Panel>
      ) : (
        <div className="approvals-list">
          {approvals.map((approval, index) => (
            <Panel
              key={approval.id}
              className={`approval-card animate-in stagger-${Math.min(index + 1, 6)}`}
            >
              <div className="approval-card-header">
                <div>
                  <Badge variant="brand" size="sm">
                    {approval.execution?.agentId || 'Unknown Agent'}
                  </Badge>
                  <span className="approval-tool">{approval.execution?.tool || 'Unknown Tool'}</span>
                </div>
                <Badge variant={getRiskColor(approval.riskScore) as any}>
                  Risk: {getRiskLabel(approval.riskScore)} ({approval.riskScore.toFixed(2)})
                </Badge>
              </div>

              <div className="risk-bar-container">
                <div className="risk-bar">
                  <div
                    className={`risk-bar-fill risk-${getRiskLabel(approval.riskScore).toLowerCase()}`}
                    style={{ width: `${approval.riskScore * 100}%` }}
                  />
                </div>
              </div>

              <div className="approval-details">
                <div className="detail-section">
                  <label>Execution ID</label>
                  <code>{approval.executionId}</code>
                </div>

                {approval.execution?.input && (
                  <div className="detail-section">
                    <label>Input Preview</label>
                    <pre className="json-preview">
                      {JSON.stringify(approval.execution.input, null, 2).substring(0, 200)}
                      {JSON.stringify(approval.execution.input).length > 200 ? '...' : ''}
                    </pre>
                  </div>
                )}

                <div className="detection-summary">
                  <span>Rule Violations: {approval.riskBreakdown.rules}</span>
                  <span>Anomalies: {approval.riskBreakdown.anomalies}</span>
                </div>
              </div>

              <div className="approval-actions">
                <Button
                  variant="primary"
                  onClick={() => {
                    setSelectedApproval(approval);
                    setShowApproveModal(true);
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setSelectedApproval(approval);
                    setShowDenyModal(true);
                  }}
                >
                  Deny
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedApproval && (
        <div className="modal-overlay" onClick={() => setShowApproveModal(false)}>
          <Panel className="modal-panel" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h2 className="heading heading-md">Approve Execution</h2>
            <p>Are you sure you want to approve this execution?</p>

            <div className="form-group">
              <label>Reviewer Name</label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="modal-actions">
              <Button variant="primary" onClick={handleApprove}>
                Approve
              </Button>
              <Button variant="secondary" onClick={() => setShowApproveModal(false)}>
                Cancel
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {/* Deny Modal */}
      {showDenyModal && selectedApproval && (
        <div className="modal-overlay" onClick={() => setShowDenyModal(false)}>
          <Panel className="modal-panel" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h2 className="heading heading-md">Deny Execution</h2>
            <p>Please provide a reason for denial</p>

            <div className="form-group">
              <label>Reviewer Name</label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="form-group">
              <label>Denial Reason *</label>
              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                className="input-field"
                rows={4}
                placeholder="Explain why this execution should be denied..."
              />
            </div>

            <div className="modal-actions">
              <Button variant="danger" onClick={handleDeny} disabled={!denyReason}>
                Deny
              </Button>
              <Button variant="secondary" onClick={() => setShowDenyModal(false)}>
                Cancel
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
