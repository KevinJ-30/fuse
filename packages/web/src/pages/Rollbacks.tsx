import { useEffect, useState } from 'react';
import apiClient from '../utils/api';
import { getSocket } from '../utils/socket';

interface Rollback {
  id: string;
  executionId: string;
  strategy: 'SINGLE' | 'CHAIN' | 'TREE';
  status: string;
  initiatedBy: string;
  reason: string;
  blastRadius: any;
  compensations: any;
  createdAt: string;
  completedAt?: string;
  execution?: {
    id: string;
    agentId: string;
    tool: string;
    status: string;
  };
}

interface BlastRadiusPreview {
  blastRadius: {
    total: number;
    maxDepth: number;
    timeSpan: { earliest: string; latest: string | null };
    summary: any;
  };
  validation: {
    isSafe: boolean;
    warnings: string[];
    recommendations: string[];
  };
}

export default function Rollbacks() {
  const [rollbacks, setRollbacks] = useState<Rollback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState('');
  const [strategy, setStrategy] = useState<'SINGLE' | 'CHAIN' | 'TREE'>('SINGLE');
  const [dryRun, setDryRun] = useState(true);
  const [reason, setReason] = useState('');
  const [blastRadiusPreview, setBlastRadiusPreview] = useState<BlastRadiusPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadRollbacks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/rollbacks');
      setRollbacks(response.data.rollbacks);
    } catch (error: any) {
      console.error('Failed to load rollbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRollbacks();

    const socket = getSocket();
    socket.on('rollback:completed', loadRollbacks);

    return () => {
      socket.off('rollback:completed', loadRollbacks);
    };
  }, []);

  const handlePreviewBlastRadius = async () => {
    if (!selectedExecutionId.trim()) return;

    try {
      setLoadingPreview(true);
      const response = await apiClient.post('/api/rollbacks/preview', {
        executionId: selectedExecutionId,
      });
      setBlastRadiusPreview(response.data);
    } catch (error: any) {
      console.error('Failed to preview blast radius:', error);
      alert('Failed to preview blast radius: ' + error.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleInitiateRollback = async () => {
    if (!selectedExecutionId.trim()) {
      alert('Execution ID is required');
      return;
    }

    try {
      const response = await apiClient.post('/api/rollbacks', {
        executionId: selectedExecutionId,
        strategy,
        dryRun,
        autoApprove: false,
        reviewedBy: 'web-ui',
        reason: reason || 'Manual rollback from UI',
      });

      alert(
        `Rollback ${dryRun ? 'dry run' : 'execution'} ${response.data.rollback.status}: ${response.data.rollback.compensations.executed} compensations executed`
      );

      setShowRollbackModal(false);
      setSelectedExecutionId('');
      setReason('');
      setBlastRadiusPreview(null);
      loadRollbacks();
    } catch (error: any) {
      console.error('Failed to initiate rollback:', error);
      alert('Failed to initiate rollback: ' + error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-gray-800 text-gray-300 border-gray-700';
      case 'PARTIAL':
        return 'bg-primary-900/20 text-primary-500 border-primary-700';
      case 'FAILED':
        return 'bg-primary-900/30 text-primary-400 border-primary-600';
      case 'IN_PROGRESS':
        return 'bg-gray-800 text-gray-300 border-gray-700';
      case 'DRY_RUN':
        return 'bg-gray-800 text-gray-400 border-gray-700';
      default:
        return 'bg-gray-800 text-gray-400 border-gray-700';
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

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const durationMs = endTime - startTime;

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Rollbacks</h1>
        <button
          onClick={() => setShowRollbackModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition"
        >
          New Rollback
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading rollbacks...</div>
      ) : rollbacks.length === 0 ? (
        <div className="text-center py-12 bg-dark-100 rounded-lg border border-gray-800">
          <p className="text-gray-300 mb-2">No rollbacks found</p>
          <p className="text-gray-400 text-sm">
            Use the "New Rollback" button to initiate a rollback
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rollbacks.map((rollback) => (
            <div
              key={rollback.id}
              className={`border-l-4 p-4 rounded-lg shadow-sm bg-dark-100 ${getStatusColor(rollback.status)}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-100">{rollback.execution?.tool || 'Unknown Tool'}</h3>
                    <span className="px-2 py-1 bg-gray-800 rounded text-xs font-medium text-gray-300 border border-gray-700">
                      {getStrategyLabel(rollback.strategy)}
                    </span>
                    <span className="px-2 py-1 bg-gray-800 rounded text-xs font-medium text-gray-300 border border-gray-700">
                      {rollback.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-400">Execution ID:</span>{' '}
                      <span className="font-mono text-xs text-gray-300">{rollback.executionId}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Agent:</span>{' '}
                      <span className="font-mono text-xs text-gray-300">
                        {rollback.execution?.agentId || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Initiated by:</span>{' '}
                      <span className="text-gray-300">{rollback.initiatedBy}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Duration:</span>{' '}
                      <span className="text-gray-300">{formatDuration(rollback.createdAt, rollback.completedAt)}</span>
                    </div>
                  </div>

                  {rollback.reason && (
                    <div className="text-sm mb-3">
                      <span className="text-gray-400">Reason:</span> <span className="text-gray-300">{rollback.reason}</span>
                    </div>
                  )}

                  {rollback.blastRadius && (
                    <div className="grid grid-cols-4 gap-4 text-sm bg-gray-900 p-3 rounded border border-gray-800">
                      <div>
                        <div className="text-gray-400 text-xs">Total Affected</div>
                        <div className="font-semibold text-gray-100">{rollback.blastRadius.total || 0}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Executed</div>
                        <div className="font-semibold text-gray-300">
                          {rollback.compensations?.executed || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Failed</div>
                        <div className="font-semibold text-primary-400">
                          {rollback.compensations?.failed || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Manual Required</div>
                        <div className="font-semibold text-primary-500">
                          {rollback.compensations?.manual || 0}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-right text-xs text-gray-500">
                  {new Date(rollback.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rollback Modal */}
      {showRollbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-100 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-gray-100">Initiate Rollback</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Execution ID</label>
                <input
                  type="text"
                  value={selectedExecutionId}
                  onChange={(e) => setSelectedExecutionId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 font-mono text-sm bg-gray-900 text-gray-100"
                  placeholder="Enter execution ID to rollback"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Rollback Strategy</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 bg-gray-900 text-gray-100"
                >
                  <option value="SINGLE">Single Execution Only</option>
                  <option value="CHAIN">Execution Chain (all ancestors)</option>
                  <option value="TREE">Full Execution Tree (all descendants)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 bg-gray-900 text-gray-100"
                  rows={3}
                  placeholder="Optional: Describe why this rollback is needed"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dryRun"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="dryRun" className="text-sm font-medium text-gray-300">
                  Dry Run (preview only, don't execute)
                </label>
              </div>

              <button
                onClick={handlePreviewBlastRadius}
                disabled={!selectedExecutionId.trim() || loadingPreview}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition disabled:bg-gray-800 disabled:text-gray-500"
              >
                {loadingPreview ? 'Loading...' : 'Preview Blast Radius'}
              </button>

              {blastRadiusPreview && (
                <div className="border border-gray-800 rounded-lg p-4 bg-gray-900">
                  <h3 className="font-semibold mb-3 text-gray-100">Blast Radius Preview</h3>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-400">Total Affected</div>
                      <div className="text-2xl font-bold text-gray-100">
                        {blastRadiusPreview.blastRadius.total}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Max Depth</div>
                      <div className="text-2xl font-bold text-gray-100">
                        {blastRadiusPreview.blastRadius.maxDepth}
                      </div>
                    </div>
                  </div>

                  {blastRadiusPreview.validation.warnings.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-primary-400 mb-2">Warnings:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {blastRadiusPreview.validation.warnings.map((warning, idx) => (
                          <li key={idx} className="text-primary-500">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {blastRadiusPreview.validation.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-300 mb-2">Recommendations:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {blastRadiusPreview.validation.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-gray-400">
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!blastRadiusPreview.validation.isSafe && (
                    <div className="mt-4 p-3 bg-primary-900/20 border border-primary-600 rounded text-sm text-primary-400">
                      This rollback is flagged as unsafe and will require manual approval.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRollbackModal(false);
                  setSelectedExecutionId('');
                  setReason('');
                  setBlastRadiusPreview(null);
                }}
                className="px-4 py-2 border border-gray-700 rounded hover:bg-gray-800 transition text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiateRollback}
                disabled={!selectedExecutionId.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition disabled:bg-gray-800 disabled:text-gray-500"
              >
                {dryRun ? 'Run Dry Run' : 'Execute Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
