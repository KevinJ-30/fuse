import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import Sidebar from '../Sidebar';
import { renderWithRouter } from '../../../test/helpers';

describe('Sidebar', () => {
  it('renders the RELAY brand name', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText('RELAY')).toBeInTheDocument();
  });

  it('renders all navigation items', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Approval Queue')).toBeInTheDocument();
    expect(screen.getByText('Execution Graph')).toBeInTheDocument();
    expect(screen.getByText('Emergency Stops')).toBeInTheDocument();
    expect(screen.getByText('Policies')).toBeInTheDocument();
    expect(screen.getByText('Rollbacks')).toBeInTheDocument();
  });

  it('renders navigation links with correct hrefs', () => {
    renderWithRouter(<Sidebar />);
    
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    
    const approvalsLink = screen.getByText('Approval Queue').closest('a');
    expect(approvalsLink).toHaveAttribute('href', '/approvals');
    
    const executionsLink = screen.getByText('Execution Graph').closest('a');
    expect(executionsLink).toHaveAttribute('href', '/executions');
    
    const breakersLink = screen.getByText('Emergency Stops').closest('a');
    expect(breakersLink).toHaveAttribute('href', '/breakers');
    
    const policiesLink = screen.getByText('Policies').closest('a');
    expect(policiesLink).toHaveAttribute('href', '/policies');
    
    const rollbacksLink = screen.getByText('Rollbacks').closest('a');
    expect(rollbacksLink).toHaveAttribute('href', '/rollbacks');
  });

  it('highlights active route', () => {
    renderWithRouter(<Sidebar />, { route: '/dashboard' });
    
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    // Active link should have different styling (check for the active class)
    expect(dashboardLink?.className).toContain('bg-primary-600');
  });

  it('does not highlight inactive routes', () => {
    renderWithRouter(<Sidebar />, { route: '/dashboard' });
    
    const policiesLink = screen.getByText('Policies').closest('a');
    expect(policiesLink?.className).not.toContain('bg-primary-600');
    expect(policiesLink?.className).toContain('text-gray-400');
  });

  it('renders system status', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText('System Status')).toBeInTheDocument();
    expect(screen.getByText('Operational')).toBeInTheDocument();
  });

  it('renders 6 navigation items', () => {
    renderWithRouter(<Sidebar />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(6);
  });
});
