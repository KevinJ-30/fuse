import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders status label', () => {
    render(<StatusBadge status="connected" />);
    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('applies correct status class', () => {
    const { container } = render(<StatusBadge status="connected" />);
    expect(container.querySelector('.status-badge')).toHaveClass('status-badge-connected');
  });

  it('applies degraded status class', () => {
    const { container } = render(<StatusBadge status="degraded" />);
    expect(container.querySelector('.status-badge')).toHaveClass('status-badge-degraded');
  });

  it('applies down status class', () => {
    const { container } = render(<StatusBadge status="down" />);
    expect(container.querySelector('.status-badge')).toHaveClass('status-badge-down');
  });

  it('applies active status class', () => {
    const { container } = render(<StatusBadge status="active" />);
    expect(container.querySelector('.status-badge')).toHaveClass('status-badge-active');
  });

  it('applies inactive status class', () => {
    const { container } = render(<StatusBadge status="inactive" />);
    expect(container.querySelector('.status-badge')).toHaveClass('status-badge-inactive');
  });

  it('applies pulse class when pulse is true', () => {
    const { container } = render(<StatusBadge status="connected" pulse />);
    expect(container.querySelector('.status-badge')).toHaveClass('status-badge-pulse');
  });

  it('does not apply pulse class by default', () => {
    const { container } = render(<StatusBadge status="connected" />);
    expect(container.querySelector('.status-badge')).not.toHaveClass('status-badge-pulse');
  });

  it('applies sm size class', () => {
    const { container } = render(<StatusBadge status="active" size="sm" />);
    expect(container.querySelector('.status-badge')).toHaveClass('status-badge-sm');
  });

  it('renders dot element', () => {
    const { container } = render(<StatusBadge status="connected" />);
    expect(container.querySelector('.status-badge-dot')).toBeInTheDocument();
  });
});
