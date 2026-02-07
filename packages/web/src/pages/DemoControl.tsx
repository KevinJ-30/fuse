import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { demoApi } from '../lib/api';
import { getSocket } from '../lib/socket';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import '../styles/tokens.css';
import './DemoControl.css';

interface ActivityLog {
  id: string;
  timestamp: Date;
  agentId: string;
  tool: string;
  status: string;
  riskScore?: number;
  orderId?: string;
}

export default function DemoControl() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [executionCount, setExecutionCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const listenersRegistered = useRef(false);
  const pendingRequests = useRef<Map<string, any>>(new Map());

  // Handle messages from customer portal iframe
  useEffect(() => {
    const handleIframeMessage = async (event: MessageEvent) => {
      if (event.data.type === 'REFUND_REQUESTED') {
        const { orderId, amount, reason, customerId } = event.data.data;

        toast.info('Customer Refund Request', {
          description: `Processing refund of $${amount} for ${orderId}`,
        });

        try {
          // Store request for tracking
          pendingRequests.current.set(orderId, { amount, reason, customerId });

          // Trigger refund via API
          await demoApi.refund({ orderId, amount, reason, customerId });
        } catch (error) {
          console.error('Error processing refund:', error);
          toast.error('Failed to process refund');

          // Send error back to iframe
          iframeRef.current?.contentWindow?.postMessage({
            type: 'REFUND_RESULT',
            data: { status: 'error', amount, reason: 'System error' }
          }, '*');
        }
      }
    };

    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, []);

  // Handle execution events from socket
  const handleExecutionEvent = (data: any) => {
    try {
      if (!data || typeof data !== 'object') return;
      if (!data.agentId || !data.tool) return;

      // Only track our demo agent
      if (data.agentId === 'customer_service_refund_bot') {
        setExecutionCount(prev => prev + 1);

        if (data.status === 'COMPLETED' || data.status === 'executed') {
          setSuccessCount(prev => prev + 1);

          // Check if this is a stripe_refund completion for a pending request
          if (data.tool === 'stripe_refund' && data.input?.orderId) {
            const orderId = data.input.orderId;
            const request = pendingRequests.current.get(orderId);

            if (request) {
              // Send success to iframe
              iframeRef.current?.contentWindow?.postMessage({
                type: 'REFUND_RESULT',
                data: {
                  status: 'COMPLETED',
                  amount: request.amount,
                  orderId
                }
              }, '*');

              pendingRequests.current.delete(orderId);
            }
          }
        } else if (data.status === 'BLOCKED' || data.status === 'blocked') {
          setBlockedCount(prev => prev + 1);

          // Check if this is a blocked refund
          if (data.tool === 'stripe_refund' && data.input?.orderId) {
            const orderId = data.input.orderId;
            const request = pendingRequests.current.get(orderId);

            if (request) {
              // Send blocked status to iframe
              iframeRef.current?.contentWindow?.postMessage({
                type: 'REFUND_RESULT',
                data: {
                  status: 'BLOCKED',
                  amount: request.amount,
                  reason: data.reason || 'Security check failed',
                  orderId
                }
              }, '*');

              pendingRequests.current.delete(orderId);
            }
          }
        } else if (data.status === 'AWAITING_APPROVAL') {
          // Check if this is a pending approval
          if (data.tool === 'stripe_refund' && data.input?.orderId) {
            const orderId = data.input.orderId;
            const request = pendingRequests.current.get(orderId);

            if (request) {
              // Send pending status to iframe
              iframeRef.current?.contentWindow?.postMessage({
                type: 'REFUND_RESULT',
                data: {
                  status: 'AWAITING_APPROVAL',
                  amount: request.amount,
                  orderId
                }
              }, '*');

              // Don't delete - wait for actual approval/rejection
            }
          }
        }

        // Add to activity log
        const newLog: ActivityLog = {
          id: data.executionId || data.id || `temp-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          agentId: data.agentId,
          tool: data.tool,
          status: data.status || 'UNKNOWN',
          riskScore: data.riskScore,
          orderId: data.input?.orderId,
        };

        setActivityLog(prev => [newLog, ...prev].slice(0, 15));
      }
    } catch (error) {
      console.error('Error handling execution event:', error);
    }
  };

  // Socket listener setup
  useEffect(() => {
    if (listenersRegistered.current) return;

    const socket = getSocket();
    socket.on('execution:new', handleExecutionEvent);
    socket.on('execution:completed', handleExecutionEvent);
    socket.on('execution:blocked', handleExecutionEvent);
    socket.on('execution:failed', handleExecutionEvent);

    listenersRegistered.current = true;

    return () => {
      socket.off('execution:new', handleExecutionEvent);
      socket.off('execution:completed', handleExecutionEvent);
      socket.off('execution:blocked', handleExecutionEvent);
      socket.off('execution:failed', handleExecutionEvent);
      listenersRegistered.current = false;
    };
  }, []);

  const successRate = executionCount > 0 ? ((successCount / executionCount) * 100).toFixed(1) : '0.0';

  const getStatusColor = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
    const statusUpper = status.toUpperCase();
    if (statusUpper === 'COMPLETED' || statusUpper === 'EXECUTED') return 'success';
    if (statusUpper === 'PENDING' || statusUpper === 'AWAITING_APPROVAL') return 'warning';
    if (statusUpper === 'BLOCKED' || statusUpper === 'FAILED') return 'danger';
    return 'default';
  };

  return (
    <div className="demo-control-container">
      <div className="demo-control-header">
        <div>
          <h1 className="heading heading-lg">🎬 Live Demo - Customer Service Refund Agent</h1>
          <p className="demo-control-subtitle">
            Watch a real customer request a refund (left) while Fuse monitors the autonomous agent (right)
          </p>
        </div>
      </div>

      <div className="demo-control-layout">
        {/* Left: Customer Portal (iframe) */}
        <div className="customer-portal-section">
          <div className="section-label">Customer View</div>
          <iframe
            ref={iframeRef}
            src="/customer-portal"
            className="customer-iframe"
            title="Customer Refund Portal"
          />
        </div>

        {/* Right: Fuse Admin Dashboard */}
        <div className="admin-dashboard-section">
          <div className="section-label">Fuse Monitoring Dashboard</div>

          {/* Metrics Panel */}
          <Panel className="metrics-panel" gradient="brand">
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-value">{executionCount}</div>
                <div className="metric-label">Total Executions</div>
              </div>
              <div className="metric-card">
                <div className="metric-value success">{successRate}%</div>
                <div className="metric-label">Success Rate</div>
              </div>
              <div className="metric-card">
                <div className="metric-value danger">{blockedCount}</div>
                <div className="metric-label">Blocked</div>
              </div>
            </div>
          </Panel>

          {/* Live Activity Feed */}
          <Panel className="activity-panel">
            <h3 className="heading heading-sm">Live Activity Feed</h3>

            {activityLog.length === 0 ? (
              <div className="activity-empty">
                <p>Waiting for customer requests...</p>
              </div>
            ) : (
              <div className="activity-list">
                {activityLog.map((log) => (
                  <div
                    key={log.id}
                    className="activity-item"
                    onClick={() => navigate(`/executions`)}
                  >
                    <div className="activity-time">
                      {log.timestamp.toLocaleTimeString()}
                    </div>
                    <div className="activity-details">
                      <div className="activity-tool">{log.tool}</div>
                      <Badge variant={getStatusColor(log.status)} size="sm">
                        {log.status}
                      </Badge>
                    </div>
                    {log.riskScore !== undefined && (
                      <div className="activity-risk">
                        Risk: {log.riskScore.toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Quick Actions */}
          <Panel className="quick-actions-panel">
            <h3 className="heading heading-sm">Quick Actions</h3>
            <div className="quick-actions-grid">
              <button onClick={() => navigate('/approvals')} className="quick-action-btn">
                <span>View Approval Queue</span>
                <span>→</span>
              </button>
              <button onClick={() => navigate('/executions')} className="quick-action-btn">
                <span>Execution Graph</span>
                <span>→</span>
              </button>
              <button onClick={() => navigate('/breakers')} className="quick-action-btn">
                <span>Emergency Stops</span>
                <span>→</span>
              </button>
              <button onClick={() => navigate('/policies')} className="quick-action-btn">
                <span>Manage Policies</span>
                <span>→</span>
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
