import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { createMockDashboardStats } from '../../test/helpers';

// Mock the API client
vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock socket.io
vi.mock('../../lib/socket', () => ({
  getSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

import apiClient from '../../lib/api';

const mockGet = vi.mocked(apiClient.get);

function renderDashboard() {
  return render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {})); // Never resolves
    renderDashboard();
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('API Error'));
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Error loading dashboard stats')).toBeInTheDocument();
    });
  });

  it('renders dashboard with stats after successful load', async () => {
    const stats = createMockDashboardStats();
    mockGet.mockResolvedValueOnce({ data: stats });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Key metrics should be displayed
    expect(screen.getByText('Executions')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Approval Rate')).toBeInTheDocument();
    expect(screen.getByText('Active Breakers')).toBeInTheDocument();
    expect(screen.getByText('Recent Rollbacks')).toBeInTheDocument();
  });

  it('renders detection layer statistics', async () => {
    const stats = createMockDashboardStats();
    mockGet.mockResolvedValueOnce({ data: stats });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Detection Layer Statistics')).toBeInTheDocument();
    });

    expect(screen.getByText('Rule Violations')).toBeInTheDocument();
    expect(screen.getByText('Anomalies Detected')).toBeInTheDocument();
    expect(screen.getByText('Semantic Concerns')).toBeInTheDocument();
    expect(screen.getByText('Detection Rate')).toBeInTheDocument();
  });

  it('renders risk distribution section', async () => {
    const stats = createMockDashboardStats();
    mockGet.mockResolvedValueOnce({ data: stats });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Risk Score Distribution')).toBeInTheDocument();
    });

    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('renders top agents', async () => {
    const stats = createMockDashboardStats();
    mockGet.mockResolvedValueOnce({ data: stats });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Top Agents')).toBeInTheDocument();
    });

    expect(screen.getByText('agent-1')).toBeInTheDocument();
    expect(screen.getByText('agent-2')).toBeInTheDocument();
  });

  it('renders top tools', async () => {
    const stats = createMockDashboardStats();
    mockGet.mockResolvedValueOnce({ data: stats });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Top Tools')).toBeInTheDocument();
    });

    expect(screen.getByText('process_refund')).toBeInTheDocument();
    expect(screen.getByText('send_email')).toBeInTheDocument();
  });

  it('shows "No data yet" when top agents is empty', async () => {
    const stats = createMockDashboardStats({ topAgents: [], topTools: [] });
    mockGet.mockResolvedValueOnce({ data: stats });
    renderDashboard();

    await waitFor(() => {
      const noData = screen.getAllByText('No data yet');
      expect(noData.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders time range selector', async () => {
    const stats = createMockDashboardStats();
    mockGet.mockResolvedValue({ data: stats });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Last 24 Hours')).toBeInTheDocument();
    });
  });

  it('changes time range on select', async () => {
    const user = userEvent.setup();
    const stats = createMockDashboardStats();
    mockGet.mockResolvedValue({ data: stats });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Last 24 Hours')).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue('Last 24 Hours');
    await user.selectOptions(select, '7d');

    // Should have made another API call with the new time range
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('timeRange=7d')
    );
  });

  it('calls API with correct endpoint', async () => {
    const stats = createMockDashboardStats();
    mockGet.mockResolvedValueOnce({ data: stats });
    renderDashboard();

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/analytics/dashboard?timeRange=24h');
    });
  });

  it('renders approval rate as N/A when rate is 0', async () => {
    const stats = createMockDashboardStats({ approvals: { total: 0, approved: 0, rate: 0 } });
    mockGet.mockResolvedValueOnce({ data: stats });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  it('renders risk badge with correct label for different scores', async () => {
    // Test Critical score (appears both in risk badge and risk distribution card)
    const stats = createMockDashboardStats({ avgRiskScore: 0.97 });
    mockGet.mockResolvedValueOnce({ data: stats });
    renderDashboard();

    await waitFor(() => {
      const criticals = screen.getAllByText(/Critical/);
      expect(criticals.length).toBeGreaterThanOrEqual(1);
    });

    // The RiskBadge should show the score value
    expect(screen.getByText(/0\.97/)).toBeInTheDocument();
  });
});
