import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies default variant class', () => {
    const { container } = render(<Badge>Test</Badge>);
    const badge = container.querySelector('.badge');
    expect(badge).toHaveClass('badge-default');
  });

  it('applies specified variant class', () => {
    const { container } = render(<Badge variant="danger">Error</Badge>);
    const badge = container.querySelector('.badge');
    expect(badge).toHaveClass('badge-danger');
  });

  it('applies success variant class', () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    const badge = container.querySelector('.badge');
    expect(badge).toHaveClass('badge-success');
  });

  it('applies warning variant class', () => {
    const { container } = render(<Badge variant="warning">Warn</Badge>);
    const badge = container.querySelector('.badge');
    expect(badge).toHaveClass('badge-warning');
  });

  it('applies brand variant class', () => {
    const { container } = render(<Badge variant="brand">Brand</Badge>);
    const badge = container.querySelector('.badge');
    expect(badge).toHaveClass('badge-brand');
  });

  it('applies default md size class', () => {
    const { container } = render(<Badge>Test</Badge>);
    const badge = container.querySelector('.badge');
    expect(badge).toHaveClass('badge-md');
  });

  it('applies sm size class', () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    const badge = container.querySelector('.badge');
    expect(badge).toHaveClass('badge-sm');
  });

  it('renders as a span element', () => {
    const { container } = render(<Badge>Test</Badge>);
    const badge = container.querySelector('.badge');
    expect(badge?.tagName).toBe('SPAN');
  });
});
