import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import Header from '../Header';
import { renderWithRouter } from '../../../test/helpers';

describe('Header', () => {
  it('renders Dashboard title on /dashboard route', () => {
    renderWithRouter(<Header />, { route: '/dashboard' });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders Approval Queue title on /approvals route', () => {
    renderWithRouter(<Header />, { route: '/approvals' });
    expect(screen.getByText('Approval Queue')).toBeInTheDocument();
  });

  it('renders Execution Graph title on /executions route', () => {
    renderWithRouter(<Header />, { route: '/executions' });
    expect(screen.getByText('Execution Graph')).toBeInTheDocument();
  });

  it('renders Emergency Stops title on /breakers route', () => {
    renderWithRouter(<Header />, { route: '/breakers' });
    expect(screen.getByText('Emergency Stops')).toBeInTheDocument();
  });

  it('renders Policies title on /policies route', () => {
    renderWithRouter(<Header />, { route: '/policies' });
    expect(screen.getByText('Policies')).toBeInTheDocument();
  });

  it('renders Rollback History title on /rollbacks route', () => {
    renderWithRouter(<Header />, { route: '/rollbacks' });
    expect(screen.getByText('Rollback History')).toBeInTheDocument();
  });

  it('renders default title for unknown routes', () => {
    renderWithRouter(<Header />, { route: '/unknown' });
    expect(screen.getByText('Relay')).toBeInTheDocument();
  });

  it('renders Connected status indicator', () => {
    renderWithRouter(<Header />, { route: '/dashboard' });
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('renders Admin user info', () => {
    renderWithRouter(<Header />, { route: '/dashboard' });
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('AD')).toBeInTheDocument();
  });

  it('renders header element', () => {
    const { container } = renderWithRouter(<Header />, { route: '/dashboard' });
    expect(container.querySelector('header')).toBeInTheDocument();
  });
});
