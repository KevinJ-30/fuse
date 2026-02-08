import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { createMockExecution } from '../../test/helpers';

// Must mock before importing the component
vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../lib/socket', () => ({
  getSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

// Mock ReactFlow since it needs a DOM with dimensions
vi.mock('reactflow', () => {
  const MockReactFlow = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="reactflow-mock">{children}</div>
  );
  return {
    default: MockReactFlow,
    Background: () => <div data-testid="rf-background" />,
    Controls: () => <div data-testid="rf-controls" />,
    MiniMap: () => <div data-testid="rf-minimap" />,
    Panel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
    useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  };
});

// Mock dagre - Graph must be a proper constructor (class/function)
vi.mock('dagre', () => {
  function MockGraph() {
    return {
      setDefaultEdgeLabel: vi.fn(),
      setGraph: vi.fn(),
      setNode: vi.fn(),
      setEdge: vi.fn(),
      node: vi.fn().mockReturnValue({ x: 100, y: 100 }),
    };
  }
  return {
    default: {
      graphlib: { Graph: MockGraph },
      layout: vi.fn(),
    },
  };
});

// Mock components that may have their own CSS dependency issues
vi.mock('../../components/graph/ExecutionNode', () => ({
  default: () => <div data-testid="execution-node" />,
}));

vi.mock('../../components/ui', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
  SkeletonCard: () => <div data-testid="skeleton-card" />,
}));

import apiClient from '../../lib/api';
import ExecutionGraph from '../ExecutionGraph';

const mockGet = vi.mocked(apiClient.get);

function renderExecutionGraph() {
  return render(
    <BrowserRouter>
      <ExecutionGraph />
    </BrowserRouter>
  );
}

describe('ExecutionGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    renderExecutionGraph();
    const skeletons = screen.getAllByTestId('skeleton-card');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders page header after loading', async () => {
    mockGet.mockResolvedValueOnce({ data: { executions: [] } });
    renderExecutionGraph();

    await waitFor(() => {
      expect(screen.getByText('Execution Graph')).toBeInTheDocument();
    });
    expect(screen.getByText(/Visualize agent execution/)).toBeInTheDocument();
  });

  it('shows empty state when no executions', async () => {
    mockGet.mockResolvedValueOnce({ data: { executions: [] } });
    renderExecutionGraph();

    await waitFor(() => {
      expect(screen.getByText('No executions found')).toBeInTheDocument();
    });
  });

  it('renders filter dropdowns', async () => {
    mockGet.mockResolvedValueOnce({ data: { executions: [] } });
    renderExecutionGraph();

    await waitFor(() => {
      expect(screen.getByDisplayValue('All Statuses')).toBeInTheDocument();
      expect(screen.getByDisplayValue('All Agents')).toBeInTheDocument();
      expect(screen.getByDisplayValue('All Tools')).toBeInTheDocument();
    });
  });

  it('renders view mode toggle buttons', async () => {
    mockGet.mockResolvedValueOnce({ data: { executions: [] } });
    renderExecutionGraph();

    await waitFor(() => {
      expect(screen.getByText('Graph')).toBeInTheDocument();
      expect(screen.getByText('List')).toBeInTheDocument();
    });
  });

  it('renders refresh button', async () => {
    mockGet.mockResolvedValueOnce({ data: { executions: [] } });
    renderExecutionGraph();

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('renders stats bar with execution data', async () => {
    const executions = [
      createMockExecution({ id: 'e1', status: 'COMPLETED' }),
      createMockExecution({ id: 'e2', status: 'FAILED' }),
      createMockExecution({ id: 'e3', status: 'PENDING' }),
    ];
    mockGet.mockResolvedValueOnce({ data: { executions } });
    renderExecutionGraph();

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
      // "Completed" and "Failed" appear in stats, filters, and legend badges
      expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Avg Risk')).toBeInTheDocument();
    });
  });

  it('calls API with correct endpoint', async () => {
    mockGet.mockResolvedValueOnce({ data: { executions: [] } });
    renderExecutionGraph();

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/executions'));
    });
  });

  it('populates unique agents in filter dropdown', async () => {
    const executions = [
      createMockExecution({ id: 'e1', agentId: 'agent-alpha' }),
      createMockExecution({ id: 'e2', agentId: 'agent-beta' }),
      createMockExecution({ id: 'e3', agentId: 'agent-alpha' }), // duplicate
    ];
    mockGet.mockResolvedValueOnce({ data: { executions } });
    renderExecutionGraph();

    await waitFor(() => {
      expect(screen.getByText('agent-alpha')).toBeInTheDocument();
      expect(screen.getByText('agent-beta')).toBeInTheDocument();
    });
  });

  it('populates unique tools in filter dropdown', async () => {
    const executions = [
      createMockExecution({ id: 'e1', tool: 'tool_a' }),
      createMockExecution({ id: 'e2', tool: 'tool_b' }),
    ];
    mockGet.mockResolvedValueOnce({ data: { executions } });
    renderExecutionGraph();

    await waitFor(() => {
      expect(screen.getByText('tool_a')).toBeInTheDocument();
      expect(screen.getByText('tool_b')).toBeInTheDocument();
    });
  });

  it('renders direction toggle when in graph mode', async () => {
    mockGet.mockResolvedValueOnce({ data: { executions: [] } });
    renderExecutionGraph();

    await waitFor(() => {
      expect(screen.getByText('Vertical')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGet.mockRejectedValueOnce(new Error('Network error'));
    renderExecutionGraph();

    // Should still render the page (empty state) rather than crashing
    await waitFor(() => {
      expect(screen.getByText('No executions found')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });
});

describe('ExecutionGraph status helper functions', () => {
  // Test the exported helper logic by examining rendered output
  it('maps COMPLETED status to success variant badge', async () => {
    const executions = [createMockExecution({ id: 'e1', status: 'COMPLETED' })];
    mockGet.mockResolvedValueOnce({ data: { executions } });
    renderExecutionGraph();

    // Switch to list view to see badges
    await waitFor(() => {
      expect(screen.getByText('List')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('List'));

    await waitFor(() => {
      const badges = screen.getAllByTestId('badge');
      const statusBadge = badges.find(b => b.textContent === 'COMPLETED');
      expect(statusBadge).toBeDefined();
      expect(statusBadge?.getAttribute('data-variant')).toBe('success');
    });
  });

  it('maps FAILED status to danger variant badge', async () => {
    const executions = [createMockExecution({ id: 'e1', status: 'FAILED' })];
    mockGet.mockResolvedValueOnce({ data: { executions } });
    renderExecutionGraph();

    await waitFor(() => {
      expect(screen.getByText('List')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('List'));

    await waitFor(() => {
      const badges = screen.getAllByTestId('badge');
      const statusBadge = badges.find(b => b.textContent === 'FAILED');
      expect(statusBadge?.getAttribute('data-variant')).toBe('danger');
    });
  });
});
