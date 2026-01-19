import { useState, useEffect } from 'react';
import apiClient from '../lib/api';
import { getSocket } from '../lib/socket';

interface ApprovalRequest {
  id: string;
  executionId: string;
  status: string;
  riskScore: number;
  riskBreakdown: {
    rules: number;
    anomalies: number;
    semantic: boolean;
  };
  detectionFlags: any;
  createdAt: string;
  expiresAt: string;
  execution: {
    agentId: string;
    tool: string;
    input: any;
    createdAt: string;
  };
}

export default function ApprovalQueue() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [modifiedInput, setModifiedInput] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [comments, setComments] = useState('');

  useEffect(() => {
    loadApprovals();

    // Set up Socket.io listeners
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
      setApprovals(response.data.approvals);
    } catch (error) {
      console.error('Error loading approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApproval) return;

    try {
      const payload: any = {
        reviewedBy: reviewerName || 'unknown',
        comments: comments || undefined,
      };

      if (modifiedInput.trim()) {
        try {
          payload.modifiedInput = JSON.parse(modifiedInput);
        } catch (e) {
          alert('Invalid JSON in modified input');
          return;
        }
      }

      await apiClient.post(`/api/approvals/${selectedApproval.id}/approve`, payload);
      setShowApproveModal(false);
      setSelectedApproval(null);
      setModifiedInput('');
      setReviewerName('');
      setComments('');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error approving request');
    }
  };

  const handleDeny = async () => {
    if (!selectedApproval) return;

    try {
      await apiClient.post(`/api/approvals/${selectedApproval.id}/deny`, {
        reviewedBy: reviewerName || 'unknown',
        comments: comments || undefined,
      });
      setShowDenyModal(false);
      setSelectedApproval(null);
      setReviewerName('');
      setComments('');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error denying request');
    }
  };

  const openApproveModal = (approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    setModifiedInput('');
    setReviewerName('');
    setComments('');
    setShowApproveModal(true);
  };

  const openEditApproveModal = (approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    setModifiedInput(JSON.stringify(approval.execution.input, null, 2));
    setReviewerName('');
    setComments('');
    setShowApproveModal(true);
  };

  const openDenyModal = (approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    setReviewerName('');
    setComments('');
    setShowDenyModal(true);
  };

  const getRiskColor = (score: number) => {
    if (score >= 0.95) return 'bg-red-100 text-red-800 border-red-200';
    if (score >= 0.6) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (score >= 0.3) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 0.95) return 'Critical';
    if (score >= 0.6) return 'High';
    if (score >= 0.3) return 'Medium';
    return 'Low';
  };

  const getTimeWaiting = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold">Pending Approvals</h3>
        <p className="text-sm text-gray-600 mt-1">
          Review and approve or deny tool execution requests
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Loading approvals...
        </div>
      ) : approvals.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No pending approvals
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className={`bg-white rounded-lg shadow border-l-4 ${getRiskColor(approval.riskScore)}`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {approval.execution.tool}
                      </h4>
                      <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">
                        {approval.execution.agentId}
                      </span>
                      <span className={`px-3 py-1 text-xs font-medium rounded ${getRiskColor(approval.riskScore)}`}>
                        Risk: {approval.riskScore.toFixed(2)} ({getRiskLabel(approval.riskScore)})
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Waiting {getTimeWaiting(approval.createdAt)} • Expires{' '}
                      {new Date(approval.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openApproveModal(approval)}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => openEditApproveModal(approval)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                      Edit & Approve
                    </button>
                    <button
                      onClick={() => openDenyModal(approval)}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                    >
                      Deny
                    </button>
                  </div>
                </div>

                {/* Detection Flags */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-orange-600">
                      {approval.riskBreakdown.rules}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Rule Violations</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-purple-600">
                      {approval.riskBreakdown.anomalies}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Anomalies</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className={`text-2xl font-bold ${approval.riskBreakdown.semantic ? 'text-red-600' : 'text-gray-400'}`}>
                      {approval.riskBreakdown.semantic ? 'Yes' : 'No'}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Semantic Concerns</div>
                  </div>
                </div>

                {/* Input Arguments */}
                <div className="mb-4">
                  <button
                    onClick={() => setExpandedId(expandedId === approval.id ? null : approval.id)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    {expandedId === approval.id ? 'Hide' : 'Show'} Input Arguments
                  </button>
                </div>

                {expandedId === approval.id && (
                  <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(approval.execution.input, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Detection Details */}
                {approval.detectionFlags && expandedId === approval.id && (
                  <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
                    <h5 className="text-sm font-semibold mb-2">Detection Details</h5>
                    {approval.detectionFlags.rules && approval.detectionFlags.rules.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-gray-700">Rule Violations:</p>
                        <ul className="text-xs text-gray-600 ml-4 list-disc">
                          {approval.detectionFlags.rules.map((rule: any, idx: number) => (
                            <li key={idx}>{rule.ruleName}: {rule.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {approval.detectionFlags.anomalies && approval.detectionFlags.anomalies.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700">Anomalies:</p>
                        <ul className="text-xs text-gray-600 ml-4 list-disc">
                          {approval.detectionFlags.anomalies.map((anomaly: any, idx: number) => (
                            <li key={idx}>{anomaly.type}: {anomaly.message} (z-score: {anomaly.zScore.toFixed(2)})</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Approve Execution</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Tool: <strong>{selectedApproval.execution.tool}</strong>
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  Agent: <strong>{selectedApproval.execution.agentId}</strong>
                </p>
                <p className="text-sm text-gray-600">
                  Risk Score: <strong>{selectedApproval.riskScore.toFixed(2)}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reviewer Name
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Your name or email"
                />
              </div>

              {modifiedInput && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modified Input (JSON)
                  </label>
                  <textarea
                    value={modifiedInput}
                    onChange={(e) => setModifiedInput(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                    rows={10}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments (optional)
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Reason for approval..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deny Modal */}
      {showDenyModal && selectedApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">Deny Execution</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Tool: <strong>{selectedApproval.execution.tool}</strong>
                </p>
                <p className="text-sm text-gray-600">
                  Agent: <strong>{selectedApproval.execution.agentId}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reviewer Name
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Your name or email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Denial
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Why are you denying this request?"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowDenyModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeny}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Confirm Denial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
