import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import apiClient from '../lib/api';
import { getSocket } from '../lib/socket';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import '../styles/tokens.css';
import './DemoAgent.css';

interface ActivityLog {
  id: string;
  timestamp: Date;
  agentId: string;
  tool: string;
  status: string;
  riskScore?: number;
}

const DEMO_SCENARIOS = [
  { name: 'Happy Path', amount: 50, description: 'Small refund (auto-approved)' },
  { name: 'Approval Required', amount: 350, description: 'Medium refund (needs review)' },
  { name: 'High Value Approval', amount: 750, description: 'Large refund (with warnings)' },
  { name: 'High Value Block', amount: 6000, description: 'Extreme value (blocked)' },
  { name: 'Pattern Violation', amount: 100, description: 'PII in notes (blocked)' },
  { name: 'Rate Limit Test', amount: 25, description: 'Burst of 15 refunds' },
];

export default function DemoAgent() {
  const navigate = useNavigate();
  const [agentRunning, setAgentRunning] = useState(false);
  const [executionCount, setExecutionCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [customAmount, setCustomAmount] = useState(100);
  const [customReason, setCustomReason] = useState('Product quality issue');

  useEffect(() => {
    loadInitialStats();

    const socket = getSocket();
    socket.on('execution:new', handleExecutionEvent);
    socket.on('execution:completed', handleExecutionEvent);
    socket.on('execution:blocked', handleExecutionEvent);
    socket.on('execution:failed', handleExecutionEvent);

    return () => {
      socket.off('execution:new', handleExecutionEvent);
      socket.off('execution:completed', handleExecutionEvent);
      socket.off('execution:blocked', handleExecutionEvent);
      socket.off('execution:failed', handleExecutionEvent);
    };
  }, []);

  const loadInitialStats = async () => {
    try {
      const response = await apiClient.get('/api/executions?agentId=customer_service_refund_bot&limit=20');
      const executions = response.data.executions || [];

      setExecutionCount(executions.length);
      setSuccessCount(executions.filter((e: any) => e.status === 'COMPLETED').length);
      setBlockedCount(executions.filter((e: any) => e.status === 'BLOCKED').length);

      // Convert to activity log
      const logs = executions.map((e: any) => ({
        id: e.id,
        timestamp: new Date(e.createdAt),
        agentId: e.agentId,
        tool: e.tool,
        status: e.status,
        riskScore: e.riskScore,
      }));

      setActivityLog(logs);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleExecutionEvent = (data: any) => {
    // Only track our demo agent
    if (data.agentId === 'customer_service_refund_bot') {
      setExecutionCount(prev => prev + 1);

      if (data.status === 'COMPLETED' || data.status === 'executed') {
        setSuccessCount(prev => prev + 1);
      } else if (data.status === 'BLOCKED' || data.status === 'blocked') {
        setBlockedCount(prev => prev + 1);
      }

      // Add to activity log
      const newLog: ActivityLog = {
        id: data.executionId || Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        agentId: data.agentId,
        tool: data.tool,
        status: data.status,
        riskScore: data.riskScore,
      };

      setActivityLog(prev => [newLog, ...prev].slice(0, 20));
    }
  };

  const runScenario = async (scenarioName: string, amount: number, reason?: string) => {
    toast.info('Triggering Scenario', {
      description: `Running: ${scenarioName}`,
    });

    try {
      // Since we can't directly control the agent from UI, we'll just show a message
      // In a real implementation, this would send a command to the agent process
      toast.warning('Manual Execution Required', {
        description: `Run: npm start scenario "${scenarioName}" in packages/demo-agent`,
        duration: 10000,
      });
    } catch (error) {
      console.error('Error running scenario:', error);
      toast.error('Failed to run scenario');
    }
  };

  const toggleAgent = () => {
    if (agentRunning) {
      toast.info('Agent Control', {
        description: 'To stop: Press Ctrl+C in the agent terminal',
      });
    } else {
      toast.info('Agent Control', {
        description: 'To start: Run npm start continuous in packages/demo-agent',
      });
    }
    setAgentRunning(!agentRunning);
  };

  const successRate = executionCount > 0 ? ((successCount / executionCount) * 100).toFixed(1) : '0.0';
  const avgRiskScore = activityLog.length > 0
    ? (activityLog.reduce((sum, log) => sum + (log.riskScore || 0), 0) / activityLog.length).toFixed(2)
    : '0.00';

  const getStatusColor = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
    const statusUpper = status.toUpperCase();
    if (statusUpper === 'COMPLETED' || statusUpper === 'EXECUTED') return 'success';
    if (statusUpper === 'PENDING' || statusUpper === 'AWAITING_APPROVAL') return 'warning';
    if (statusUpper === 'BLOCKED' || statusUpper === 'FAILED') return 'danger';
    return 'default';
  };

  return (
    <div className="demo-agent-container">
      <div className="demo-header animate-in">
        <div>
          <h1 className="heading heading-lg">Live Demo Agent</h1>
          <p className="demo-subtitle">Customer Service Refund Bot - Interactive Controls</p>
        </div>
      </div>

      <div className="demo-grid">
        {/* Agent Status Panel */}
        <Panel className="agent-status-panel animate-in stagger-1" gradient="brand">
          <h2 className="heading heading-md">Agent Status</h2>

          <div className="agent-status">
            <div className={`status-indicator ${agentRunning ? 'running' : 'stopped'}`}>
              <div className="status-pulse" />
              <span className="status-text">{agentRunning ? 'Running' : 'Stopped'}</span>
            </div>
            <Button
              variant={agentRunning ? 'danger' : 'primary'}
              onClick={toggleAgent}
            >
              {agentRunning ? 'Stop Agent' : 'Start Agent'}
            </Button>
          </div>

          <div className="agent-metrics">
            <div className="agent-metric">
              <div className="metric-value">{executionCount}</div>
              <div className="metric-label">Total Executions</div>
            </div>
            <div className="agent-metric">
              <div className="metric-value success">{successRate}%</div>
              <div className="metric-label">Success Rate</div>
            </div>
            <div className="agent-metric">
              <div className="metric-value">{avgRiskScore}</div>
              <div className="metric-label">Avg Risk Score</div>
            </div>
          </div>
        </Panel>

        {/* Scenario Control Panel */}
        <Panel className="scenario-panel animate-in stagger-2">
          <h2 className="heading heading-md">Pre-Built Scenarios</h2>

          <div className="scenario-grid">
            {DEMO_SCENARIOS.map((scenario, i) => (
              <button
                key={i}
                className="scenario-button"
                onClick={() => runScenario(scenario.name, scenario.amount)}
              >
                <div className="scenario-name">{scenario.name}</div>
                <div className="scenario-amount">${scenario.amount}</div>
                <div className="scenario-description">{scenario.description}</div>
              </button>
            ))}
          </div>

          <div className="scenario-help">
            <p>Click a scenario to see the command needed to run it in the agent terminal</p>
          </div>
        </Panel>

        {/* Custom Scenario Builder */}
        <Panel className="custom-scenario-panel animate-in stagger-3">
          <h2 className="heading heading-md">Custom Scenario</h2>

          <div className="custom-form">
            <div className="form-group">
              <label>Amount ($)</label>
              <input
                type="range"
                min="0"
                max="10000"
                step="50"
                value={customAmount}
                onChange={(e) => setCustomAmount(parseInt(e.target.value))}
                className="amount-slider"
              />
              <div className="amount-display">${customAmount}</div>
            </div>

            <div className="form-group">
              <label>Refund Reason</label>
              <select
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="reason-select"
              >
                <option value="Product quality issue">Product quality issue</option>
                <option value="Wrong item shipped">Wrong item shipped</option>
                <option value="Product arrived damaged">Product arrived damaged</option>
                <option value="Customer not satisfied">Customer not satisfied</option>
                <option value="Defective product">Defective product</option>
              </select>
            </div>

            <Button
              variant="primary"
              onClick={() => toast.info('Custom Scenario', {
                description: `Amount: $${customAmount}, Reason: ${customReason}`,
              })}
            >
              Execute Custom Scenario
            </Button>
          </div>
        </Panel>

        {/* Live Activity Feed */}
        <Panel className="activity-feed-panel animate-in stagger-4">
          <h2 className="heading heading-md">Live Activity Feed</h2>

          {activityLog.length === 0 ? (
            <div className="activity-empty">
              <p>No recent activity</p>
              <p className="activity-empty-subtitle">Run a scenario to see executions appear here</p>
            </div>
          ) : (
            <div className="activity-list">
              {activityLog.map((log, i) => (
                <div
                  key={log.id}
                  className={`activity-item animate-in stagger-${Math.min(i + 1, 6)}`}
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

        {/* Demo Script Info */}
        <Panel className="demo-script-panel animate-in stagger-5">
          <h2 className="heading heading-md">Full Demo Script</h2>

          <div className="demo-script-content">
            <p>Run all scenarios in sequence with the full demo command:</p>

            <div className="command-box">
              <code>cd packages/demo-agent</code>
              <br />
              <code>npm start full</code>
            </div>

            <div className="script-features">
              <div className="script-feature">
                <span className="feature-icon">✓</span>
                <span>Executes all 7 scenarios</span>
              </div>
              <div className="script-feature">
                <span className="feature-icon">✓</span>
                <span>Includes timing delays for observation</span>
              </div>
              <div className="script-feature">
                <span className="feature-icon">✓</span>
                <span>Shows real-time stats</span>
              </div>
              <div className="script-feature">
                <span className="feature-icon">✓</span>
                <span>Tests rate limiting</span>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={() => toast.info('Full Demo', {
                description: 'Run: npm start full in packages/demo-agent terminal',
                duration: 8000,
              })}
            >
              View Full Demo Command
            </Button>
          </div>
        </Panel>

        {/* Quick Links */}
        <Panel className="quick-links-panel animate-in stagger-6">
          <h2 className="heading heading-md">Quick Actions</h2>

          <div className="quick-links">
            <button onClick={() => navigate('/approvals')} className="quick-link">
              <span>View Approval Queue</span>
              <span className="quick-link-arrow">→</span>
            </button>
            <button onClick={() => navigate('/executions')} className="quick-link">
              <span>View Execution Graph</span>
              <span className="quick-link-arrow">→</span>
            </button>
            <button onClick={() => navigate('/breakers')} className="quick-link">
              <span>Manage Emergency Stops</span>
              <span className="quick-link-arrow">→</span>
            </button>
            <button onClick={() => navigate('/policies')} className="quick-link">
              <span>Configure Policies</span>
              <span className="quick-link-arrow">→</span>
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
