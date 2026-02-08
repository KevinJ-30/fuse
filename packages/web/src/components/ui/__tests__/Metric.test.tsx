import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Metric } from '../Metric';

describe('Metric', () => {
  it('renders label and value', () => {
    render(<Metric label="Total Users" value={1234} />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<Metric label="Status" value="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders suffix', () => {
    render(<Metric label="Rate" value={95} suffix="%" />);
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<Metric label="Score" value={42} description="Out of 100" />);
    expect(screen.getByText('Out of 100')).toBeInTheDocument();
  });

  it('renders delta with up trend', () => {
    render(<Metric label="Revenue" value="$1000" delta={{ value: 12, trend: 'up' }} />);
    expect(screen.getByText(/↑/)).toBeInTheDocument();
    expect(screen.getByText(/12%/)).toBeInTheDocument();
  });

  it('renders delta with down trend', () => {
    render(<Metric label="Errors" value={5} delta={{ value: 8, trend: 'down' }} />);
    expect(screen.getByText(/↓/)).toBeInTheDocument();
    expect(screen.getByText(/8%/)).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<Metric label="Test" value={1} icon={<span data-testid="icon">Icon</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies size classes', () => {
    const { container: smContainer } = render(<Metric label="Small" value={1} size="sm" />);
    expect(smContainer.querySelector('.metric')).toHaveClass('metric-sm');

    const { container: lgContainer } = render(<Metric label="Large" value={1} size="lg" />);
    expect(lgContainer.querySelector('.metric')).toHaveClass('metric-lg');
  });

  it('applies default md size', () => {
    const { container } = render(<Metric label="Medium" value={1} />);
    expect(container.querySelector('.metric')).toHaveClass('metric-md');
  });

  it('applies variant classes', () => {
    const { container: dangerContainer } = render(<Metric label="Error" value={5} variant="danger" />);
    expect(dangerContainer.querySelector('.metric')).toHaveClass('metric-danger');

    const { container: successContainer } = render(<Metric label="OK" value={100} variant="success" />);
    expect(successContainer.querySelector('.metric')).toHaveClass('metric-success');
  });

  it('applies default variant', () => {
    const { container } = render(<Metric label="Test" value={1} />);
    expect(container.querySelector('.metric')).toHaveClass('metric-default');
  });
});
