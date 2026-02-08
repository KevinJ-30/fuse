import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Render helper that wraps components with necessary providers.
 */
export function renderWithRouter(
  ui: ReactElement,
  { route = '/', ...options }: RenderOptions & { route?: string } = {}
) {
  window.history.pushState({}, 'Test page', route);
  return render(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
    ...options,
  });
}

/**
 * Create a mock DashboardStats object for testing.
 */
export function createMockDashboardStats(overrides = {}) {
  return {
    executions: { total: 150, byStatus: { COMPLETED: 120, FAILED: 10, PENDING: 20 } },
    riskDistribution: { low: 80, medium: 40, high: 20, critical: 10 },
    avgRiskScore: 0.35,
    detection: {
      ruleViolations: 5,
      anomalies: 3,
      semanticConcerns: 2,
      detectionRate: 85,
    },
    activeBreakers: 1,
    approvals: { total: 50, approved: 45, rate: 90 },
    rollbacks: 3,
    topAgents: [
      { agentId: 'agent-1', count: 50 },
      { agentId: 'agent-2', count: 30 },
    ],
    topTools: [
      { tool: 'process_refund', count: 40 },
      { tool: 'send_email', count: 25 },
    ],
    ...overrides,
  };
}

/**
 * Create a mock Execution object for testing.
 */
export function createMockExecution(overrides = {}) {
  return {
    id: 'exec-123',
    agentId: 'test-agent',
    tool: 'process_refund',
    status: 'COMPLETED',
    createdAt: '2026-02-07T10:00:00Z',
    completedAt: '2026-02-07T10:00:05Z',
    parentId: null,
    riskScore: 0.25,
    input: { orderId: 'ORD-001', amount: 50 },
    output: { success: true },
    detectionFlags: null,
    metadata: null,
    previousState: null,
    ...overrides,
  };
}
